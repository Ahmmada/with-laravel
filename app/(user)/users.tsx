// app/(tabs)/users.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router'; // استورد router

// نوع بيانات المستخدم (يمكنك توسيعه ليناسب احتياجاتك)
interface User {
  id: string; // user id from Supabase Auth
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  // أضف أي حقول أخرى تريد عرضها من ملف تعريف المستخدم (public.profiles)
  full_name?: string;
  role?: string;
}

const EmptyState = ({ loading }: { loading: boolean }) => (
  <View style={styles.emptyState}>
    {loading ? (
      <ActivityIndicator size="large" color="#6366f1" />
    ) : (
      <>
        <Ionicons name="people-outline" size={64} color="#d1d5db" />
        <Text style={styles.emptyStateText}>لا يوجد مستخدمون حتى الآن</Text>
        <Text style={styles.emptyStateSubtext}>ابدأ بدعوة مستخدمين جدد</Text>
      </>
    )}
  </View>
);


export default function UsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null); // لتخزين بيانات المستخدم الحالي

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    try {
      // جلب المستخدم الحالي
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // جلب قائمة المستخدمين من Supabase (يتطلب سياسات RLS مناسبة)
      // ملاحظة: لجلب جميع المستخدمين، يجب أن يكون لديك إذن "supabase_admin" أو "service_role"
      // في Supabase، يمكن لمستخدمي المصادقة العاديين رؤية بياناتهم فقط
      // سأفترض أنك ستنشئ جدولاً لملفات تعريف المستخدمين (profiles) وسنقوم بجدبه
      // للحصول على قائمة جميع المستخدمين، ستحتاج إلى استخدام مفتاح service_role في بيئة خلفية آمنة
      // أو إنشاء دالة Supabase Edge Function تقوم بذلك.
      // هنا، سنقوم بجلب الملفات الشخصية المرتبطة بالمستخدمين المصادقين.
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles') // اسم الجدول الذي ستنشئه لملفات تعريف المستخدمين
        .select('id, email, full_name, role'); // الحقول التي تريد جلبها

      if (profilesError) throw profilesError;

      const formattedUsers: User[] = profiles.map(profile => ({
        id: profile.id,
        email: profile.email || 'غير متوفر', // Supabase قد لا يعيد البريد الإلكتروني مباشرة مع البروفايلات
        full_name: profile.full_name || 'غير محدد',
        role: profile.role || 'عضو',
        created_at: '', // ستكون هذه فارغة إذا لم نجدها في جدول البروفايلات
        last_sign_in_at: '', // ستكون هذه فارغة إذا لم نجدها في جدول البروفايلات
      }));

      // إذا كنت تريد جلب البيانات مباشرة من auth.admin.listUsers،
      // فهذا يتطلب مفتاح خدمة ويمكن أن يتم فقط من خادم آمن.
      // لهذا المثال، سنعتمد على جدول profiles.
      setUsers(formattedUsers);

    } catch (error: any) {
      console.error('❌ خطأ في جلب بيانات المستخدمين:', error.message);
      Alert.alert('خطأ', `فشل في جلب المستخدمين: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSignOut = async () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد أنك تريد تسجيل الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تسجيل الخروج',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const { error } = await supabase.auth.signOut();
            setLoading(false);
            if (error) {
              Alert.alert('خطأ في تسجيل الخروج', error.message);
            } else {
              Alert.alert('تم تسجيل الخروج', 'تم تسجيل خروجك بنجاح.');
              router.replace('/signIn'); // إعادة توجيه إلى شاشة تسجيل الدخول
            }
          },
        },
      ]
    );
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <View style={styles.userItem}>
      <Ionicons name="person-circle-outline" size={32} color="#6366f1" />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.full_name}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
        <Text style={styles.userRole}>الدور: {item.role}</Text>
        {currentUser && currentUser.id === item.id && (
          <Text style={styles.currentUserLabel}>(أنت)</Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <View style={styles.header}>
        <Text style={styles.title}>إدارة المستخدمين</Text>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color="white" />
              <Text style={styles.signOutButtonText}>تسجيل الخروج</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
        ListEmptyComponent={<EmptyState loading={loading} />}
        contentContainerStyle={styles.listContent}
        onRefresh={fetchUsers}
        refreshing={refreshing}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  signOutButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
  userItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  userRole: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    fontWeight: 'bold',
  },
  currentUserLabel: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: 'bold',
    marginTop: 4,
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
  emptyStateText: { fontSize: 18, color: '#6b7280', marginTop: 16 },
  emptyStateSubtext: { fontSize: 14, color: '#9ca3af', marginTop: 4 },
});
