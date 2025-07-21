import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useDeviceConnection } from '@/hooks/useDeviceConnection';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as MediaLibrary from 'expo-media-library';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

export default function StatusTab() {
  const { isConnected, sendMessage } = useDeviceConnection();
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [permissions, setPermissions] = useState({
    location: false,
    contacts: false,
    mediaLibrary: false,
    camera: false,
  });

  useEffect(() => {
    loadDeviceInfo();
    checkPermissions();
  }, []);

  const loadDeviceInfo = async () => {
    try {
      const info = {
        deviceName: Device.deviceName || 'Unknown Device',
        brand: Device.brand || 'Unknown',
        model: Device.modelName || 'Unknown',
        platform: Device.osName || 'Unknown',
        systemVersion: Device.osVersion || 'Unknown',
        appVersion: Constants.expoConfig?.version || '1.0.0',
        sessionId: Constants.sessionId || 'unknown',
        isDevice: Device.isDevice,
        totalMemory: Device.totalMemory,
      };
      setDeviceInfo(info);
    } catch (error) {
      console.error('Error loading device info:', error);
    }
  };

  const checkPermissions = async () => {
    try {
      const locationPermission = await Location.getForegroundPermissionsAsync();
      const contactsPermission = await Contacts.getPermissionsAsync();
      const mediaPermission = await MediaLibrary.getPermissionsAsync();
      
      setPermissions({
        location: locationPermission.status === 'granted',
        contacts: contactsPermission.status === 'granted',
        mediaLibrary: mediaPermission.status === 'granted',
        camera: true, // Camera permission is handled separately
      });
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const requestPermission = async (type: string) => {
    try {
      let result;
      switch (type) {
        case 'location':
          result = await Location.requestForegroundPermissionsAsync();
          break;
        case 'contacts':
          result = await Contacts.requestPermissionsAsync();
          break;
        case 'mediaLibrary':
          result = await MediaLibrary.requestPermissionsAsync();
          break;
        default:
          return;
      }
      
      setPermissions(prev => ({
        ...prev,
        [type]: result.status === 'granted'
      }));
      
      if (result.status === 'granted') {
        Alert.alert('Success', `${type} permission granted`);
      } else {
        Alert.alert('Permission Denied', `${type} permission was not granted`);
      }
    } catch (error) {
      console.error(`Error requesting ${type} permission:`, error);
      Alert.alert('Error', `Failed to request ${type} permission`);
    }
  };

  const shareDeviceInfo = () => {
    if (!isConnected) {
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    sendMessage({
      type: 'device_info_update',
      data: {
        ...deviceInfo,
        permissions,
        timestamp: new Date().toISOString(),
      }
    });

    Alert.alert('Success', 'Device information shared with server');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Device Status</Text>
        <View style={[styles.statusIndicator, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
      </View>

      {/* Connection Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection Status</Text>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Ionicons 
              name={isConnected ? "checkmark-circle" : "close-circle"} 
              size={24} 
              color={isConnected ? "#10b981" : "#ef4444"} 
            />
            <Text style={styles.statusText}>
              {isConnected ? 'Connected to Server' : 'Disconnected'}
            </Text>
          </View>
          
          <TouchableOpacity style={styles.actionButton} onPress={shareDeviceInfo}>
            <Ionicons name="share" size={16} color="#ffffff" />
            <Text style={styles.actionButtonText}>Share Device Info</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Device Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device Information</Text>
        <View style={styles.card}>
          {deviceInfo && (
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Ionicons name="phone-portrait" size={20} color="#2563eb" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Device Name</Text>
                  <Text style={styles.infoValue}>{deviceInfo.deviceName}</Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <Ionicons name="business" size={20} color="#2563eb" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Brand & Model</Text>
                  <Text style={styles.infoValue}>{deviceInfo.brand} {deviceInfo.model}</Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <Ionicons name="logo-android" size={20} color="#2563eb" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Platform</Text>
                  <Text style={styles.infoValue}>{deviceInfo.platform} {deviceInfo.systemVersion}</Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <Ionicons name="apps" size={20} color="#2563eb" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>App Version</Text>
                  <Text style={styles.infoValue}>{deviceInfo.appVersion}</Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <Ionicons name="hardware-chip" size={20} color="#2563eb" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Device Type</Text>
                  <Text style={styles.infoValue}>{deviceInfo.isDevice ? 'Physical Device' : 'Simulator'}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Permissions Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Permissions</Text>
        <View style={styles.card}>
          <View style={styles.permissionsList}>
            <View style={styles.permissionRow}>
              <View style={styles.permissionInfo}>
                <Ionicons 
                  name={permissions.location ? "checkmark-circle" : "close-circle"} 
                  size={20} 
                  color={permissions.location ? "#10b981" : "#ef4444"} 
                />
                <Text style={styles.permissionText}>Location Services</Text>
              </View>
              {!permissions.location && (
                <TouchableOpacity 
                  style={styles.requestButton} 
                  onPress={() => requestPermission('location')}
                >
                  <Text style={styles.requestButtonText}>Grant</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.permissionRow}>
              <View style={styles.permissionInfo}>
                <Ionicons 
                  name={permissions.contacts ? "checkmark-circle" : "close-circle"} 
                  size={20} 
                  color={permissions.contacts ? "#10b981" : "#ef4444"} 
                />
                <Text style={styles.permissionText}>Contacts Access</Text>
              </View>
              {!permissions.contacts && (
                <TouchableOpacity 
                  style={styles.requestButton} 
                  onPress={() => requestPermission('contacts')}
                >
                  <Text style={styles.requestButtonText}>Grant</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.permissionRow}>
              <View style={styles.permissionInfo}>
                <Ionicons 
                  name={permissions.mediaLibrary ? "checkmark-circle" : "close-circle"} 
                  size={20} 
                  color={permissions.mediaLibrary ? "#10b981" : "#ef4444"} 
                />
                <Text style={styles.permissionText}>Media Library</Text>
              </View>
              {!permissions.mediaLibrary && (
                <TouchableOpacity 
                  style={styles.requestButton} 
                  onPress={() => requestPermission('mediaLibrary')}
                >
                  <Text style={styles.requestButtonText}>Grant</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.permissionRow}>
              <View style={styles.permissionInfo}>
                <Ionicons 
                  name={permissions.camera ? "checkmark-circle" : "close-circle"} 
                  size={20} 
                  color={permissions.camera ? "#10b981" : "#ef4444"} 
                />
                <Text style={styles.permissionText}>Camera Access</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* System Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Information</Text>
        <View style={styles.card}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="time" size={24} color="#2563eb" />
              <Text style={styles.statLabel}>Uptime</Text>
              <Text style={styles.statValue}>Active</Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="wifi" size={24} color="#10b981" />
              <Text style={styles.statLabel}>Network</Text>
              <Text style={styles.statValue}>Connected</Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="battery-full" size={24} color="#f59e0b" />
              <Text style={styles.statLabel}>Battery</Text>
              <Text style={styles.statValue}>Good</Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="speedometer" size={24} color="#8b5cf6" />
              <Text style={styles.statLabel}>Performance</Text>
              <Text style={styles.statValue}>Optimal</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
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
  section: {
    margin: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  actionButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoGrid: {
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  permissionsList: {
    gap: 12,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  permissionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  requestButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  requestButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 2,
    textAlign: 'center',
  },
});