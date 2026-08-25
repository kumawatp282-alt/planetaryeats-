import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radii, spacing, typography } from '../constants/theme';

export default function OrderConfirmationScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Text style={styles.emoji}>✅</Text>
      <Text style={typography.h1}>Order placed!</Text>
      <Text style={[typography.bodyMuted, styles.subtitle]}>
        Thanks for ordering from Planetary Eats. Track its progress from the Orders tab.
      </Text>
      <View style={styles.orderIdBadge}>
        <Text style={typography.h3}>{orderId}</Text>
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={() => router.replace('/(tabs)/orders')}
      >
        <Text style={styles.primaryText}>Track my order</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.secondaryText}>Back to menu</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emoji: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  subtitle: {
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  orderIdBadge: {
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.sm,
  },
  primaryText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
  },
  secondaryText: {
    color: colors.inkMuted,
    fontWeight: '600',
  },
});
