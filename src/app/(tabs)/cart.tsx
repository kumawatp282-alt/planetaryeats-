import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { lineUnitPrice, useStore } from '../../context/StoreContext';
import QuantityStepper from '../../components/QuantityStepper';
import { colors, radii, shadow, spacing, typography } from '../../constants/theme';
import { formatPrice } from '../../lib/format';

export default function CartScreen() {
  const router = useRouter();
  const { cart, updateQuantity, removeFromCart, cartSubtotal, deliveryFee } = useStore();

  if (cart.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={{ fontSize: 40, marginBottom: spacing.sm }}>🧺</Text>
        <Text style={typography.h3}>Your cart is empty</Text>
        <Text style={[typography.bodyMuted, { marginTop: 4 }]}>Add something tasty from the menu.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={cart}
        keyExtractor={(line) => line.lineId}
        contentContainerStyle={styles.list}
        renderItem={({ item: line }) => {
          const addOnNames = (line.item.addOns ?? [])
            .filter((addOn) => line.selectedAddOnIds.includes(addOn.id))
            .map((addOn) => addOn.name);
          const customization = [line.selectedProtein, ...addOnNames].filter(Boolean).join(' · ');

          return (
            <View style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.emoji}>{line.item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3}>{line.item.name}</Text>
                  {customization.length > 0 && (
                    <Text style={[typography.bodyMuted, styles.customization]}>{customization}</Text>
                  )}
                  <Text style={typography.price}>{formatPrice(lineUnitPrice(line) * line.quantity)}</Text>
                </View>
              </View>
              <View style={styles.rowActions}>
                <QuantityStepper
                  quantity={line.quantity}
                  onIncrease={() => updateQuantity(line.lineId, line.quantity + 1)}
                  onDecrease={() => updateQuantity(line.lineId, line.quantity - 1)}
                />
                <Pressable onPress={() => removeFromCart(line.lineId)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={typography.bodyMuted}>Subtotal</Text>
          <Text style={typography.body}>{formatPrice(cartSubtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={typography.bodyMuted}>Delivery fee</Text>
          <Text style={typography.body}>{formatPrice(deliveryFee)}</Text>
        </View>
        <View style={[styles.summaryRow, { marginTop: spacing.xs }]}>
          <Text style={typography.h3}>Total</Text>
          <Text style={typography.h3}>{formatPrice(cartSubtotal + deliveryFee)}</Text>
        </View>
        <Pressable style={styles.checkoutButton} onPress={() => router.push('/checkout')}>
          <Text style={styles.checkoutText}>Go to checkout</Text>
        </Pressable>
      </View>
    </View>
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
  row: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  rowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  emoji: {
    fontSize: 28,
  },
  customization: {
    marginTop: 1,
    marginBottom: 2,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  remove: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  summary: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  checkoutButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  checkoutText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
