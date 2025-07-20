import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useDeviceConnection } from '@/hooks/useDeviceConnection';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';

export default function StatusTab() {
  const { isConnected, sendMessage } = useDeviceConnection();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [permissions, setPermissions] = useState({
    location: false,
    contacts: false,
  });

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const locationPermission = await Location.requestForegroundPermissionsAsync();
    const contactsPermission = await Contacts.requestPermissionsAsync();
    
    setPermissions({
      location: locationPermission.status === 'granted',
      contacts: contactsPermission.status === 'granted',
    });

    if (locationPermission.status === 'granted') {
      getCurrentLocation();
    }

    if (contactsPermission.status === 'granted') {
      loadContacts();
    }
  };

  const getCurrentLocation = async () => {
    try {
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      
      if (isConnected) {
        sendMessage({
          type: 'location_update',
          data: {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            timestamp: new Date().toISOString(),
          }
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const loadContacts = async () => {
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });
      setContacts(data);
      
      if (isConnected) {
        sendMessage({
          type: 'contacts_update',
          data: data.slice(0, 10) // Send first 10 contacts for preview
        });
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const shareLocation = () => {
    if (!permissions.location) {
      Alert.alert('Permission Required', 'Location permission is required to share location');
      return;
    }
    getCurrentLocation();
  };

  const shareContacts = () => {
    if (!permissions.contacts) {
      Alert.alert('Permission Required', 'Contacts permission is required to share contacts');
      return;
    }
    
    if (isConnected) {
      sendMessage({
        type: 'contacts_backup',
        data: contacts
      });
      Alert.alert('Success', 'Contacts backup sent to server');
    } else {
      Alert.alert('Error', 'Not connected to server');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Device Status</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection Status</Text>
        <View style={styles.statusCard}>
          <Ionicons 
            name={isConnected ? "checkmark-circle" : "close-circle"} 
            size={24} 
            color={isConnected ? "#10b981" : "#ef4444"} 
          />
          <Text style={styles.statusText}>
            {isConnected ? 'Connected to Server' : 'Disconnected'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location Services</Text>
        <View style={styles.permissionCard}>
          <View style={styles.permissionRow}>
            <Ionicons 
              name={permissions.location ? "checkmark-circle" : "close-circle"} 
              size={20} 
              color={permissions.location ? "#10b981" : "#ef4444"} 
            />
            <Text style={styles.permissionText}>
              Location Permission: {permissions.location ? 'Granted' : 'Denied'}
            </Text>
          </View>
          
          {location && (
            <View style={styles.locationInfo}>
              <Text style={styles.infoText}>
                Lat: {location.coords.latitude.toFixed(6)}
              </Text>
              <Text style={styles.infoText}>
                Lng: {location.coords.longitude.toFixed(6)}
              </Text>
            </View>
          )}
          
          <TouchableOpacity style={styles.actionButton} onPress={shareLocation}>
            <Text style={styles.actionButtonText}>Share Location</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contacts</Text>
        <View style={styles.permissionCard}>
          <View style={styles.permissionRow}>
            <Ionicons 
              name={permissions.contacts ? "checkmark-circle" : "close-circle"} 
              size={20} 
              color={permissions.contacts ? "#10b981" : "#ef4444"} 
            />
            <Text style={styles.permissionText}>
              Contacts Permission: {permissions.contacts ? 'Granted' : 'Denied'}
            </Text>
          </View>
          
          {contacts.length > 0 && (
            <Text style={styles.infoText}>
              Total Contacts: {contacts.length}
            </Text>
          )}
          
          <TouchableOpacity style={styles.actionButton} onPress={shareContacts}>
            <Text style={styles.actionButtonText}>Backup Contacts</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device Info</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>Platform: {require('expo-constants').default.platform?.ios ? 'iOS' : 'Android'}</Text>
          <Text style={styles.infoText}>App Version: 1.0.0</Text>
          <Text style={styles.infoText}>Last Updated: {new Date().toLocaleString()}</Text>
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
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
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
  statusCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statusText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  permissionCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  permissionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1f2937',
  },
  locationInfo: {
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  actionButton: {
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
});