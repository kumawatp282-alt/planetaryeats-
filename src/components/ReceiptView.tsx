// A printable order receipt — not a legally-compliant German tax invoice
// (no VAT breakdown, no sequential invoice numbering; the codebase has no
// tax handling anywhere and that's a real legal/tax-advisor question, not
// something to silently assume). This is an itemized summary a customer or
// the admin can print or save as PDF via the browser's own print dialog.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Order, lineUnitPrice, useStore } from '../context/StoreContext';
import { colors, radii, spacing, typography } from '../constants/theme';
import { formatPrice } from '../lib/format';

interface Props {
  order: Order;
  customerEmail?: string;
}

export default function ReceiptView({ order, customerEmail }: Props) {
  const { appSettings, deliveryFee } = useStore();

  const linesSubtotal = order.lines.reduce((sum, line) => sum + lineUnitPrice(line) * line.quantity, 0);
  const appliedDeliveryFee = order.fulfillment.method === 'delivery' ? deliveryFee : 0;
  // Whatever's left over reconciles the stored total exactly — this is how
  // a promo/discount shows up here even though it isn't stored as its own
  // field on the order, without ever risking a number that doesn't add up.
  const adjustment = order.total - linesSubtotal - appliedDeliveryFee;

  const placedDate = new Date(order.placedAt);

  return (
    <View style={styles.page}>
      <View style={styles.printButtonRow} nativeID="pe-print-hide">
        <Pressable style={styles.printButton} onPress={() => window.print()}>
          <Text style={styles.printButtonText}>Print / Save as PDF</Text>
        </Pressable>
      </View>

      <View style={styles.receipt}>
        <Text style={styles.restaurantName}>{appSettings.restaurantName}</Text>
        <Text style={styles.subtle}>Receipt</Text>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>ORDER</Text>
            <Text style={styles.metaValue}>{order.id}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>DATE</Text>
            <Text style={styles.metaValue}>
              {placedDate.toLocaleDateString()} {placedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {customerEmail && (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={styles.metaLabel}>CUSTOMER</Text>
            <Text style={styles.metaValue}>{customerEmail}</Text>
          </View>
        )}

        <View style={styles.divider} />

        {order.lines.map((line) => (
          <View key={line.lineId} style={styles.lineRow}>
            <Text style={styles.lineText}>
              {line.quantity} × {line.item.name}
              {line.selectedProtein ? ` (${line.selectedProtein})` : ''}
              {line.riceScoops && line.riceScoops !== 1 ? ` · ${line.riceScoops} scoops rice` : ''}
            </Text>
            <Text style={styles.lineText}>{formatPrice(lineUnitPrice(line) * line.quantity)}</Text>
          </View>
        ))}

        <View style={styles.divider} />

        <View style={styles.lineRow}>
          <Text style={styles.subtle}>Subtotal</Text>
          <Text style={styles.subtle}>{formatPrice(linesSubtotal)}</Text>
        </View>
        {appliedDeliveryFee > 0 && (
          <View style={styles.lineRow}>
            <Text style={styles.subtle}>Delivery fee</Text>
            <Text style={styles.subtle}>{formatPrice(appliedDeliveryFee)}</Text>
          </View>
        )}
        {Math.abs(adjustment) >= 0.01 && (
          <View style={styles.lineRow}>
            <Text style={styles.subtle}>{adjustment < 0 ? 'Discount' : 'Adjustment'}</Text>
            <Text style={styles.subtle}>{formatPrice(adjustment)}</Text>
          </View>
        )}
        <View style={[styles.lineRow, { marginTop: spacing.xs }]}>
          <Text style={styles.totalText}>Total paid</Text>
          <Text style={styles.totalText}>{formatPrice(order.total)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>FULFILLMENT</Text>
            <Text style={styles.metaValue}>{order.fulfillment.method === 'delivery' ? 'Delivery' : 'Pickup'}</Text>
            {order.fulfillment.address && <Text style={styles.subtle}>{order.fulfillment.address}</Text>}
          </View>
          <View>
            <Text style={styles.metaLabel}>PAYMENT</Text>
            <Text style={styles.metaValue}>{order.paymentMethod}</Text>
          </View>
        </View>

        <Text style={styles.footnote}>
          This is a receipt for your records, not a formal tax invoice. Contact us if you need anything further.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    padding: spacing.lg,
  },
  printButtonRow: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  printButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  printButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  receipt: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  restaurantName: {
    ...typography.h2,
  },
  subtle: {
    ...typography.bodyMuted,
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  metaLabel: {
    ...typography.label,
  },
  metaValue: {
    ...typography.body,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  lineText: {
    ...typography.body,
    fontSize: 14,
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
  totalText: {
    ...typography.h3,
  },
  footnote: {
    marginTop: spacing.lg,
    fontSize: 11,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
