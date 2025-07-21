import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useDeviceConnection } from '@/hooks/useDeviceConnection';
import * as Location from 'expo-location';

export default function GPSTab() {
  const { isConnected, sendMessage } = useDeviceConnection();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [locationHistory, setLocationHistory] = useState<any[]>([]);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Location permission is required to share GPS data',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Grant Permission', onPress: requestLocationPermission },
          ]
        );
      }
    } catch (error) {
      console.error('Error checking location permission:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        Alert.alert('Success', 'Location permission granted');
        getCurrentLocation();
      } else {
        Alert.alert('Permission Denied', 'Location permission was not granted');
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const getCurrentLocation = async () => {
    if (!isConnected) {
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    setIsLoading(true);
    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setLocation(currentLocation);
      
      const locationData = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        altitude: currentLocation.coords.altitude,
        accuracy: currentLocation.coords.accuracy,
        speed: currentLocation.coords.speed,
        heading: currentLocation.coords.heading,
        timestamp: new Date().toISOString(),
      };

      // Add to history
      setLocationHistory(prev => [locationData, ...prev.slice(0, 9)]); // Keep last 10 locations

      // Send to server
      sendMessage({
        type: 'location_update',
        data: locationData
      });

      Alert.alert('Success', 'Location shared with server');
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get current location');
    } finally {
      setIsLoading(false);
    }
  };

  const startLocationTracking = async () => {
    if (!isConnected) {
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        await requestLocationPermission();
        return;
      }

      setIsTracking(true);
      
      // Start watching position
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (newLocation) => {
          setLocation(newLocation);
          
          const locationData = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            altitude: newLocation.coords.altitude,
            accuracy: newLocation.coords.accuracy,
            speed: newLocation.coords.speed,
            heading: newLocation.coords.heading,
            timestamp: new Date().toISOString(),
          };

          // Add to history
          setLocationHistory(prev => [locationData, ...prev.slice(0, 9)]);

          // Send to server
          sendMessage({
            type: 'location_update',
            data: locationData
          });
        }
      );

      Alert.alert('Success', 'Location tracking started');
      
      // Store subscription for cleanup
      return subscription;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      Alert.alert('Error', 'Failed to start location tracking');
      setIsTracking(false);
    }
  };

  const stopLocationTracking = () => {
    setIsTracking(false);
    Alert.alert('Success', 'Location tracking stopped');
  };

  const formatCoordinate = (coord: number, type: 'lat' | 'lng') => {
    const direction = type === 'lat' ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');
    return `${Math.abs(coord).toFixed(6)}° ${direction}`;
  };

  const formatSpeed = (speed: number | null) => {
    if (!speed) return 'N/A';
    return `${(speed * 3.6).toFixed(1)} km/h`; // Convert m/s to km/h
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>GPS Location</Text>
        <View style={[styles.statusIndicator, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
      </View>

      {/* Current Location */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Location</Text>
        <View style={styles.card}>
          {location ? (
            <View style={styles.locationInfo}>
              <View style={styles.coordinateRow}>
                <Ionicons name="location" size={20} color="#2563eb" />
                <View style={styles.coordinateInfo}>
                  <Text style={styles.coordinateLabel}>Latitude</Text>
                  <Text style={styles.coordinateValue}>
                    {formatCoordinate(location.coords.latitude, 'lat')}
                  </Text>
                </View>
              </View>
              
              <View style={styles.coordinateRow}>
                <Ionicons name="location" size={20} color="#2563eb" />
                <View style={styles.coordinateInfo}>
                  <Text style={styles.coordinateLabel}>Longitude</Text>
                  <Text style={styles.coordinateValue}>
                    {formatCoordinate(location.coords.longitude, 'lng')}
                  </Text>
                </View>
              </View>
              
              {location.coords.altitude && (
                <View style={styles.coordinateRow}>
                  <Ionicons name="trending-up" size={20} color="#2563eb" />
                  <View style={styles.coordinateInfo}>
                    <Text style={styles.coordinateLabel}>Altitude</Text>
                    <Text style={styles.coordinateValue}>
                      {location.coords.altitude.toFixed(1)} m
                    </Text>
                  </View>
                </View>
              )}
              
              <View style={styles.coordinateRow}>
                <Ionicons name="radio" size={20} color="#2563eb" />
                <View style={styles.coordinateInfo}>
                  <Text style={styles.coordinateLabel}>Accuracy</Text>
                  <Text style={styles.coordinateValue}>
                    ±{location.coords.accuracy?.toFixed(1) || 'N/A'} m
                  </Text>
                </View>
              </View>
              
              {location.coords.speed && (
                <View style={styles.coordinateRow}>
                  <Ionicons name="speedometer" size={20} color="#2563eb" />
                  <View style={styles.coordinateInfo}>
                    <Text style={styles.coordinateLabel}>Speed</Text>
                    <Text style={styles.coordinateValue}>
                      {formatSpeed(location.coords.speed)}
                    </Text>
                  </View>
                </View>
              )}
              
              <View style={styles.timestampRow}>
                <Ionicons name="time" size={16} color="#6b7280" />
                <Text style={styles.timestamp}>
                  Last updated: {new Date(location.timestamp).toLocaleString()}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.noLocation}>
              <Ionicons name="location-outline" size={48} color="#d1d5db" />
              <Text style={styles.noLocationText}>No location data</Text>
              <Text style={styles.noLocationSubtext}>Tap "Get Location" to fetch current position</Text>
            </View>
          )}
          
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.primaryButton, isLoading && styles.disabledButton]} 
              onPress={getCurrentLocation}
              disabled={isLoading || !isConnected}
            >
              <Ionicons name={isLoading ? "refresh" : "locate"} size={16} color="#ffffff" />
              <Text style={styles.primaryButtonText}>
                {isLoading ? 'Getting Location...' : 'Get Location'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                isTracking ? styles.dangerButton : styles.successButton,
                !isConnected && styles.disabledButton
              ]} 
              onPress={isTracking ? stopLocationTracking : startLocationTracking}
              disabled={!isConnected}
            >
              <Ionicons 
                name={isTracking ? "stop" : "play"} 
                size={16} 
                color="#ffffff" 
              />
              <Text style={styles.primaryButtonText}>
                {isTracking ? 'Stop Tracking' : 'Start Tracking'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Location History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location History</Text>
        <View style={styles.card}>
          {locationHistory.length > 0 ? (
            <View style={styles.historyList}>
              {locationHistory.map((loc, index) => (
                <View key={index} style={styles.historyItem}>
                  <View style={styles.historyHeader}>
                    <Ionicons name="location" size={16} color="#2563eb" />
                    <Text style={styles.historyTime}>
                      {new Date(loc.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                  <Text style={styles.historyCoords}>
                    {formatCoordinate(loc.latitude, 'lat')}, {formatCoordinate(loc.longitude, 'lng')}
                  </Text>
                  <Text style={styles.historyAccuracy}>
                    Accuracy: ±{loc.accuracy?.toFixed(1) || 'N/A'} m
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyHistory}>
              <Ionicons name="time-outline" size={32} color="#d1d5db" />
              <Text style={styles.emptyHistoryText}>No location history</Text>
            </View>
          )}
        </View>
      </View>

      {/* GPS Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GPS Settings</Text>
        <View style={styles.card}>
          <View style={styles.settingsList}>
            <View style={styles.settingRow}>
              <Ionicons name="settings" size={20} color="#6b7280" />
              <Text style={styles.settingText}>High Accuracy Mode</Text>
              <Text style={styles.settingValue}>Enabled</Text>
            </View>
            
            <View style={styles.settingRow}>
              <Ionicons name="time" size={20} color="#6b7280" />
              <Text style={styles.settingText}>Update Interval</Text>
              <Text style={styles.settingValue}>10 seconds</Text>
            </View>
            
            <View style={styles.settingRow}>
              <Ionicons name="navigate" size={20} color="#6b7280" />
              <Text style={styles.settingText}>Distance Threshold</Text>
              <Text style={styles.settingValue}>10 meters</Text>
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
  locationInfo: {
    marginBottom: 16,
  },
  coordinateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  coordinateInfo: {
    marginLeft: 12,
    flex: 1,
  },
  coordinateLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  coordinateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  timestamp: {
    marginLeft: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  noLocation: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noLocationText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  noLocationSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  successButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  dangerButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyTime: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  historyCoords: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 2,
  },
  historyAccuracy: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  settingsList: {
    gap: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563eb',
  },
});