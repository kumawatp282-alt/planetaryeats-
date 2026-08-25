import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OrderStatus } from '../context/StoreContext';
import { colors, radii, spacing } from '../constants/theme';

const LABELS: Record<OrderStatus, string> = {
  placed: 'Order placed',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
};

const COLORS: Record<OrderStatus, string> = {
  placed: colors.sun,
  preparing: colors.clay,
  out_for_delivery: colors.leaf,
  delivered: colors.forest,
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <View style={[styles.badge, { backgroundColor: COLORS[status] }]}>
      <Text style={styles.text}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
});
