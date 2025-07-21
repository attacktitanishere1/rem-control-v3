import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsTab() {
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [allowFileAccess, setAllowFileAccess] = useState(true);
  const [allowContacts, setAllowContacts] = useState(false);
  const [allowLocation, setAllowLocation] = useState(false);
  const [allowScreenshots, setAllowScreenshots] = useState(false);
  const [allowCallLog, setAllowCallLog] = useState(false);
  const [allowSMS, setAllowSMS] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('appSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setAutoReconnect(parsed.autoReconnect ?? true);
        setAllowFileAccess(parsed.allowFileAccess ?? true);
        setAllowContacts(parsed.allowContacts ?? false);
        setAllowLocation(parsed.allowLocation ?? false);
        setAllowScreenshots(parsed.allowScreenshots ?? false);
        setAllowCallLog(parsed.allowCallLog ?? false);
        setAllowSMS(parsed.allowSMS ?? false);
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
      allowFileAccess,
      allowContacts,
      allowLocation,
      allowScreenshots,
      allowCallLog,
      allowSMS,
      [key]: value,
    };
    
    switch (key) {
      case 'autoReconnect':
        setAutoReconnect(value);
        break;
      case 'allowFileAccess':
        setAllowFileAccess(value);
        break;
      case 'allowContacts':
        setAllowContacts(value);
        break;
      case 'allowLocation':
        setAllowLocation(value);
        break;
      case 'allowScreenshots':
        setAllowScreenshots(value);
        break;
      case 'allowCallLog':
        setAllowCallLog(value);
        break;
      case 'allowSMS':
        setAllowSMS(value);
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
        <Text style={styles.sectionTitle}>Connection Settings</Text>
        <View style={styles.settingsCard}>
          <SettingRow
            title="Auto Reconnect"
            subtitle="Automatically reconnect when connection is lost"
            value={autoReconnect}
            onValueChange={(value) => updateSetting('autoReconnect', value)}
            icon="refresh"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Sharing Permissions</Text>
        <View style={styles.settingsCard}>
          <SettingRow
            title="File Access"
            subtitle="Allow server to browse and download files"
            value={allowFileAccess}
            onValueChange={(value) => updateSetting('allowFileAccess', value)}
            icon="folder"
          />
          
          <SettingRow
            title="Contacts Access"
            subtitle="Allow server to backup device contacts"
            value={allowContacts}
            onValueChange={(value) => updateSetting('allowContacts', value)}
            icon="people"
          />
          
          <SettingRow
            title="Location Access"
            subtitle="Allow server to access device location"
            value={allowLocation}
            onValueChange={(value) => updateSetting('allowLocation', value)}
            icon="location"
          />
          
          <SettingRow
            title="Screenshots"
            subtitle="Allow server to take screenshots"
            value={allowScreenshots}
            onValueChange={(value) => updateSetting('allowScreenshots', value)}
            icon="camera"
          />
          
          <SettingRow
            title="Call Log Access"
            subtitle="Allow server to access call history"
            value={allowCallLog}
            onValueChange={(value) => updateSetting('allowCallLog', value)}
            icon="call"
          />
          
          <SettingRow
            title="SMS Access"
            subtitle="Allow server to access text messages"
            value={allowSMS}
            onValueChange={(value) => updateSetting('allowSMS', value)}
            icon="chatbubble"
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
        <Text style={styles.footerSubtext}>HTTP File Server • Remote Access</Text>
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