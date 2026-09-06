// Guest-accessible receipt for a kiosk order — reached by scanning the QR
// code on the kiosk's confirmation screen. Kiosk customers never sign in,
// so this can't reuse the regular /receipt/[orderId] page (which only
// reads from the signed-in customer's own already-loaded order list);
// instead it looks the order up directly via a security-definer RPC
// scoped to source = 'kiosk' (see supabase/kiosk_receipt_schema.sql).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Order } from '../../context/StoreContext';
import ReceiptView from '../../components/ReceiptView';
import { colors, typography } from '../../constants/theme';

export default function KioskReceiptScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);

  useEffect(() => {
    if (!orderId) return;
    supabase
      .rpc('kiosk_order_receipt', { p_order_id: orderId })
      .then(({ data, error }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (error || !row) {
          setOrder(null);
          return;
        }
        setOrder({
          id: row.id,
          userId: null,
          lines: row.lines,
          total: Number(row.total),
          status: row.status,
          fulfillment: row.fulfillment,
          paymentMethod: row.payment_method,
          placedAt: row.placed_at,
          source: row.source ?? 'kiosk',
          cancellationReason: null,
          riderId: null,
          pickedUpAt: null,
          deliveredAt: null,
          employeeId: null,
        });
      });
  }, [orderId]);

  if (order === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} size="large" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={typography.h3}>Receipt not found</Text>
      </View>
    );
  }

  return <ReceiptView order={order} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
});
