import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsTab() {
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [shareLocation, setShareLocation] = useState(true);
  const [shareContacts, setShareContacts] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('appSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setAutoReconnect(parsed.autoReconnect ?? true);
        setShareLocation(parsed.shareLocation ?? true);
        setShareContacts(parsed.shareContacts ?? false);
        setBackgroundMode(parsed.backgroundMode ?? true);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: any) => {
    try {
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const updateSetting = (key: string, value: boolean) => {
    const newSettings = {
      autoReconnect,
      shareLocation,
      shareContacts,
      backgroundMode,
      [key]: value,
    };
    
    switch (key) {
      case 'autoReconnect':
        setAutoReconnect(value);
        break;
      case 'shareLocation':
        setShareLocation(value);
        break;
      case 'shareContacts':
        setShareContacts(value);
        break;
      case 'backgroundMode':
        setBackgroundMode(value);
        break;
    }
    
    saveSettings(newSettings);
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will remove all saved settings and connection data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('Success', 'All data cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  const SettingRow = ({ 
    title, 
    subtitle, 
    value, 
    onValueChange, 
    icon 
  }: {
    title: string;
    subtitle: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    icon: string;
  }) => (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Ionicons name={icon as any} size={24} color="#2563eb" />
        <View style={styles.settingTexts}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
        thumbColor={value ? '#2563eb' : '#f3f4f6'}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection</Text>
        <View style={styles.settingsCard}>
          <SettingRow
            title="Auto Reconnect"
            subtitle="Automatically reconnect when connection is lost"
            value={autoReconnect}
            onValueChange={(value) => updateSetting('autoReconnect', value)}
            icon="refresh"
          />
          
          <SettingRow
            title="Background Mode"
            subtitle="Keep connection active in background"
            value={backgroundMode}
            onValueChange={(value) => updateSetting('backgroundMode', value)}
            icon="moon"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.settingsCard}>
          <SettingRow
            title="Share Location"
            subtitle="Allow server to access device location"
            value={shareLocation}
            onValueChange={(value) => updateSetting('shareLocation', value)}
            icon="location"
          />
          
          <SettingRow
            title="Share Contacts"
            subtitle="Allow server to backup device contacts"
            value={shareContacts}
            onValueChange={(value) => updateSetting('shareContacts', value)}
            icon="people"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={clearAllData}>
          <Ionicons name="trash" size={20} color="#ffffff" />
          <Text style={styles.dangerButtonText}>Clear All Data</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Remote Device Manager v1.0.0</Text>
        <Text style={styles.footerSubtext}>Secure • Private • Reliable</Text>
      </View>
    </View>
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
  settingsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTexts: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  dangerButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
  },
  dangerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    padding: 20,
    marginTop: 40,
  },
  footerText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
  },
  footerSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
});