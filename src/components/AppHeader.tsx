// Persistent top bar, shown above every screen (wired in app/_layout.tsx):
// back/brand, delivery address, Delivery/Collection toggle, language, menu.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../context/StoreContext';
import { colors, radii, spacing } from '../constants/theme';
import { getOpenStatus } from '../lib/openingHours';
import AddressModal from './AddressModal';
import NavMenu from './NavMenu';

const PAGE_TITLES: Record<string, string> = {
  '/cart': 'Your cart',
  '/orders': 'Your orders',
  '/profile': 'Profile',
  '/checkout': 'Checkout',
  '/shop': 'Eco Shop',
  '/order-confirmation': 'Order confirmed',
  '/admin': 'Admin panel',
  '/impressum': 'Impressum',
  '/datenschutz': 'Datenschutz',
  '/nutrition': "Today's intake",
};

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { fulfillmentMethod, setFulfillmentMethod, deliveryAddress, appSettings } = useStore();
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [navVisible, setNavVisible] = useState(false);
  const [langMenuVisible, setLangMenuVisible] = useState(false);

  const isHome = pathname === '/';
  const hideBack = isHome || pathname === '/order-confirmation';
  const pageTitle = PAGE_TITLES[pathname];

  const addressLabel =
    fulfillmentMethod === 'pickup'
      ? `Collection · ${appSettings.restaurantName}`
      : deliveryAddress
      ? deliveryAddress
      : 'Set delivery address';

  const openStatus = getOpenStatus(appSettings.openingHours);

  return (
    <View style={styles.bar} nativeID="pe-app-header">
      <View style={styles.leftGroup}>
        {!hideBack && (
          <Pressable style={styles.iconButton} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </Pressable>
        )}
        <Pressable onPress={() => router.push('/')} style={styles.brandWrap}>
          <Text style={styles.brandText} numberOfLines={1}>
            Planetary Eats
          </Text>
          {pageTitle && <Text style={styles.pageTitleText}>{pageTitle}</Text>}
        </Pressable>
      </View>

      <Pressable style={styles.addressPill} onPress={() => setAddressModalVisible(true)}>
        <Ionicons name="location-outline" size={14} color={colors.forest} />
        <Text style={styles.addressText} numberOfLines={1}>
          {addressLabel}
        </Text>
      </Pressable>

      <View style={styles.statusPill}>
        <View style={[styles.statusDot, { backgroundColor: openStatus.isOpen ? colors.forest : colors.danger }]} />
        <Text style={styles.statusText} numberOfLines={1}>
          {openStatus.message}
        </Text>
      </View>

      <View style={styles.methodToggle}>
        <Pressable
          style={[styles.methodOption, fulfillmentMethod === 'delivery' && styles.methodOptionActive]}
          onPress={() => setFulfillmentMethod('delivery')}
        >
          <Ionicons
            name="bicycle-outline"
            size={14}
            color={fulfillmentMethod === 'delivery' ? colors.white : colors.inkMuted}
          />
          <Text style={[styles.methodOptionText, fulfillmentMethod === 'delivery' && styles.methodOptionTextActive]}>
            Delivery
          </Text>
        </Pressable>
        <Pressable
          style={[styles.methodOption, fulfillmentMethod === 'pickup' && styles.methodOptionActive]}
          onPress={() => setFulfillmentMethod('pickup')}
        >
          <Ionicons
            name="storefront-outline"
            size={14}
            color={fulfillmentMethod === 'pickup' ? colors.white : colors.inkMuted}
          />
          <Text style={[styles.methodOptionText, fulfillmentMethod === 'pickup' && styles.methodOptionTextActive]}>
            Collection
          </Text>
        </Pressable>
      </View>

      <View style={styles.rightGroup}>
        <View>
          <Pressable style={styles.iconButton} onPress={() => setLangMenuVisible((v) => !v)}>
            <Text style={{ fontSize: 18 }}>🇩🇪</Text>
          </Pressable>
          {langMenuVisible && (
            <>
              <Pressable style={styles.langBackdrop} onPress={() => setLangMenuVisible(false)} />
              <View style={styles.langMenu}>
                <View style={styles.langRow}>
                  <Text style={{ fontSize: 16 }}>🇩🇪</Text>
                  <Text style={styles.langActiveText}>Deutsch</Text>
                </View>
                <View style={[styles.langRow, { opacity: 0.4 }]}>
                  <Text style={{ fontSize: 16 }}>🇬🇧</Text>
                  <Text style={styles.langText}>English — coming soon</Text>
                </View>
              </View>
            </>
          )}
        </View>
        <Pressable style={styles.iconButton} onPress={() => setNavVisible(true)}>
          <Ionicons name="menu-outline" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <AddressModal visible={addressModalVisible} onClose={() => setAddressModalVisible(false)} />
      <NavMenu visible={navVisible} onClose={() => setNavVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 40,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandWrap: {
    marginLeft: 2,
  },
  brandText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: 'Fraunces, Georgia, serif',
  },
  pageTitleText: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: -2,
  },
  addressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: 220,
  },
  addressText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: colors.cream,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
  },
  methodOptionActive: {
    backgroundColor: colors.forest,
  },
  methodOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  methodOptionTextActive: {
    color: colors.white,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 'auto',
  },
  langBackdrop: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
  },
  langMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    width: 180,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    zIndex: 50,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  langActiveText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  langText: {
    fontSize: 12,
    color: colors.inkMuted,
  },
});
