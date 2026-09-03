import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useStore, Voucher } from '../context/StoreContext';
import AuthForm from '../components/AuthForm';
import { colors, radii, shadow, spacing, typography } from '../constants/theme';
import { formatPrice } from '../lib/format';

const STAMPS_PER_REWARD = 10;

export default function RewardsScreen() {
  const { user, loading: authLoading } = useAuth();
  const { orders, fetchMyVouchers } = useStore();
  const [vouchers, setVouchers] = useState<Voucher[] | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchMyVouchers().then(setVouchers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (authLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.screen}>
        <AuthForm />
      </View>
    );
  }

  const orderCount = orders.filter((o) => o.status !== 'cancelled').length;
  const progress = orderCount % STAMPS_PER_REWARD;
  const untilNext = STAMPS_PER_REWARD - progress;
  const available = (vouchers ?? []).filter((v) => !v.redeemed);
  const past = (vouchers ?? []).filter((v) => v.redeemed);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>Rewards</Text>

        <View style={styles.card}>
          <Text style={typography.h3}>Stamp card</Text>
          <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
            Order 10 bowls, the 11th is free — every order counts automatically.
          </Text>
          <View style={styles.stampRow}>
            {Array.from({ length: STAMPS_PER_REWARD }).map((_, i) => (
              <View key={i} style={[styles.stamp, i < progress && styles.stampFilled]}>
                {i < progress && <Text style={styles.stampCheck}>✓</Text>}
              </View>
            ))}
          </View>
          <Text style={[typography.bodyMuted, { marginTop: spacing.sm, textAlign: 'center' }]}>
            {orderCount === 0
              ? `Place your first order to start earning stamps.`
              : `${untilNext} more order${untilNext === 1 ? '' : 's'} until your next free bowl.`}
          </Text>
        </View>

        <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>YOUR VOUCHERS</Text>
        {vouchers === null ? (
          <ActivityIndicator color={colors.forest} style={{ marginTop: spacing.md }} />
        ) : available.length === 0 ? (
          <Text style={typography.bodyMuted}>No vouchers to use right now — keep ordering!</Text>
        ) : (
          available.map((v) => (
            <View key={v.id} style={styles.voucherCard}>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{v.description}</Text>
                <Text style={typography.bodyMuted}>Use it at checkout — no code needed.</Text>
              </View>
              <Text style={styles.voucherValue}>
                {v.type === 'percent' ? `${v.value}% off` : `-${formatPrice(v.value)}`}
              </Text>
            </View>
          ))
        )}

        {past.length > 0 && (
          <>
            <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>USED</Text>
            {past.map((v) => (
              <View key={v.id} style={[styles.voucherCard, styles.voucherCardUsed]}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, styles.usedText]}>{v.description}</Text>
                </View>
                <Text style={[styles.voucherValue, styles.usedText]}>
                  {v.type === 'percent' ? `${v.value}% off` : `-${formatPrice(v.value)}`}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
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
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    ...shadow.card,
  },
  stampRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  stamp: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampFilled: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  stampCheck: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  voucherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  voucherCardUsed: {
    opacity: 0.5,
  },
  voucherValue: {
    fontWeight: '700',
    color: colors.forest,
    fontSize: 14,
  },
  usedText: {
    color: colors.inkMuted,
  },
});
