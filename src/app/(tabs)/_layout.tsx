import React from 'react';
import { Tabs } from 'expo-router';
import { useStore } from '../../context/StoreContext';
import { colors } from '../../constants/theme';
import AnimatedTabIcon from '../../components/AnimatedTabIcon';

export default function TabsLayout() {
  const { cartCount } = useStore();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
          tabBarLabel: 'Menu',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="restaurant-outline" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Your cart',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="cart-outline" color={color} size={size} focused={focused} />
          ),
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Your orders',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="receipt-outline" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="person-outline" color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
