import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import AuthForm from '../../components/AuthForm';
import { colors, radii, shadow, spacing, typography } from '../../constants/theme';

export default function ProfileScreen() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const { orders } = useStore();
  const router = useRouter();

  if (loading) {
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

  const today = new Date().toDateString();
  const todaysOrders = orders.filter((order) => new Date(order.placedAt).toDateString() === today);
  const totals = todaysOrders.reduce(
    (acc, order) => {
      order.lines.forEach((line) => {
        const n = line.item.nutrition;
        if (!n) return;
        acc.calories += n.calories * line.quantity;
        acc.protein += n.protein * line.quantity;
        acc.fiber += n.fiber * line.quantity;
      });
      return acc;
    },
    { calories: 0, protein: 0, fiber: 0 }
  );

  return (
    <View style={styles.screen}>
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={28} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={typography.h3}>{user.email}</Text>
          <Text style={typography.bodyMuted}>Signed in</Text>
        </View>
      </View>

      <Text style={[typography.label, { marginBottom: spacing.xs }]}>TODAY'S NUTRITION</Text>
      <Pressable style={styles.nutritionCard} onPress={() => router.push('/nutrition')}>
        {todaysOrders.length === 0 ? (
          <Text style={typography.bodyMuted}>No orders from Planetary Eats today yet.</Text>
        ) : (
          <>
            <View style={styles.nutritionRow}>
              <View style={styles.nutritionCell}>
                <Text style={styles.nutritionValue}>{Math.round(totals.calories)}</Text>
                <Text style={styles.nutritionLabel}>kcal</Text>
              </View>
              <View style={styles.nutritionCell}>
                <Text style={styles.nutritionValue}>{Math.round(totals.protein)}g</Text>
                <Text style={styles.nutritionLabel}>protein</Text>
              </View>
              <View style={styles.nutritionCell}>
                <Text style={styles.nutritionValue}>{Math.round(totals.fiber)}g</Text>
                <Text style={styles.nutritionLabel}>fiber</Text>
              </View>
            </View>
            <Text style={styles.nutritionFootnote}>
              From {todaysOrders.length} order{todaysOrders.length > 1 ? 's' : ''} placed today · estimated, not
              lab-verified
            </Text>
          </>
        )}
        <Text style={styles.nutritionCta}>Track everything you ate today →</Text>
      </Pressable>

      <View style={styles.section}>
        <Pressable style={styles.row} onPress={() => router.push('/(tabs)/orders')}>
          <Ionicons name="receipt-outline" size={20} color={colors.forest} />
          <Text style={[typography.body, { marginLeft: spacing.md }]}>Your orders</Text>
        </Pressable>
        <Pressable style={[styles.row, styles.rowDivider]} onPress={() => router.push('/rewards')}>
          <Ionicons name="star-outline" size={20} color={colors.forest} />
          <Text style={[typography.body, { marginLeft: spacing.md }]}>Rewards</Text>
        </Pressable>
        <Pressable style={[styles.row, styles.rowDivider]} onPress={() => router.push('/help')}>
          <Ionicons name="help-circle-outline" size={20} color={colors.forest} />
          <Text style={[typography.body, { marginLeft: spacing.md }]}>Need help?</Text>
        </Pressable>
        <Pressable style={[styles.row, styles.rowDivider]} onPress={() => router.push('/courier')}>
          <Ionicons name="bicycle-outline" size={20} color={colors.forest} />
          <Text style={[typography.body, { marginLeft: spacing.md }]}>Become a courier</Text>
        </Pressable>
        <Pressable style={[styles.row, styles.rowDivider]} onPress={() => router.push('/business')}>
          <Ionicons name="briefcase-outline" size={20} color={colors.forest} />
          <Text style={[typography.body, { marginLeft: spacing.md }]}>Planetary Eats for Business</Text>
        </Pressable>
        <Pressable style={[styles.row, styles.rowDivider]} onPress={() => router.push('/partner')}>
          <Ionicons name="people-outline" size={20} color={colors.forest} />
          <Text style={[typography.body, { marginLeft: spacing.md }]}>Partner with us</Text>
        </Pressable>
        {isAdmin && (
          <Pressable style={[styles.row, styles.rowDivider]} onPress={() => router.push('/admin')}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.forest} />
            <Text style={[typography.body, { marginLeft: spacing.md }]}>Admin panel</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Text style={styles.footnote}>
        Card payments are processed securely via Stripe. PayPal, bank transfer, and cash are recorded as your
        stated preference — not yet charged automatically.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
    padding: spacing.lg,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutritionCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionCell: {
    flex: 1,
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.forest,
  },
  nutritionLabel: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 2,
  },
  nutritionFootnote: {
    marginTop: spacing.sm,
    fontSize: 11,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  nutritionCta: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: '700',
    color: colors.leaf,
    textAlign: 'center',
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  signOutButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  signOutText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 15,
  },
  footnote: {
    marginTop: spacing.lg,
    fontSize: 12,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
