import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider } from '../context/StoreContext';
import { AuthProvider } from '../context/AuthContext';
import { colors } from '../constants/theme';
import SplashOverlay from '../components/SplashOverlay';
import AppHeader from '../components/AppHeader';

// Printing a receipt (see ReceiptView) should show only the receipt, not
// the site chrome around it — targets nativeID (= real DOM id on web).
function usePrintStylesheet() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('pe-print-style')) return;
    const style = document.createElement('style');
    style.id = 'pe-print-style';
    style.textContent = `
      @media print {
        #pe-app-header, #pe-print-hide { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }, []);
}

export default function RootLayout() {
  usePrintStylesheet();

  return (
    <AuthProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <SplashOverlay />
        <View style={{ flex: 1, backgroundColor: colors.cream }}>
          <AppHeader />
          <View style={{ flex: 1 }}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.cream },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="item/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="checkout" />
              <Stack.Screen name="shop" />
              <Stack.Screen name="order-confirmation" options={{ gestureEnabled: false }} />
              <Stack.Screen name="admin" />
              <Stack.Screen name="receipt/[orderId]" />
              <Stack.Screen name="impressum" />
              <Stack.Screen name="datenschutz" />
              <Stack.Screen name="nutrition" />
            </Stack>
          </View>
        </View>
      </StoreProvider>
    </AuthProvider>
  );
}
