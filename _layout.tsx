// app/(admin)/_layout.tsx
import React, { useState, useEffect } from 'react';
import { Drawer } from 'expo-router/drawer';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { Alert, View, ActivityIndicator, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function AdminDrawerLayout() {
  const colorScheme = useColorScheme();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    let profileSubscription: any = null;

    const fetchUserRole = async () => {
      setLoadingRole(true);
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          setUserRole(null);
          router.replace('/signIn'); // إذا لم يكن هناك مستخدم أو خطأ، أعد التوجيه
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError || profileData.role !== 'admin') {
          console.error("❌ خطأ في جلب ملف التعريف أو ليس مسؤولاً:", profileError?.message || 'ليس مسؤولاً');
          setUserRole(null);
          router.replace('/(user)'); // إذا لم يكن مسؤولاً، أعد توجيهه إلى تبويبات المستخدم
        } else {
          setUserRole(profileData.role);
        }
      } catch (error) {
        setUserRole(null);
        router.replace('/signIn');
      } finally {
        setLoadingRole(false);
      }
    };

    fetchUserRole();

    // الاشتراك في تغييرات ملف التعريف (للتحديثات الفورية للدور)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserRole();
      } else {
        setUserRole(null);
        router.replace('/signIn');
        if (profileSubscription) {
          supabase.removeChannel(profileSubscription);
          profileSubscription = null;
        }
      }
    });

    const { data: subscription } = supabase
        .channel(`public:profiles`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
            if (payload.new && (payload.new as any).id === supabase.auth.user()?.id) { // تأكد من أنه ملف التعريف الخاص بالمستخدم الحالي
                console.log('🔄 تم تحديث دور المستخدم (مسؤول) إلى:', (payload.new as any).role);
                setUserRole((payload.new as any).role);
                if ((payload.new as any).role !== 'admin') {
                    router.replace('/(user)'); // إذا تغير الدور ولم يعد مسؤولاً
                }
            }
        })
        .subscribe();
    profileSubscription = subscription;


    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
      if (profileSubscription) {
        supabase.removeChannel(profileSubscription);
      }
    };
  }, []);

  const handleLogout = async () => {
    try {
      setLoadingRole(true); // إعادة تشغيل مؤشر التحميل أثناء تسجيل الخروج
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert('خطأ في تسجيل الخروج', error.message);
      } else {
        router.replace('/signIn'); // توجه إلى شاشة تسجيل الدخول بعد تسجيل الخروج
      }
    } catch (error: any) {
      Alert.alert('خطأ', error.message);
    } finally {
      setLoadingRole(false);
    }
  };


  if (loadingRole) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        <Text style={styles.loadingText}>جاري تحميل لوحة التحكم...</Text>
      </View>
    );
  }

  // إذا لم يكن الدور 'admin' بعد التحقق، لا تعرض الدرج
  if (userRole !== 'admin') {
      // يمكن عرض رسالة خطأ أو ببساطة ترك RootLayout ليعيد التوجيه
      return null;
  }

  return (
    <Drawer screenOptions={{
      headerShown: true, // يمكن إظهار الرأس بشكل افتراضي في الدرج
      drawerActiveTintColor: Colors[colorScheme ?? 'light'].tint,
      headerStyle: {
        backgroundColor: Colors[colorScheme ?? 'light'].background,
      },
      headerTintColor: Colors[colorScheme ?? 'light'].text,
    }}>
      <Drawer.Screen
        name="index" // الشاشة الرئيسية داخل درج المسؤول
        options={{
          drawerLabel: 'الرئيسية',
          title: 'لوحة تحكم المسؤول',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="students"
        options={{
          drawerLabel: 'الطلاب',
          title: 'إدارة الطلاب',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-details" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="users"
        options={{
          drawerLabel: 'المستخدمون',
          title: 'إدارة المستخدمين',
          drawerIcon: ({ color, size }) => (
            <FontAwesome6 name="users" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="levels"
        options={{
          drawerLabel: 'المستويات',
          title: 'إدارة المستويات',
          drawerIcon: ({ color, size }) => (
            <FontAwesome6 name="ranking-star" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="offices"
        options={{
          drawerLabel: 'المراكز',
          title: 'إدارة المراكز',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="school-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="logout" // شاشة وهمية لتسجيل الخروج
        options={{
          drawerLabel: 'تسجيل الخروج',
          title: 'تسجيل الخروج',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="logout" size={size} color={color} />
          ),
        }}
        listeners={{
          drawerItemPress: (e) => {
            e.preventDefault(); // منع التنقل الافتراضي
            Alert.alert(
              'تسجيل الخروج',
              'هل أنت متأكد أنك تريد تسجيل الخروج؟',
              [
                { text: 'إلغاء', style: 'cancel' },
                { text: 'تسجيل الخروج', onPress: handleLogout },
              ]
            );
          },
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6366f1',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  logoutText: {
    marginLeft: 10,
    fontSize: 16,
    color: 'red',
  },
});
