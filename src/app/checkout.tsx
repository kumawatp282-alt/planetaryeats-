import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { lineUnitPrice, useStore, Voucher } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '../constants/theme';
import { formatPrice } from '../lib/format';
import { getOpenStatus } from '../lib/openingHours';

type PaymentMethod = 'card' | 'paypal' | 'iban' | 'cash';

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string }[] = [
  { id: 'card', label: 'Card' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'iban', label: 'Bank transfer (IBAN)' },
  { id: 'cash', label: 'Cash on delivery' },
];

export default function CheckoutScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const {
    cart,
    cartSubtotal,
    deliveryFee,
    placeOrder,
    fulfillmentMethod: method,
    setFulfillmentMethod: setMethod,
    deliveryAddress: address,
    setDeliveryAddressText: setAddress,
    checkDeliveryAddress,
    deliveryCheckStatus: deliveryStatus,
    deliveryDistanceKm: deliveryDistance,
    deliveryCoords,
    appSettings,
    fetchMyVouchers,
    lookupVoucherByCode,
  } = useStore();
  const [payment, setPayment] = useState<PaymentMethod>('card');
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [myVouchers, setMyVouchers] = useState<Voucher[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/(tabs)/profile');
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!user) return;
    fetchMyVouchers().then((vs) => setMyVouchers(vs.filter((v) => !v.redeemed)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const promoCode = appSettings.promoCode.trim().toUpperCase();
  const activeVoucher = selectedVoucher ?? appliedVoucher;
  const discount = activeVoucher
    ? Math.min(
        activeVoucher.type === 'percent' ? cartSubtotal * (activeVoucher.value / 100) : activeVoucher.value,
        cartSubtotal
      )
    : promoApplied
    ? cartSubtotal * appSettings.promoDiscount
    : 0;
  const total = cartSubtotal - discount + (method === 'delivery' ? deliveryFee : 0);
  const openStatus = getOpenStatus(appSettings.openingHours);
  const belowMinimum = appSettings.minimumOrderValue > 0 && cartSubtotal < appSettings.minimumOrderValue;
  const canPlaceOrder =
    cart.length > 0 &&
    !placing &&
    openStatus.isOpen &&
    !belowMinimum &&
    (method === 'pickup' || (address.trim().length > 0 && deliveryStatus === 'ok'));

  const selectVoucher = (v: Voucher) => {
    if (selectedVoucher?.id === v.id) {
      setSelectedVoucher(null);
      return;
    }
    setSelectedVoucher(v);
    setPromoApplied(false);
    setAppliedVoucher(null);
    setPromoInput('');
    setCodeError(null);
  };

  const applyCode = async () => {
    const raw = promoInput.trim();
    if (!raw) return;
    setCodeError(null);
    const upper = raw.toUpperCase();
    if (promoCode && upper === promoCode) {
      setPromoApplied(true);
      setSelectedVoucher(null);
      setAppliedVoucher(null);
      return;
    }
    setCheckingCode(true);
    const voucher = await lookupVoucherByCode(upper);
    setCheckingCode(false);
    if (!voucher) {
      setCodeError("That code isn't valid — check the spelling or it may already be used.");
      return;
    }
    setAppliedVoucher(voucher);
    setPromoApplied(false);
    setSelectedVoucher(null);
  };

  const checkDelivery = () => checkDeliveryAddress(address);

  const handlePlaceOrder = async () => {
    setPlacing(true);
    const option = PAYMENT_OPTIONS.find((o) => o.id === payment);
    const order = await placeOrder(
      {
        method,
        address: method === 'delivery' ? address.trim() : undefined,
        lat: method === 'delivery' ? deliveryCoords?.lat : undefined,
        long: method === 'delivery' ? deliveryCoords?.long : undefined,
      },
      option?.label ?? payment,
      discount,
      activeVoucher?.id
    );

    if (!order) {
      setPlacing(false);
      return;
    }

    if (payment === 'card') {
      try {
        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            // Only structural facts — the server independently recomputes
            // every price from the database, it never trusts an amount
            // from the browser (see api/create-checkout-session.js).
            voucherId: activeVoucher?.id,
            promoCode: promoApplied ? promoCode : undefined,
            origin: window.location.origin,
          }),
        });
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      } catch (e) {
        // fall through to confirmation — order is already placed either way
      }
    }

    setPlacing(false);
    router.replace({ pathname: '/order-confirmation', params: { orderId: order.id } });
  };

  if (authLoading || !user) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {!openStatus.isOpen && (
          <View style={styles.closedBanner}>
            <Text style={styles.closedBannerText}>We're currently closed — {openStatus.message.toLowerCase()}.</Text>
          </View>
        )}

        <Text style={typography.h3}>Fulfillment</Text>
        <View style={styles.methodRow}>
          <Pressable
            style={[styles.methodButton, method === 'delivery' && styles.methodButtonActive]}
            onPress={() => setMethod('delivery')}
          >
            <Text style={[styles.methodText, method === 'delivery' && styles.methodTextActive]}>Delivery</Text>
          </Pressable>
          <Pressable
            style={[styles.methodButton, method === 'pickup' && styles.methodButtonActive]}
            onPress={() => setMethod('pickup')}
          >
            <Text style={[styles.methodText, method === 'pickup' && styles.methodTextActive]}>Pickup</Text>
          </Pressable>
        </View>

        {method === 'delivery' && (
          <View style={styles.field}>
            <Text style={typography.label}>DELIVERY ADDRESS</Text>
            <View style={styles.deliveryRow}>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Street, city, postcode"
                placeholderTextColor={colors.inkMuted}
                style={[styles.input, { flex: 1, marginTop: 0 }]}
              />
              <Pressable
                style={[styles.checkButton, !address.trim() && styles.checkButtonDisabled]}
                onPress={checkDelivery}
                disabled={!address.trim() || deliveryStatus === 'checking'}
              >
                <Text style={styles.checkButtonText}>
                  {deliveryStatus === 'checking' ? '...' : 'Check'}
                </Text>
              </Pressable>
            </View>
            {deliveryStatus === 'ok' && deliveryDistance !== null && (
              <Text style={styles.deliveryOk}>
                ✓ We deliver here — {deliveryDistance.toFixed(1)} km from our kitchen in {appSettings.restaurantName}
              </Text>
            )}
            {deliveryStatus === 'too-far' && deliveryDistance !== null && (
              <Text style={styles.deliveryBad}>
                ✗ Sorry, that's {deliveryDistance.toFixed(1)} km away — outside our {appSettings.deliveryRadiusKm} km
                delivery zone from {appSettings.restaurantName}. Try pickup instead.
              </Text>
            )}
            {deliveryStatus === 'closed-area' && (
              <Text style={styles.deliveryBad}>
                ✗ Sorry, we don't currently deliver to that area. Try pickup instead.
              </Text>
            )}
            {deliveryStatus === 'not-found' && (
              <Text style={styles.deliveryBad}>Couldn't find that address — check the spelling and try again.</Text>
            )}
          </View>
        )}

        <Text style={[typography.h3, { marginTop: spacing.lg }]}>Payment method</Text>
        <View style={styles.paymentGrid}>
          {PAYMENT_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              style={[styles.paymentOption, payment === option.id && styles.paymentOptionActive]}
              onPress={() => setPayment(option.id)}
            >
              <Text style={[styles.paymentOptionText, payment === option.id && styles.paymentOptionTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs, fontSize: 12 }]}>
          Card payments are processed securely via Stripe. PayPal, bank transfer, and cash are recorded as your
          stated preference — not yet charged automatically.
        </Text>

        {myVouchers.length > 0 && (
          <>
            <Text style={[typography.h3, { marginTop: spacing.lg }]}>Your rewards</Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {myVouchers.map((v) => (
                <Pressable
                  key={v.id}
                  style={[styles.voucherRow, selectedVoucher?.id === v.id && styles.voucherRowActive]}
                  onPress={() => selectVoucher(v)}
                >
                  <Text
                    style={[styles.voucherText, selectedVoucher?.id === v.id && styles.voucherTextActive]}
                    numberOfLines={2}
                  >
                    {v.description}
                  </Text>
                  <Text style={[styles.voucherValue, selectedVoucher?.id === v.id && styles.voucherTextActive]}>
                    {v.type === 'percent' ? `${v.value}% off` : `-${formatPrice(v.value)}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={[typography.h3, { marginTop: spacing.lg }]}>Discount or gift code</Text>
        <View style={styles.promoRow}>
          <TextInput
            value={promoInput}
            onChangeText={(t) => {
              setPromoInput(t);
              setCodeError(null);
            }}
            placeholder="Enter code"
            placeholderTextColor={colors.inkMuted}
            style={[styles.input, { flex: 1, marginTop: 0 }]}
            autoCapitalize="characters"
            editable={!promoApplied && !appliedVoucher && !selectedVoucher}
          />
          <Pressable
            style={[
              styles.promoButton,
              (promoApplied || !!appliedVoucher || !!selectedVoucher) && styles.promoButtonDisabled,
            ]}
            onPress={applyCode}
            disabled={promoApplied || !!appliedVoucher || !!selectedVoucher || checkingCode}
          >
            <Text style={styles.promoButtonText}>
              {checkingCode ? '...' : promoApplied || appliedVoucher ? 'Applied' : 'Apply'}
            </Text>
          </Pressable>
        </View>
        {codeError && <Text style={styles.deliveryBad}>{codeError}</Text>}
        {myVouchers.length > 0 && (
          <Text style={[typography.bodyMuted, { marginTop: spacing.xs, fontSize: 12 }]}>
            Only one reward or code can be used per order.
          </Text>
        )}

        <Text style={[typography.h3, { marginTop: spacing.lg }]}>Order summary</Text>
        <View style={styles.summaryCard}>
          {cart.map((line) => (
            <View key={line.lineId} style={styles.summaryRow}>
              <Text style={typography.bodyMuted}>
                {line.quantity} × {line.item.name}
                {line.selectedProtein ? ` (${line.selectedProtein})` : ''}
                {line.riceScoops && line.riceScoops !== 1 ? ` · ${line.riceScoops} scoops rice` : ''}
              </Text>
              <Text style={typography.body}>{formatPrice(lineUnitPrice(line) * line.quantity)}</Text>
            </View>
          ))}
          <View style={[styles.summaryRow, { marginTop: spacing.xs }]}>
            <Text style={typography.bodyMuted}>Subtotal</Text>
            <Text style={typography.body}>{formatPrice(cartSubtotal)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[typography.bodyMuted, { color: colors.forest }]} numberOfLines={1}>
                {activeVoucher ? activeVoucher.description : `Promo (${promoCode})`}
              </Text>
              <Text style={[typography.body, { color: colors.forest }]}>-{formatPrice(discount)}</Text>
            </View>
          )}
          {method === 'delivery' && (
            <View style={styles.summaryRow}>
              <Text style={typography.bodyMuted}>Delivery fee</Text>
              <Text style={typography.body}>{formatPrice(deliveryFee)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, { marginTop: spacing.xs }]}>
            <Text style={typography.h3}>Total</Text>
            <Text style={typography.h3}>{formatPrice(total)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {belowMinimum && (
          <Text style={styles.minOrderText}>
            Minimum order is {formatPrice(appSettings.minimumOrderValue)} — add{' '}
            {formatPrice(appSettings.minimumOrderValue - cartSubtotal)} more.
          </Text>
        )}
        <Pressable
          style={[styles.placeButton, !canPlaceOrder && styles.placeButtonDisabled]}
          disabled={!canPlaceOrder}
          onPress={handlePlaceOrder}
        >
          <Text style={styles.placeText}>
            {placing ? 'Placing order…' : !openStatus.isOpen ? "We're closed" : `Place order · ${formatPrice(total)}`}
          </Text>
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
  loading: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
  },
  methodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  methodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  methodText: {
    fontWeight: '600',
    color: colors.inkMuted,
  },
  methodTextActive: {
    color: colors.white,
  },
  field: {
    marginBottom: spacing.md,
  },
  deliveryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  checkButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonDisabled: {
    backgroundColor: colors.border,
  },
  checkButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  deliveryOk: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.forest,
    fontWeight: '600',
  },
  deliveryBad: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },
  closedBanner: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  closedBannerText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  minOrderText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  input: {
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.ink,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  paymentOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  paymentOptionActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  paymentOptionText: {
    fontWeight: '600',
    color: colors.inkMuted,
    fontSize: 13,
  },
  paymentOptionTextActive: {
    color: colors.white,
  },
  promoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  promoButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoButtonDisabled: {
    backgroundColor: colors.border,
  },
  promoButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  voucherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  voucherRowActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  voucherText: {
    flex: 1,
    fontWeight: '600',
    color: colors.ink,
    fontSize: 13,
  },
  voucherValue: {
    fontWeight: '700',
    color: colors.forest,
    fontSize: 13,
  },
  voucherTextActive: {
    color: colors.white,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    ...shadow.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  placeButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  placeButtonDisabled: {
    opacity: 0.4,
  },
  placeText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
