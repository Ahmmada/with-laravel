// LevelsScreen.tsx
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Alert,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '@/components/SearchBar';
import {
  initDb,
  getLocalLevels,
  insertLocalLevel,
  updateLocalLevel,
  deleteLocalLevel,
  getUnsyncedChanges,
  clearSyncedChange,
  updateLocalLevelSupabaseId,
  Level,
} from '@/lib/localDb';
import NetInfo from '@react-native-community/netinfo';
import * as SQLite from 'expo-sqlite';

export default function LevelsScreen() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [filteredLevels, setFilteredLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

useEffect(() => {
  const initializeApp = async () => {
    try {
      await initDb(); // تأكد من أنها تكتمل
      console.log('✅ Database initialized');

      const unsubscribe = NetInfo.addEventListener(state => {
        setIsConnected(state.isConnected);
        if (state.isConnected) {
          syncDataWithSupabase();
        }
      });

      await fetchLevels(); // جلب البيانات بعد التهيئة
      return () => unsubscribe();
    } catch (error) {
      console.error('❌ Failed to initialize DB:', error);
      Alert.alert('خطأ', 'فشل في تهيئة قاعدة البيانات المحلية');
    }
  };

  initializeApp();
}, []);

  const fetchLevels = useCallback(async () => {
    setLoading(true);
    try {
      const localData = await getLocalLevels();
      setLevels(localData);
      setFilteredLevels(localData);
    } catch (error: any) {
      Alert.alert('خطأ في جلب البيانات المحلية', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncDataWithSupabase = useCallback(async () => {
    if (!isConnected) {
      console.log('Not connected to internet, skipping sync.');
      return;
    }
    console.log('Attempting to sync data with Supabase...');

    try {
      const unsyncedChanges = await getUnsyncedChanges();

      for (const change of unsyncedChanges) {
        try {
          if (change.entity === 'levels') {
            const payload = JSON.parse(change.payload);

            if (change.operation === 'INSERT') {
              const { data, error } = await supabase
                .from('levels')
                .insert([{ 
                  name: payload.name,
                  created_at: payload.created_at || new Date().toISOString()
                }])
                .select();
              if (error) throw error;
              if (data && data.length > 0) {
                await updateLocalLevelSupabaseId(change.entity_local_id, data[0].id);
                await clearSyncedChange(change.id);
              }
            } else if (change.operation === 'UPDATE') {
              const { error } = await supabase
                .from('levels')
                .update({ 
                  name: payload.name,
                  updated_at: payload.updated_at || new Date().toISOString()
                })
                .eq('id', change.entity_supabase_id);
              if (error) throw error;
              await clearSyncedChange(change.id);
            } else if (change.operation === 'DELETE') {
              const { error } = await supabase
                .from('levels')
                .update({ 
                  deleted_at: payload.deleted_at || new Date().toISOString()
                })
                .eq('id', change.entity_supabase_id);
              if (error) throw error;
              await clearSyncedChange(change.id);
            }
          }
        } catch (error: any) {
          console.error(`Error syncing change ${change.id}:`, error.message);
          Alert.alert('خطأ في المزامنة', `حدث خطأ أثناء مزامنة: ${error.message}`);
        }
      }

      console.log('Sync complete. Re-fetching local data.');
      await fetchLevels();
      await fetchRemoteLevelsAndMerge();
    } catch (error: any) {
      console.error('Unexpected error during sync:', error.message);
    }
  }, [isConnected, fetchLevels]);

  const fetchRemoteLevelsAndMerge = async () => {
    if (!isConnected) return;

    console.log('Fetching remote levels and merging...');
    try {
      const { data, error } = await supabase
        .from('levels')
        .select('*')
        .order('id', { ascending: true });
      if (error) throw error;

      if (data) {
        const remoteLevels = data;
        const localLevels = await getLocalLevels();
        const db = await SQLite.openDatabaseAsync('appl.db');

        for (const remoteLevel of remoteLevels) {
          const exists = localLevels.some(l => l.supabase_id === remoteLevel.id);
          if (!exists) {
            await db.runAsync(
              'INSERT OR IGNORE INTO levels (name, supabase_id, is_synced, operation_type, created_at) VALUES (?, ?, 1, NULL, ?);',
              [remoteLevel.name, remoteLevel.id, remoteLevel.created_at || new Date().toISOString()]
            );
          }
        }

        await fetchLevels();
      }
    } catch (error: any) {
      console.error('Error fetching remote levels for merge:', error.message);
      Alert.alert('خطأ في جلب بيانات Supabase', error.message);
    }
  };

  useEffect(() => {
    fetchLevels();
    if (isConnected) {
      syncDataWithSupabase();
    }
  }, [fetchLevels, isConnected, syncDataWithSupabase]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredLevels(levels);
    } else {
      setFilteredLevels(
        levels.filter(level =>
          level.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, levels]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال اسم المستوى');
      return;
    }

    try {
      if (editingId) {
        await updateLocalLevel(editingId, name);
      } else {
        await insertLocalLevel({ name });
      }

      setName('');
      setEditingId(null);
      setModalVisible(false);
      await fetchLevels();

      if (isConnected) {
        await syncDataWithSupabase();
      }
    } catch (error: any) {
      Alert.alert('خطأ', error.message);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'تأكيد الحذف',
      'هل تريد حذف هذا المستوى؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLocalLevel(id);
              await fetchLevels();
              setSearchQuery('');

              if (isConnected) {
                await syncDataWithSupabase();
              }
            } catch (error: any) {
              Alert.alert('خطأ في الحذف', error.message);
            }
          },
        },
      ]
    );
  };

  const renderLevelItem = ({ item, index }: { item: Level; index: number }) => (
    <View style={styles.levelItem}>
      <View style={styles.levelInfo}>
        <View style={styles.serialNumber}>
          <Text style={styles.serialText}>{index + 1}</Text>
        </View>
        <View style={styles.levelDetails}>
          <Text style={styles.levelName}>{item.name}</Text>
          <Text style={styles.levelId}>رقم التعريف (محلي): {item.id}</Text>
          {item.supabase_id && (
            <Text style={styles.levelId}>رقم التعريف (Supabase): {item.supabase_id}</Text>
          )}
          {item.operation_type && (
            <Text style={styles.levelId}>
              حالة المزامنة:{' '}
              <Text style={{ color: 'orange', fontWeight: 'bold' }}>
                معلق ({item.operation_type})
              </Text>
            </Text>
          )}
        </View>
      </View>
      <View style={styles.levelActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => {
            setEditingId(item.id);
            setName(item.name);
            setModalVisible(true);
          }}
        >
          <Ionicons name="create-outline" size={18} color="#3b82f6" />
          <Text style={styles.editText}>تعديل</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item.id)}
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
          <Text style={styles.deleteText}>حذف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="folder-open-outline" size={64} color="#d1d5db" />
      <Text style={styles.emptyStateText}>
        {searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد مستويات حتى الآن'}
      </Text>
      <Text style={styles.emptyStateSubtext}>
        {searchQuery ? `عن "${searchQuery}"` : 'ابدأ بإنشاء مستوى جديدة'}
      </Text>
    </View>
  );

  const ResultsCount = () => (
    <View style={styles.resultsContainer}>
      <Text style={styles.resultsText}>
        {filteredLevels.length} من {levels.length} مستوى
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <View style={styles.header}>
        <Text style={styles.title}>المستويات</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={24} color="white" />
          <Text style={styles.addButtonText}>مستوى جديدة</Text>
        </TouchableOpacity>
      </View>

      {isConnected !== null && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: isConnected ? '#dcfce7' : '#fee2e2',
          }}
        >
          <Text
            style={{
              color: isConnected ? '#16a34a' : '#dc2626',
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          >
            {isConnected ? 'متصل بالإنترنت' : 'غير متصل بالإنترنت'}
          </Text>
        </View>
      )}

      <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      {searchQuery.length > 0 && levels.length > 0 && <ResultsCount />}

      <FlatList
        data={filteredLevels}
        keyExtractor={item => item.id.toString()}
        refreshing={loading}
        onRefresh={async () => {
          await fetchLevels();
          if (isConnected) {
            await syncDataWithSupabase();
          }
        }}
        renderItem={renderLevelItem}
        ListEmptyComponent={EmptyState}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setModalVisible(false);
          setEditingId(null);
          setName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? 'تعديل المستوى' : 'إنشاء مستوى جديدة'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setModalVisible(false);
                  setEditingId(null);
                  setName('');
                }}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>اسم المستوى</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="أدخل اسم المستوى"
                style={styles.input}
                autoFocus
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setEditingId(null);
                  setName('');
                }}
              >
                <Text style={styles.cancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={styles.saveText}>{editingId ? 'تحديث' : 'إنشاء'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1e293b' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  resultsContainer: { marginHorizontal: 16, marginBottom: 12 },
  resultsText: { fontSize: 14, color: '#64748b' },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  levelItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  levelInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  serialNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serialText: { fontSize: 14, fontWeight: 'bold', color: '#6366f1' },
  levelDetails: { flex: 1 },
  levelName: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 2 },
  levelId: { fontSize: 12, color: '#6b7280' },
  levelActions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editButton: { backgroundColor: '#eff6ff' },
  deleteButton: { backgroundColor: '#fef2f2' },
  editText: { color: '#3b82f6', fontSize: 12, fontWeight: '600' },
  deleteText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
  separator: { height: 8 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: { fontSize: 18, color: '#6b7280', marginTop: 16 },
  emptyStateSubtext: { fontSize: 14, color: '#9ca3af', marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  closeButton: { padding: 4 },
  modalBody: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#1e293b',
    textAlign: 'right',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: { backgroundColor: '#f3f4f6' },
  saveButton: { backgroundColor: '#6366f1' },
  cancelText: { color: '#374151', fontWeight: '600' },
  saveText: { color: 'white', fontWeight: '600' },
});
