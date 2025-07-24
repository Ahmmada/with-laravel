// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { AntDesign } from '@expo/vector-icons';
import { MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';


export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
<Tabs.Screen
  name="students"
  options={{
  headerShown: true,
    title: 'الطلاب',
    tabBarIcon: ({ color }) => (
      <MaterialCommunityIcons name="account-details" size={20} color={color} />
    ),

  }}
/>
<Tabs.Screen
  name="centers"
  options={{
  headerShown: true,
    title: 'المراكز',
    tabBarIcon: ({ color }) => (
      <MaterialCommunityIcons name="school-outline" size={20} color={color} />
    ),

  }}
/>
<Tabs.Screen
  name="levels"
  options={{
  headerShown: true,
    title: 'المستويات',
    tabBarIcon: ({ color }) => (
     <FontAwesome6 name="ranking-star" size={20} color={color}  />
    ),

  }}
/>

<Tabs.Screen
  name="groups"
  options={{
  headerShown: true,
    title: 'المجموعات',
    tabBarIcon: ({ color }) => (
     <FontAwesome6 name="ranking-star" size={20} color={color}  />
    ),

  }}
/>
    </Tabs>
  );
}
