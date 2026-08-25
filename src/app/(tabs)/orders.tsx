import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../context/StoreContext';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import { colors, radii, shadow, spacing, typography } from '../../constants/theme';
import { formatPrice } from '../../lib/format';

export default function OrdersScreen() {
  const { orders, advanceOrderStatus } = useStore();
  const router = useRouter();

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
            {order.status !== 'delivered' && (
              <Pressable style={styles.advanceButton} onPress={() => advanceOrderStatus(order.id)}>
                <Text style={styles.advanceText}>Simulate next status →</Text>
              </Pressable>
            )}
            <Pressable style={styles.advanceButton} onPress={() => router.push(`/receipt/${order.id}`)}>
              <Text style={styles.advanceText}>Receipt</Text>
            </Pressable>
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
