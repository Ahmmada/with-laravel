import { useEffect, useState } from 'react';
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
  StatusBar
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '@/components/SearchBar'; // استيراد مكون SearchBar
type Group = {
  id: number;
  name: string;
};

export default function GroupsScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchGroups = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('groups').select('*').order('id', { ascending: true });
    if (error) Alert.alert('خطأ', error.message);
    else {
      setGroups(data || []);
      setFilteredGroups(data || []); // يتم تحديثها هنا أيضًا لضمان التزامن
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // وظيفة البحث
  // هذا الـ useEffect يجب أن يبقى هنا لتحديث filteredGroups بناءً على searchQuery و groups
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredGroups(groups);
    } else {
      const filtered = groups.filter(group =>
        group.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredGroups(filtered);
    }
  }, [searchQuery, groups]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال اسم المجموعة');
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from('groups')
        .update({ name })
        .eq('id', editingId);

      if (error) Alert.alert('خطأ', error.message);
      else {
        setModalVisible(false);
        setEditingId(null);
        setName('');
        fetchGroups();
      }
    } else {
      const { error } = await supabase.from('groups').insert([{ name }]);
      if (error) Alert.alert('خطأ', error.message);
      else {
        setModalVisible(false);
        setName('');
        fetchGroups();
      }
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'تأكيد الحذف', 
      'هل تريد حذف هذه المجموعة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('groups').delete().eq('id', id);
            if (error) Alert.alert('خطأ', error.message);
            else {
              fetchGroups();
              setSearchQuery(''); // إعادة تعيين البحث بعد الحذف
            }
          },
        },
      ]
    );
  };

  const renderGroupItem = ({ item, index }: { item: Group; index: number }) => (
    <View style={styles.groupItem}>
      <View style={styles.groupInfo}>
        <View style={styles.serialNumber}>
          <Text style={styles.serialText}>{index + 1}</Text>
        </View>
        <View style={styles.groupDetails}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupId}>رقم التعريف: {item.id}</Text>
        </View>
      </View>
      <View style={styles.groupActions}>
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
        {searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد مجموعات حتى الآن'}
      </Text>
      <Text style={styles.emptyStateSubtext}>
        {searchQuery ? `عن "${searchQuery}"` : 'ابدأ بإنشاء مجموعة جديدة'}
      </Text>
    </View>
  );

  const ResultsCount = () => (
    <View style={styles.resultsContainer}>
      <Text style={styles.resultsText}>
        {filteredGroups.length} من {groups.length} مجموعة
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      <View style={styles.header}>
        <Text style={styles.title}>المجموعات</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add-circle" size={24} color="white" />
          <Text style={styles.addButtonText}>مجموعة جديدة</Text>
        </TouchableOpacity>
      </View>

      {/* استخدام مكون SearchBar الجديد هنا */}
      <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      {searchQuery.length > 0 && groups.length > 0 && <ResultsCount />}

      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item.id.toString()}
        refreshing={loading}
        onRefresh={fetchGroups}
        renderItem={renderGroupItem}
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
                {editingId ? 'تعديل المجموعة' : 'إنشاء مجموعة جديدة'}
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
              <Text style={styles.label}>اسم المجموعة</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="أدخل اسم المجموعة"
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
  container: {
    flex: 1,
    backgroundColor: '#f8fafc', // bg-slate-50
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0', // border-slate-200
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  // تم نقل styles الخاصة بـ searchContainer و searchIcon و searchInput إلى SearchBar.tsx
  resultsContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 14,
    color: '#64748b', // text-slate-500
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20, // لتوفير مساحة أسفل القائمة
  },
  groupItem: {
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
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  serialNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serialText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  groupId: {
    fontSize: 12,
    color: '#6b7280',
  },
  groupActions: {
    flexDirection: 'row',
    gap: 8,
  }, 
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editButton: {
    backgroundColor: '#eff6ff',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
  },
  editText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  separator: {
    height: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#6b7280',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
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
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
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
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  saveButton: {
    backgroundColor: '#6366f1',
  },
  cancelText: {
    color: '#374151',
    fontWeight: '600',
  },
  saveText: {
    color: 'white',
    fontWeight: '600',
  },
});

