// app/(tabs)/students.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList, // على الرغم من عدم استخدامها مباشرة، قد تكون مفيدة لاحقًا
  ActivityIndicator,
  StyleSheet,
  Alert,
  Pressable,
  TextInput,
  Modal,
  RefreshControl,
  ScrollView,
} from 'react-native';
// import axios from 'axios'; // لم نعد نحتاجه لجلب البيانات
import { AntDesign, Entypo } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import DatePickerInput from '../../components/DatePickerInput';
import { supabase } from '../../lib/supabase';

// تعريف الأنواع (تأكد من مطابقتها لهيكل جدولك في Supabase)
export interface Student {
  id: number;
  name: string;
  birth_date: string;
  address: string;
  phone: string;
  notes?: string;
  center_id: number;
  level_id: number;
  created_at: string;
  updated_at: string;
}

export interface Center {
  id: number;
  name: string;
}

export interface Level {
  id: number;
  name: string;
}

export default function StudentsScreen() {
   const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // حقول النموذج
  const [studentName, setStudentName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedCenterId, setSelectedCenterId] = useState<number | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
  const [centers, setCenters] = useState<Center[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);

  // جلب الطلاب من Supabase
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }
      setStudents(data as Student[]);
    } catch (error: any) {
      Alert.alert('خطأ', 'فشل جلب الطلاب من Supabase: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // جلب المراكز والمستويات من Supabase
  const fetchRelatedData = useCallback(async () => {
    try {
      // جلب المراكز
      const { data: centersData, error: centersError } = await supabase
        .from('centers') // اسم جدول المراكز في Supabase
        .select('*')
        .order('name', { ascending: true });

      if (centersError) {
        throw centersError;
      }
      setCenters(centersData as Center[]);

      // جلب المستويات
      const { data: levelsData, error: levelsError } = await supabase
        .from('levels') // اسم جدول المستويات في Supabase
        .select('*')
        .order('name', { ascending: true });

      if (levelsError) {
        throw levelsError;
      }
      setLevels(levelsData as Level[]);

    } catch (error: any) {
      Alert.alert('خطأ', 'فشل جلب بيانات المراكز أو المستويات من Supabase: ' + error.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStudents();
      fetchRelatedData();
    }, [fetchStudents, fetchRelatedData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStudents();
  }, [fetchStudents]);

  // إعادة تعيين النموذج
  const resetFormData = () => {
    setEditingStudentId(null);
    setStudentName('');
    setBirthDate('');
    setAddress('');
    setPhone('');
    setNotes('');
    setSelectedCenterId(null);
    setSelectedLevelId(null);
  };

  // إضافة / تعديل طالب في Supabase
  const handleAddOrUpdate = async () => {
    if (
      !studentName.trim() ||
      !birthDate.trim() ||
      !address.trim() ||
      !phone.trim() ||
      selectedCenterId === null ||
      selectedLevelId === null
    ) {
      Alert.alert('خطأ', 'يرجى تعبئة جميع الحقول المطلوبة.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: studentName,
        birth_date: birthDate,
        address,
        phone,
        notes,
        center_id: selectedCenterId,
        level_id: selectedLevelId,
      };

      if (editingStudentId) {
        // تحديث طالب
        const { error } = await supabase
          .from('students')
          .update(payload)
          .eq('id', editingStudentId);

        if (error) throw error;
        Alert.alert('نجاح', 'تم تعديل الطالب في Supabase.');
      } else {
        // إضافة طالب جديد
        const { error } = await supabase
          .from('students')
          .insert([payload]);

        if (error) throw error;
        Alert.alert('نجاح', 'تم إضافة الطالب إلى Supabase.');
      }
      setIsModalVisible(false);
      resetFormData();
      fetchStudents();
    } catch (error: any) {
      Alert.alert('خطأ', 'فشل العملية في Supabase: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // حذف طالب من Supabase
  const handleDelete = (id: number) =>
    Alert.alert('تأكيد الحذف', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const { error } = await supabase
              .from('students')
              .delete()
              .eq('id', id);

            if (error) throw error;
            Alert.alert('نجاح', 'تم حذف الطالب من Supabase.');
            fetchStudents();
          } catch (error: any) {
            Alert.alert('خطأ', 'فشل الحذف من Supabase: ' + error.message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);

  const handleEditPress = (s: Student) => {
    setEditingStudentId(s.id);
    setStudentName(s.name);
    setBirthDate(s.birth_date);
    setAddress(s.address);
    setPhone(s.phone);
    setNotes(s.notes || '');
    setSelectedCenterId(s.center_id);
    setSelectedLevelId(s.level_id);
    setIsModalVisible(true);
  };

  // وظائف مساعدة للعرض للعثور على اسم المركز والمستوى
  const getCenterName = (centerId: number) => {
    const center = centers.find(c => c.id === centerId);
    return center ? center.name : 'غير معروف';
  };

  const getLevelName = (levelId: number) => {
    const level = levels.find(l => l.id === levelId);
    return level ? level.name : 'غير معروف';
  };

  // مكون الرأس المثبت
  const StickyHeader = () => (
    <View style={tableStyles.stickyHeader}>
      <View style={tableStyles.row}>
        <Text style={[tableStyles.cell, tableStyles.header, { flex: 2 }]}>الاسم</Text>
        <Text style={[tableStyles.cell, tableStyles.header]}>المركز</Text>
        <Text style={[tableStyles.cell, tableStyles.header]}>المستوى</Text>
        <Text style={[tableStyles.cell, tableStyles.header]}>الهاتف</Text>
        <Text style={[tableStyles.cell, tableStyles.header]}>العنوان</Text>
        <Text style={[tableStyles.cell, tableStyles.header]}>العمليات</Text>
      </View>
    </View>
  );

  const renderRow = ({ item }: { item: Student }) => (
    <View style={tableStyles.row}>
      <Text style={[tableStyles.cell, { flex: 2 }]} numberOfLines={1} ellipsizeMode="tail">
        {item.name}
      </Text>
      <Text style={tableStyles.cell}>{getCenterName(item.center_id)}</Text>
      <Text style={tableStyles.cell}>{getLevelName(item.level_id)}</Text>
      <Text style={tableStyles.cell}>{item.phone}</Text>
      <Text style={[tableStyles.cell, { flex: 1.5 }]}>{item.address}</Text>
      <View style={[tableStyles.cell, { flexDirection: 'row', justifyContent: 'center', gap: 4 }]}>
        <Pressable onPress={() => handleEditPress(item)} style={tableStyles.btnEdit}>
          <AntDesign name="edit" size={14} color="#fff" />
        </Pressable>
        <Pressable onPress={() => handleDelete(item.id)} style={tableStyles.btnDelete}>
          <AntDesign name="delete" size={14} color="#fff" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* رأس الشاشة */}
      <View style={styles.header}>
        <Text style={styles.title}>قائمة الطلاب</Text>
        <Pressable
          onPress={() => {
            resetFormData();
            setIsModalVisible(true);
          }}
          style={styles.addButton}
        >
          <Entypo name="add-user" size={16} color="#007BFF" />
          <Text style={styles.addButtonText}>إضافة طالب</Text>
        </Pressable>
      </View>

      {/* الجدول */}
      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loadingIndicator} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          style={{ direction: 'rtl' }}
        >
          <View style={[tableStyles.tableContainer, { direction: 'rtl' }]}>
            <StickyHeader />
            <ScrollView nestedScrollEnabled refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }>
              <View style={tableStyles.table}>
                {students.map((item) => (
                  <View key={item.id}>{renderRow({ item })}</View>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {/* Modal الإضافة / التعديل */}
      <Modal
        animationType="slide"
        transparent
        visible={isModalVisible}
        onRequestClose={() => {
          setIsModalVisible(false);
          resetFormData();
        }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingStudentId ? 'تعديل الطالب' : 'إضافة طالب جديد'}</Text>

              <TextInput
                style={styles.input}
                placeholder="الاسم"
                value={studentName}
                onChangeText={setStudentName}
                autoCapitalize="words"
              />

              <DatePickerInput
                value={birthDate}
                onDateChange={setBirthDate}
                placeholder="تاريخ الميلاد (YYYY-MM-DD)"
              />

              <TextInput style={styles.input} placeholder="العنوان" value={address} onChangeText={setAddress} />
              <TextInput
                style={styles.input}
                placeholder="رقم الهاتف"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="الملاحظات (اختياري)"
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedCenterId}
                  onValueChange={(v) => setSelectedCenterId(v)}
                  style={styles.picker}
                  mode="dropdown"
                >
                  <Picker.Item label="اختر المركز..." value={null} enabled={false} />
                  {centers.map((c) => (
                    <Picker.Item key={c.id} label={c.name} value={c.id} />
                  ))}
                </Picker>
              </View>

              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedLevelId}
                  onValueChange={(v) => setSelectedLevelId(v)}
                  style={styles.picker}
                  mode="dropdown"
                >
                  <Picker.Item label="اختر المستوى..." value={null} enabled={false} />
                  {levels.map((l) => (
                    <Picker.Item key={l.id} label={l.name} value={l.id} />
                  ))}
                </Picker>
              </View>

              <View style={styles.modalButtons}>
                <Pressable onPress={() => setIsModalVisible(false)} style={[styles.modalButton, styles.cancelButton]}>
                  <Text style={styles.buttonText}>إلغاء</Text>
                </Pressable>
                <Pressable onPress={handleAddOrUpdate} style={[styles.modalButton, styles.saveButton]}>
                  <Text style={styles.buttonText}>{editingStudentId ? 'حفظ' : 'إضافة'}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#343a40',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e9f5ff',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007BFF',
  },
  addButtonText: {
    marginLeft: 5,
    color: '#007BFF',
    fontWeight: '600',
  },
  loadingIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
  },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    textAlign: 'right',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  picker: { width: '100%', height: 50 },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: { backgroundColor: '#6C757D' },
  saveButton: { backgroundColor: '#28A745' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

const tableStyles = StyleSheet.create({
  tableContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9ecef',
    minWidth: 700,
  },
  table: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    alignItems: 'stretch',
    backgroundColor: '#fff',
  },
  cell: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    color: '#495057',
    textAlign: 'right',
    borderRightWidth: 1,
    borderRightColor: '#e9ecef',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: '#f1f3f5',
    fontWeight: 'bold',
    color: '#343a40',
    textAlign: 'center',
  },
  stickyHeader: {
    backgroundColor: '#f1f3f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    elevation: 2,
    zIndex: 10,
  },
  btnEdit: {
    backgroundColor: '#ffc107',
    padding: 7,
    borderRadius: 5,
    marginHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDelete: {
    backgroundColor: '#dc3545',
    padding: 7,
    borderRadius: 5,
    marginHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
