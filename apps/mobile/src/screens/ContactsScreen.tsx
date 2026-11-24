import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createContact,
  deleteContact,
  EmergencyContactItem,
  listContacts,
} from '../api/auth';

export function ContactsScreen(): React.JSX.Element {
  const [contacts, setContacts] = useState<EmergencyContactItem[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [fcmToken, setFcmToken] = useState('');

  const loadContacts = useCallback(async () => {
    try {
      const data = await listContacts();
      setContacts(data);
    } catch {
      Alert.alert('Error', 'Unable to load emergency contacts.');
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const handleAddContact = async (): Promise<void> => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Required', 'Enter contact name and phone.');
      return;
    }
    try {
      const created = await createContact({
        name: name.trim(),
        phone: phone.trim(),
        ...(relation.trim() ? { relation: relation.trim() } : {}),
        ...(fcmToken.trim() ? { fcmToken: fcmToken.trim() } : {}),
      });
      setContacts((prev) => [...prev, created]);
      setName('');
      setPhone('');
      setRelation('');
      setFcmToken('');
    } catch {
      Alert.alert('Error', 'Could not add emergency contact.');
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch {
      Alert.alert('Error', 'Failed to remove contact.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Add Emergency Contact</Text>
      <TextInput
        style={styles.input}
        placeholder="Name"
        placeholderTextColor="#64748B"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Phone (+91...)"
        placeholderTextColor="#64748B"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextInput
        style={styles.input}
        placeholder="Relation (optional)"
        placeholderTextColor="#64748B"
        value={relation}
        onChangeText={setRelation}
      />
      <TextInput
        style={styles.input}
        placeholder="FCM Device Token (optional)"
        placeholderTextColor="#64748B"
        value={fcmToken}
        onChangeText={setFcmToken}
      />
      <Pressable
        style={styles.addButton}
        onPress={() => void handleAddContact()}
      >
        <Text style={styles.addButtonText}>Add Contact</Text>
      </Pressable>

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.phone} {item.relation ? `(${item.relation})` : ''}
              </Text>
            </View>
            <Pressable onPress={() => void handleDelete(item.id)}>
              <Text style={styles.deleteText}>Remove</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 16,
  },
  heading: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  name: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  meta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  deleteText: {
    color: '#F87171',
    fontWeight: '700',
  },
});
