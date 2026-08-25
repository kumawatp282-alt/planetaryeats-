import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getMenuItem, MenuItem } from '../../data/menu';
import { useStore } from '../../context/StoreContext';
import QuantityStepper from '../../components/QuantityStepper';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { formatPrice } from '../../lib/format';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addToCart } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [item, setItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedProtein, setSelectedProtein] = useState<string | undefined>(undefined);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMenuItem(id).then((result) => {
      if (cancelled) return;
      setItem(result ?? null);
      setSelectedProtein(result?.proteinOptions?.[0]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const unitPrice = useMemo(() => {
    if (!item) return 0;
    const addOnsTotal = (item.addOns ?? [])
      .filter((addOn) => selectedAddOnIds.includes(addOn.id))
      .reduce((sum, addOn) => sum + addOn.price, 0);
    return item.price + addOnsTotal;
  }, [item, selectedAddOnIds]);

  if (loading) {
    return (
      <View style={styles.notFound}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.notFound}>
        <Text style={typography.h3}>Item not found</Text>
      </View>
    );
  }

  const toggleAddOn = (addOnId: string) => {
    setSelectedAddOnIds((current) =>
      current.includes(addOnId) ? current.filter((id) => id !== addOnId) : [...current, addOnId]
    );
  };

  const handleAdd = () => {
    addToCart(item, quantity, selectedProtein, selectedAddOnIds);
    router.back();
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emojiWrap}>
          {item.dishImage ? (
            <Image source={item.dishImage} style={styles.dishImage} resizeMode="cover" />
          ) : (
            <Text style={styles.emoji}>{item.emoji}</Text>
          )}
        </View>
        <Text style={typography.h1}>{item.name}</Text>
        <Text style={[typography.bodyMuted, styles.description]}>{item.description}</Text>
        <Text style={styles.price}>{formatPrice(item.price)}</Text>

        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagRow}>
            {item.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {item.proteinOptions && item.proteinOptions.length > 0 && (
          <View style={styles.section}>
            <Text style={typography.label}>CHOOSE YOUR PROTEIN</Text>
            <View style={styles.optionRow}>
              {item.proteinOptions.map((protein) => {
                const active = selectedProtein === protein;
                return (
                  <Pressable
                    key={protein}
                    style={[styles.optionPill, active && styles.optionPillActive]}
                    onPress={() => setSelectedProtein(protein)}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{protein}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {item.addOns && item.addOns.length > 0 && (
          <View style={styles.section}>
            <Text style={typography.label}>MAKE IT YOURS</Text>
            <View style={styles.addOnList}>
              {item.addOns.map((addOn) => {
                const active = selectedAddOnIds.includes(addOn.id);
                return (
                  <Pressable key={addOn.id} style={styles.addOnRow} onPress={() => toggleAddOn(addOn.id)}>
                    <View style={[styles.checkbox, active && styles.checkboxActive]}>
                      {active && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                    <Text style={[typography.body, styles.addOnName]}>{addOn.name}</Text>
                    <Text style={typography.bodyMuted}>+{formatPrice(addOn.price)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {(item.ingredients || (item.allergens && item.allergens.length > 0)) && (
          <View style={styles.section}>
            <Text style={typography.label}>WHAT'S INSIDE</Text>
            {item.ingredients && (
              <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>{item.ingredients}</Text>
            )}
            {item.allergens && item.allergens.length > 0 && (
              <View style={styles.allergenRow}>
                {item.allergens.map((allergen) => (
                  <View key={allergen} style={styles.allergenChip}>
                    <Text style={styles.allergenText}>{allergen}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={[typography.bodyMuted, { fontSize: 11, marginTop: spacing.xs }]}>
              Allergen info is provided as a guide — tell us about any allergy when ordering.
            </Text>
          </View>
        )}

        {item.nutrition && (
          <View style={styles.section}>
            <Text style={typography.label}>NUTRITION (ESTIMATED)</Text>
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionCell}>
                <Text style={styles.nutritionValue}>{item.nutrition.calories}</Text>
                <Text style={styles.nutritionLabel}>kcal</Text>
              </View>
              <View style={styles.nutritionCell}>
                <Text style={styles.nutritionValue}>{item.nutrition.protein}g</Text>
                <Text style={styles.nutritionLabel}>protein</Text>
              </View>
              <View style={styles.nutritionCell}>
                <Text style={styles.nutritionValue}>{item.nutrition.fiber}g</Text>
                <Text style={styles.nutritionLabel}>fiber</Text>
              </View>
              <View style={styles.nutritionCell}>
                <Text style={styles.nutritionValue}>{item.nutrition.carbs}g</Text>
                <Text style={styles.nutritionLabel}>carbs</Text>
              </View>
              <View style={styles.nutritionCell}>
                <Text style={styles.nutritionValue}>{item.nutrition.fat}g</Text>
                <Text style={styles.nutritionLabel}>fat</Text>
              </View>
            </View>
            <Text style={[typography.bodyMuted, { fontSize: 11, marginTop: spacing.xs }]}>
              Estimated for the default protein choice — not lab-verified.
            </Text>
          </View>
        )}

        <View style={styles.promiseCard}>
          <Text style={styles.promiseTitle}>🌍 Our Planetary Promise</Text>
          <Text style={styles.promiseText}>
            Thoughtfully sourced ingredients, recipes built around vegetables and whole grains, and packaging
            designed to leave less behind — small choices, on every bowl.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <QuantityStepper quantity={quantity} onIncrease={() => setQuantity((q) => q + 1)} onDecrease={() => setQuantity((q) => Math.max(1, q - 1))} />
        <Pressable style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addText}>Add · {formatPrice(unitPrice * quantity)}</Text>
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
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  content: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emojiWrap: {
    width: 140,
    height: 140,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  emoji: {
    fontSize: 64,
  },
  dishImage: {
    width: '100%',
    height: '100%',
  },
  description: {
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.forest,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  tag: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  section: {
    width: '100%',
    marginTop: spacing.lg,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  optionPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
  },
  optionPillActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  optionText: {
    fontWeight: '600',
    color: colors.ink,
  },
  optionTextActive: {
    color: colors.white,
  },
  addOnList: {
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addOnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  addOnName: {
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  checkboxMark: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  allergenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  allergenChip: {
    backgroundColor: 'rgba(182,85,64,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(182,85,64,0.3)',
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  allergenText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  nutritionCell: {
    flex: 1,
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  nutritionLabel: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 2,
  },
  promiseCard: {
    width: '100%',
    marginTop: spacing.lg,
    backgroundColor: 'rgba(43,168,144,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(43,168,144,0.3)',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  promiseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  promiseText: {
    fontSize: 12,
    color: colors.inkMuted,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  addButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  addText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
