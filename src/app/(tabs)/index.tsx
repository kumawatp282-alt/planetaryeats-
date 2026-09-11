import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import GlobeExplorer from '../../components/GlobeExplorer';

// Reverted from the flat-map experiment (with wandering people/plants) back
// to the 3D globe, which never had those.
const Explorer = GlobeExplorer;
import SpinWheelModal from '../../components/SpinWheelModal';
import { fetchMenu, MenuItem } from '../../data/menu';
import { useStore } from '../../context/StoreContext';
import { colors } from '../../constants/theme';

// "High Protein" / "Lower Carb" thresholds — picked against this menu's
// real nutrition numbers (data/menu.ts), not an external diet standard:
// every bowl here is a hearty rice bowl (carbs range ~46-95g), so a strict
// keto-style "low carb" bar would match nothing. "Lower Carb" means lower
// relative to the rest of this menu, not a clinical claim.
const HIGH_PROTEIN_THRESHOLD_G = 30;
const LOWER_CARB_THRESHOLD_G = 55;

type NutritionFilter = 'all' | 'high-protein' | 'lower-carb' | 'vegetarian';

function matchesNutritionFilter(item: MenuItem, filter: NutritionFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'high-protein') return (item.nutrition?.protein ?? 0) >= HIGH_PROTEIN_THRESHOLD_G;
  if (filter === 'lower-carb') return item.nutrition ? item.nutrition.carbs <= LOWER_CARB_THRESHOLD_G : false;
  if (filter === 'vegetarian') return item.tags?.includes('Vegetarian') ?? false;
  return true;
}

export default function MenuScreen() {
  const router = useRouter();
  const { cartCount } = useStore();
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [spinVisible, setSpinVisible] = useState(false);
  const [nutritionFilter, setNutritionFilter] = useState<NutritionFilter>('all');

  useEffect(() => {
    fetchMenu().then(setItems);
  }, []);

  if (!items) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  const bowls = items.filter((item) => item.category === 'Bowls');
  // The globe only ever pins items with `origin` set — for a grouped item
  // (e.g. Chili Döner Freising), only ONE sibling carries `origin` and
  // becomes the actual pin, so filtering by that item's OWN tags/nutrition
  // alone can hide a whole group even when a different sibling matches
  // (e.g. its Falafelteller is Vegetarian but the pinned Döner isn't).
  // Keep the pin if it matches itself, or if any sibling does — the pin's
  // own popup already lets you pick a matching sibling from there. Only
  // for genuinely small "pick one of a few dishes at this one stop"
  // groups, though — Zam Zam Döner's ~70 dishes all share one groupId for
  // an unrelated reason (same shop), so treating that whole group as one
  // interchangeable set would wrongly surface e.g. its chicken döner pin
  // under "Vegetarian" just because a dessert 70 items away qualifies.
  const SIBLING_FALLBACK_MAX_GROUP_SIZE = 6;
  const filteredBowls = bowls.filter((item) => {
    if (!item.origin) return false;
    if (matchesNutritionFilter(item, nutritionFilter)) return true;
    if (!item.groupId) return false;
    const groupSiblings = bowls.filter((sibling) => sibling.groupId === item.groupId);
    if (groupSiblings.length > SIBLING_FALLBACK_MAX_GROUP_SIZE) return false;
    return groupSiblings.some((sibling) => matchesNutritionFilter(sibling, nutritionFilter));
  });

  return (
    <View style={styles.screen}>
      {/* A tapped globe pin can grow much taller than one viewport (photo +
          fact cards + customize controls) — this has to scroll internally
          rather than being clipped, while the header icons below stay
          fixed on top of it (outside the ScrollView) exactly as before. */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <Explorer
          items={filteredBowls}
          onSelect={(item) => router.push(`/item/${item.id}`)}
          activeFilter={nutritionFilter}
          onFilterChange={setNutritionFilter}
        />
      </ScrollView>

      <Pressable style={styles.spinButton} onPress={() => setSpinVisible(true)}>
        <Ionicons name="shuffle-outline" size={20} color={colors.forest} />
      </Pressable>

      <Pressable style={styles.shopButton} onPress={() => router.push('/shop')}>
        <Ionicons name="leaf-outline" size={20} color={colors.forest} />
      </Pressable>

      <Pressable style={styles.cartButton} onPress={() => router.push('/(tabs)/cart')}>
        <Ionicons name="cart-outline" size={22} color={colors.forest} />
        {cartCount > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartCount}</Text>
          </View>
        )}
      </Pressable>

      <SpinWheelModal
        visible={spinVisible}
        items={items}
        onClose={() => setSpinVisible(false)}
        onSelect={(item) => {
          setSpinVisible(false);
          router.push(`/item/${item.id}`);
        }}
      />
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
  spinButton: {
    position: 'absolute',
    top: 68,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  shopButton: {
    position: 'absolute',
    top: 120,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  cartButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});
