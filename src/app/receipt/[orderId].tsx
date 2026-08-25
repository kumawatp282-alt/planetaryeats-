// Customer's own receipt — pulled straight out of `orders` in StoreContext
// (already loaded for the signed-in user), no extra query needed.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import ReceiptView from '../../components/ReceiptView';
import { colors, typography } from '../../constants/theme';

export default function ReceiptScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { orders } = useStore();
  const { user } = useAuth();
  const order = orders.find((o) => o.id === orderId);

  if (!order) {
    return (
      <View style={styles.notFound}>
        <Text style={typography.h3}>Receipt not found</Text>
      </View>
    );
  }

  return <ReceiptView order={order} customerEmail={user?.email ?? undefined} />;
}

const styles = StyleSheet.create({
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
});
