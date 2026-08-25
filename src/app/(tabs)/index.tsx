import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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

export default function MenuScreen() {
  const router = useRouter();
  const { cartCount } = useStore();
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [spinVisible, setSpinVisible] = useState(false);

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

  return (
    <View style={styles.screen}>
      <Explorer items={bowls} onSelect={(item) => router.push(`/item/${item.id}`)} />

      <Pressable style={styles.dealBanner} onPress={() => router.push('/(tabs)/cart')}>
        <Text style={styles.dealText}>🎉 Deal of the month — 10% off with code WORLD10 at checkout</Text>
      </Pressable>

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
  dealBanner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 72,
    backgroundColor: 'rgba(223,162,78,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(223,162,78,0.4)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  dealText: {
    color: '#8A5A22',
    fontSize: 12,
    fontWeight: '600',
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
    shadowColor: '#3A2E1E',
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
    shadowColor: '#3A2E1E',
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
    shadowColor: '#3A2E1E',
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
    color: '#1B1B18',
    fontSize: 11,
    fontWeight: '700',
  },
});
