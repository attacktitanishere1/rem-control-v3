import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useDeviceConnection } from '@/hooks/useDeviceConnection';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

interface FileItem {
  name: string;
  type: 'file' | 'folder';
  size: number;
  path: string;
  lastModified: string;
  source?: string;
  extension?: string;
}

export default function FilesTab() {
  const { isConnected, sendMessage } = useDeviceConnection();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState(FileSystem.documentDirectory || '/');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([]);
  const [pathHistory, setPathHistory] = useState<string[]>([]);

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    filterFiles();
  }, [files, searchQuery]);

  const filterFiles = () => {
    if (!searchQuery.trim()) {
      setFilteredFiles(files);
      return;
    }

    const filtered = files.filter(file => 
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredFiles(filtered);
  };

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      let allFiles: FileItem[] = [];

      // Load document directory files
      if (FileSystem.documentDirectory) {
        try {
          const docFiles = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
          const docFileDetails = await Promise.all(
            docFiles.map(async (fileName) => {
              const filePath = `${FileSystem.documentDirectory}${fileName}`;
              try {
                const fileInfo = await FileSystem.getInfoAsync(filePath);
                return {
                  name: fileName,
                  type: fileInfo.isDirectory ? 'folder' : 'file',
                  size: fileInfo.size || 0,
                  path: filePath,
                  lastModified: new Date(fileInfo.modificationTime || Date.now()).toISOString(),
                  source: 'documents',
                  extension: fileName.split('.').pop()?.toLowerCase() || ''
                } as FileItem;
              } catch (error) {
                return {
                  name: fileName,
                  type: 'file',
                  size: 0,
                  path: filePath,
                  lastModified: new Date().toISOString(),
                  source: 'documents',
                  extension: fileName.split('.').pop()?.toLowerCase() || ''
                } as FileItem;
              }
            })
          );
          allFiles.push(...docFileDetails);
        } catch (error) {
          console.log('Error loading document files:', error);
        }
      }

      // Load media library files
      try {
        const { status } = await MediaLibrary.getPermissionsAsync();
        if (status === 'granted') {
          const photoAssets = await MediaLibrary.getAssetsAsync({
            first: 50,
            mediaType: MediaLibrary.MediaType.photo,
            sortBy: MediaLibrary.SortBy.creationTime,
          });

          const photoFiles = photoAssets.assets.map(asset => ({
            name: asset.filename,
            type: 'file' as const,
            size: asset.width * asset.height,
            path: asset.uri,
            lastModified: new Date(asset.creationTime).toISOString(),
            source: 'gallery',
            extension: asset.filename.split('.').pop()?.toLowerCase() || 'jpg'
          }));

          allFiles.push(...photoFiles);
        }
      } catch (error) {
        console.log('Error loading media files:', error);
      }

      // Sort files: folders first, then files, both alphabetically
      allFiles.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });

      setFiles(allFiles);
    } catch (error) {
      console.error('Error loading files:', error);
      Alert.alert('Error', 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  const shareFileList = () => {
    if (!isConnected) {
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    sendMessage({
      type: 'files_update',
      data: {
        files: files,
        currentPath: currentPath,
        totalFiles: files.length,
        timestamp: new Date().toISOString(),
      }
    });

    Alert.alert('Success', `${files.length} files shared with server`);
  };

  const openFile = async (file: FileItem) => {
    if (file.type === 'folder') {
      // Navigate to folder
      setPathHistory(prev => [...prev, currentPath]);
      setCurrentPath(file.path);
      // In a real implementation, you would load the folder contents
      Alert.alert('Info', `Opening folder: ${file.name}`);
    } else {
      // Handle file opening
      Alert.alert(
        'File Actions',
        `What would you like to do with "${file.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Share', onPress: () => shareFile(file) },
          { text: 'Info', onPress: () => showFileInfo(file) },
        ]
      );
    }
  };

  const shareFile = async (file: FileItem) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(file.path);
      } else {
        Alert.alert('Error', 'Sharing not available on this device');
      }
    } catch (error) {
      console.error('Error sharing file:', error);
      Alert.alert('Error', 'Failed to share file');
    }
  };

  const showFileInfo = (file: FileItem) => {
    Alert.alert(
      'File Information',
      `Name: ${file.name}\n` +
      `Type: ${file.type}\n` +
      `Size: ${formatFileSize(file.size)}\n` +
      `Source: ${file.source || 'Unknown'}\n` +
      `Modified: ${new Date(file.lastModified).toLocaleString()}\n` +
      `Path: ${file.path}`,
      [{ text: 'OK' }]
    );
  };

  const goBack = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory.pop();
      setCurrentPath(previousPath || FileSystem.documentDirectory || '/');
      setPathHistory([...pathHistory]);
    }
  };

  const pickAndUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Copy to documents directory
        const fileName = file.name;
        const destinationPath = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.copyAsync({
          from: file.uri,
          to: destinationPath,
        });

        Alert.alert('Success', `File "${fileName}" added to device`);
        loadFiles(); // Refresh file list
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const createFolder = () => {
    Alert.prompt(
      'Create Folder',
      'Enter folder name:',
      async (folderName) => {
        if (folderName && folderName.trim()) {
          try {
            const folderPath = `${FileSystem.documentDirectory}${folderName.trim()}/`;
            await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
            Alert.alert('Success', `Folder "${folderName}" created`);
            loadFiles();
          } catch (error) {
            console.error('Error creating folder:', error);
            Alert.alert('Error', 'Failed to create folder');
          }
        }
      }
    );
  };

  const deleteFile = async (file: FileItem) => {
    Alert.alert(
      'Delete File',
      `Are you sure you want to delete "${file.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(file.path);
              Alert.alert('Success', 'File deleted');
              loadFiles();
            } catch (error) {
              console.error('Error deleting file:', error);
              Alert.alert('Error', 'Failed to delete file');
            }
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'folder') {
      return { name: 'folder', color: '#3b82f6' };
    }

    const ext = file.extension || '';
    const iconMap: { [key: string]: { name: string; color: string } } = {
      'jpg': { name: 'image', color: '#10b981' },
      'jpeg': { name: 'image', color: '#10b981' },
      'png': { name: 'image', color: '#10b981' },
      'gif': { name: 'image', color: '#10b981' },
      'mp4': { name: 'videocam', color: '#ef4444' },
      'avi': { name: 'videocam', color: '#ef4444' },
      'mov': { name: 'videocam', color: '#ef4444' },
      'mp3': { name: 'musical-notes', color: '#8b5cf6' },
      'wav': { name: 'musical-notes', color: '#8b5cf6' },
      'pdf': { name: 'document-text', color: '#dc2626' },
      'doc': { name: 'document-text', color: '#2563eb' },
      'docx': { name: 'document-text', color: '#2563eb' },
      'txt': { name: 'document-text', color: '#6b7280' },
      'zip': { name: 'archive', color: '#f59e0b' },
      'rar': { name: 'archive', color: '#f59e0b' },
    };

    return iconMap[ext] || { name: 'document', color: '#6b7280' };
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Files</Text>
        <View style={[styles.statusIndicator, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search files..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Navigation Bar */}
      <View style={styles.navigationBar}>
        <TouchableOpacity 
          style={[styles.navButton, pathHistory.length === 0 && styles.disabledButton]}
          onPress={goBack}
          disabled={pathHistory.length === 0}
        >
          <Ionicons name="arrow-back" size={16} color={pathHistory.length === 0 ? "#9ca3af" : "#2563eb"} />
        </TouchableOpacity>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pathContainer}>
          <Text style={styles.pathText}>{currentPath}</Text>
        </ScrollView>
        
        <TouchableOpacity style={styles.navButton} onPress={loadFiles}>
          <Ionicons name="refresh" size={16} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity style={styles.actionButton} onPress={pickAndUploadFile}>
          <Ionicons name="add-circle" size={16} color="#ffffff" />
          <Text style={styles.actionButtonText}>Add File</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={createFolder}>
          <Ionicons name="folder-outline" size={16} color="#ffffff" />
          <Text style={styles.actionButtonText}>New Folder</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.shareButton, (!isConnected || files.length === 0) && styles.disabledButton]}
          onPress={shareFileList}
          disabled={!isConnected || files.length === 0}
        >
          <Ionicons name="share" size={16} color="#ffffff" />
          <Text style={styles.actionButtonText}>Share List</Text>
        </TouchableOpacity>
      </View>

      {/* Files List */}
      <ScrollView style={styles.filesList}>
        {isLoading ? (
          <View style={styles.loadingState}>
            <Ionicons name="refresh" size={32} color="#2563eb" />
            <Text style={styles.loadingText}>Loading files...</Text>
          </View>
        ) : filteredFiles.length > 0 ? (
          <View style={styles.filesContainer}>
            {filteredFiles.map((file, index) => {
              const icon = getFileIcon(file);
              return (
                <TouchableOpacity 
                  key={`${file.path}-${index}`} 
                  style={styles.fileItem}
                  onPress={() => openFile(file)}
                >
                  <View style={styles.fileInfo}>
                    <View style={styles.fileIcon}>
                      <Ionicons name={icon.name as any} size={24} color={icon.color} />
                    </View>
                    
                    <View style={styles.fileDetails}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text style={styles.fileMetadata}>
                        {file.type === 'folder' ? 'Folder' : formatFileSize(file.size)} • 
                        {new Date(file.lastModified).toLocaleDateString()}
                        {file.source && ` • ${file.source}`}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.fileActions}>
                    {file.type !== 'folder' && (
                      <>
                        <TouchableOpacity 
                          style={styles.fileActionButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            shareFile(file);
                          }}
                        >
                          <Ionicons name="share-outline" size={16} color="#2563eb" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={styles.fileActionButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            deleteFile(file);
                          }}
                        >
                          <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </>
                    )}
                    
                    {file.type === 'folder' && (
                      <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No Results' : 'No Files'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery 
                ? 'No files match your search query'
                : 'Tap "Add File" to upload files or "New Folder" to create folders'
              }
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Stats Footer */}
      {files.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{files.length}</Text>
              <Text style={styles.statLabel}>Total Items</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {files.filter(f => f.type === 'folder').length}
              </Text>
              <Text style={styles.statLabel}>Folders</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {files.filter(f => f.type === 'file').length}
              </Text>
              <Text style={styles.statLabel}>Files</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  navigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  navButton: {
    padding: 8,
    borderRadius: 6,
  },
  disabledButton: {
    opacity: 0.5,
  },
  pathContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  pathText: {
    fontSize: 14,
    color: '#6b7280',
  },
  actionSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
  },
  shareButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  filesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  filesContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  fileMetadata: {
    fontSize: 12,
    color: '#6b7280',
  },
  fileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileActionButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#f9fafb',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
  },
  statsContainer: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
});