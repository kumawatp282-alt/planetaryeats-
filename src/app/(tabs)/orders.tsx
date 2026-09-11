import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Order, todayIso, useStore } from '../../context/StoreContext';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import { colors, radii, shadow, spacing, typography } from '../../constants/theme';
import { formatPrice } from '../../lib/format';

export default function OrdersScreen() {
  const { orders, advanceOrderStatus, addNutritionEntry } = useStore();
  const router = useRouter();
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());
  const [loggingId, setLoggingId] = useState<string | null>(null);

  // Today's own orders already count automatically toward the daily
  // nutrition total (useTodayNutrition sums today's orders directly) —
  // this button is for re-logging a PAST order as something eaten today,
  // so it only appears for orders from an earlier day, and only when the
  // order actually has nutrition data to log.
  const logOrderNutrition = async (order: Order) => {
    setLoggingId(order.id);
    const totals = order.lines.reduce(
      (acc, line) => {
        const n = line.item.nutrition;
        if (!n) return acc;
        return {
          calories: acc.calories + n.calories * line.quantity,
          protein: acc.protein + n.protein * line.quantity,
          fiber: acc.fiber + n.fiber * line.quantity,
        };
      },
      { calories: 0, protein: 0, fiber: 0 }
    );
    const label = order.lines.map((l) => l.item.name).join(', ');
    const { error } = await addNutritionEntry(todayIso(), { label, ...totals });
    setLoggingId(null);
    if (!error) setLoggedIds((prev) => new Set(prev).add(order.id));
  };

  if (orders.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={{ fontSize: 40, marginBottom: spacing.sm }}>🧾</Text>
        <Text style={typography.h3}>No orders yet</Text>
        <Text style={[typography.bodyMuted, { marginTop: 4 }]}>Placed orders will show up here.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={orders}
      keyExtractor={(order) => order.id}
      renderItem={({ item: order }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={typography.h3}>{order.id}</Text>
            <OrderStatusBadge status={order.status} />
          </View>
          <Text style={[typography.bodyMuted, { marginBottom: spacing.sm }]}>
            {order.lines.length} item{order.lines.length > 1 ? 's' : ''} · {formatPrice(order.total)} ·{' '}
            {order.fulfillment.method === 'delivery' ? 'Delivery' : 'Pickup'}
          </Text>
          <View style={styles.actionRow}>
            {order.status !== 'delivered' && order.status !== 'cancelled' && (
              <Pressable style={styles.advanceButton} onPress={() => advanceOrderStatus(order.id)}>
                <Text style={styles.advanceText}>Simulate next status →</Text>
              </Pressable>
            )}
            <Pressable style={styles.advanceButton} onPress={() => router.push(`/receipt/${order.id}`)}>
              <Text style={styles.advanceText}>Receipt</Text>
            </Pressable>
            {new Date(order.placedAt).toDateString() !== new Date().toDateString() &&
              order.lines.some((l) => l.item.nutrition) && (
                <Pressable
                  style={styles.advanceButton}
                  onPress={() => logOrderNutrition(order)}
                  disabled={loggedIds.has(order.id) || loggingId === order.id}
                >
                  <Text style={styles.advanceText}>
                    {loggedIds.has(order.id)
                      ? 'Logged to today ✓'
                      : loggingId === order.id
                      ? 'Logging…'
                      : 'Add to My Daily Log'}
                  </Text>
                </Pressable>
              )}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    padding: spacing.xl,
  },
  list: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  advanceButton: {
    alignSelf: 'flex-start',
  },
  advanceText: {
    color: colors.leaf,
    fontWeight: '600',
    fontSize: 13,
  },
});
