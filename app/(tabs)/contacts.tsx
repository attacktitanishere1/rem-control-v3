import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useDeviceConnection } from '@/hooks/useDeviceConnection';
import * as Contacts from 'expo-contacts';

export default function ContactsTab() {
  const { isConnected, sendMessage } = useDeviceConnection();
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredContacts, setFilteredContacts] = useState<Contacts.Contact[]>([]);

  useEffect(() => {
    checkContactsPermission();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchQuery]);

  const checkContactsPermission = async () => {
    try {
      const { status } = await Contacts.getPermissionsAsync();
      if (status === 'granted') {
        loadContacts();
      }
    } catch (error) {
      console.error('Error checking contacts permission:', error);
    }
  };

  const requestContactsPermission = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        Alert.alert('Success', 'Contacts permission granted');
        loadContacts();
      } else {
        Alert.alert('Permission Denied', 'Contacts permission was not granted');
      }
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
    }
  };

  const loadContacts = async () => {
    setIsLoading(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
          Contacts.Fields.Image,
        ],
        pageSize: 0, // Get all contacts
        pageOffset: 0,
      });
      
      // Sort contacts alphabetically
      const sortedContacts = data.sort((a, b) => {
        const nameA = a.name || 'Unknown';
        const nameB = b.name || 'Unknown';
        return nameA.localeCompare(nameB);
      });
      
      setContacts(sortedContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setIsLoading(false);
    }
  };

  const filterContacts = () => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const filtered = contacts.filter(contact => {
      const name = contact.name?.toLowerCase() || '';
      const phone = contact.phoneNumbers?.[0]?.number || '';
      const email = contact.emails?.[0]?.email?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();

      return name.includes(query) || phone.includes(query) || email.includes(query);
    });

    setFilteredContacts(filtered);
  };

  const shareContacts = () => {
    if (!isConnected) {
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    if (contacts.length === 0) {
      Alert.alert('Error', 'No contacts to share');
      return;
    }

    sendMessage({
      type: 'contacts_backup',
      data: contacts
    });

    Alert.alert('Success', `${contacts.length} contacts shared with server`);
  };

  const shareSelectedContact = (contact: Contacts.Contact) => {
    if (!isConnected) {
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    sendMessage({
      type: 'contact_share',
      data: contact
    });

    Alert.alert('Success', `Contact "${contact.name || 'Unknown'}" shared with server`);
  };

  const getContactInitials = (name: string) => {
    if (!name) return '?';
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  };

  const formatPhoneNumber = (phoneNumber: string) => {
    // Simple phone number formatting
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phoneNumber;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Contacts</Text>
        <View style={[styles.statusIndicator, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
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

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity 
          style={[styles.actionButton, !isConnected && styles.disabledButton]} 
          onPress={loadContacts}
          disabled={isLoading}
        >
          <Ionicons name={isLoading ? "refresh" : "sync"} size={16} color="#ffffff" />
          <Text style={styles.actionButtonText}>
            {isLoading ? 'Loading...' : 'Refresh'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.shareButton, (!isConnected || contacts.length === 0) && styles.disabledButton]} 
          onPress={shareContacts}
          disabled={!isConnected || contacts.length === 0}
        >
          <Ionicons name="share" size={16} color="#ffffff" />
          <Text style={styles.actionButtonText}>Share All</Text>
        </TouchableOpacity>
      </View>

      {/* Contacts List */}
      <ScrollView style={styles.contactsList}>
        {filteredContacts.length > 0 ? (
          <View style={styles.contactsContainer}>
            {filteredContacts.map((contact, index) => (
              <View key={contact.id || index} style={styles.contactItem}>
                <View style={styles.contactInfo}>
                  <View style={styles.contactAvatar}>
                    {contact.image ? (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>
                          {getContactInitials(contact.name || 'Unknown')}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>
                          {getContactInitials(contact.name || 'Unknown')}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.contactDetails}>
                    <Text style={styles.contactName}>
                      {contact.name || 'Unknown Contact'}
                    </Text>
                    
                    {contact.phoneNumbers && contact.phoneNumbers.length > 0 && (
                      <Text style={styles.contactPhone}>
                        {formatPhoneNumber(contact.phoneNumbers[0].number || '')}
                      </Text>
                    )}
                    
                    {contact.emails && contact.emails.length > 0 && (
                      <Text style={styles.contactEmail}>
                        {contact.emails[0].email}
                      </Text>
                    )}
                    
                    <View style={styles.contactMeta}>
                      {contact.phoneNumbers && (
                        <Text style={styles.metaText}>
                          📞 {contact.phoneNumbers.length} phone{contact.phoneNumbers.length !== 1 ? 's' : ''}
                        </Text>
                      )}
                      {contact.emails && (
                        <Text style={styles.metaText}>
                          ✉️ {contact.emails.length} email{contact.emails.length !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={[styles.shareContactButton, !isConnected && styles.disabledButton]}
                  onPress={() => shareSelectedContact(contact)}
                  disabled={!isConnected}
                >
                  <Ionicons name="share-outline" size={16} color="#2563eb" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : contacts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No Contacts</Text>
            <Text style={styles.emptySubtitle}>
              {isLoading 
                ? 'Loading contacts...'
                : 'Tap "Refresh" to load contacts or grant contacts permission'
              }
            </Text>
            
            {!isLoading && (
              <TouchableOpacity 
                style={styles.permissionButton} 
                onPress={requestContactsPermission}
              >
                <Ionicons name="key" size={16} color="#ffffff" />
                <Text style={styles.permissionButtonText}>Grant Permission</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No Results</Text>
            <Text style={styles.emptySubtitle}>
              No contacts match your search query
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Stats Footer */}
      {contacts.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{contacts.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {contacts.filter(c => c.phoneNumbers && c.phoneNumbers.length > 0).length}
              </Text>
              <Text style={styles.statLabel}>With Phone</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {contacts.filter(c => c.emails && c.emails.length > 0).length}
              </Text>
              <Text style={styles.statLabel}>With Email</Text>
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
  actionSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
  },
  shareButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  contactsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contactsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contactAvatar: {
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 14,
    color: '#2563eb',
    marginBottom: 2,
  },
  contactEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  contactMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  shareContactButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
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
  permissionButton: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
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