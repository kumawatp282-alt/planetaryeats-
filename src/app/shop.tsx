import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { shopConcepts } from '../data/shopConcepts';
import { colors, radii, shadow, spacing, typography } from '../constants/theme';
import { formatPrice } from '../lib/format';

export default function ShopScreen() {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.conceptBanner}>
          <Text style={styles.conceptBannerText}>
            🌱 Concept preview — these eco-friendly, recycled goods from each country aren't for sale yet. This is a
            mockup of the idea for you to react to.
          </Text>
        </View>

        {shopConcepts.map((product) => (
          <View key={product.id} style={styles.card}>
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>{product.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.label}>
                {product.flag} {product.country}
              </Text>
              <Text style={[typography.h3, { marginTop: 2 }]}>{product.name}</Text>
              <Text style={[typography.bodyMuted, { marginTop: 2 }]}>{product.description}</Text>
              <Text style={styles.price}>{formatPrice(product.price)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: spacing.lg,
  },
  conceptBanner: {
    backgroundColor: 'rgba(232,163,61,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232,163,61,0.35)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  conceptBannerText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 30,
  },
  price: {
    marginTop: spacing.xs,
    fontWeight: '700',
    color: colors.forest,
    fontSize: 14,
  },
});
