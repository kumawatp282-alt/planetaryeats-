// Self-serve ordering kiosk — a completely separate mode from the regular
// website (no header/nav, no sign-in, no delivery/address logic). Meant
// to run full-screen on an iPad at the counter. One stateful screen
// rather than a multi-route flow, matching how /staff and /rider are
// also single, self-contained kiosk routes.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { fetchMenu, MenuItem } from '../data/menu';
import { KIOSK_CATEGORIES, kioskCategoryKey, KioskCategory } from '../data/kioskCategories';
import { KioskHomeSettings, lineUnitPrice, useStore } from '../context/StoreContext';
import { colors, radii, shadow, spacing, typography } from '../constants/theme';
import { formatPrice } from '../lib/format';
import { supabase } from '../lib/supabase';
import { chargeOnReader, connectReader } from '../lib/cardTerminal';
import KioskItemModal from '../components/KioskItemModal';
import QrCode from '../components/QrCode';

// Makes "Share -> Add to Home Screen" (while actually on /kiosk in Safari)
// launch as a true full-screen app with no address bar, tab bar, or
// "planetaryeats.com" shown anywhere — Safari only does this for a page
// that declares itself installable this way, and only for the page it was
// added from. Scoped to this route via expo-router/head, so it has zero
// effect on the regular site.
function KioskHeadTags() {
  return (
    <Head>
      <title>Order Kiosk</title>
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Order Kiosk" />
      <link rel="apple-touch-icon" href="/planetary-eats-logo.png" />
    </Head>
  );
}

type KioskScreen = 'idle' | 'menu' | 'cart' | 'payment' | 'confirmation';

const IDLE_TIMEOUT_MS = 120000; // reset to idle after 2 minutes of no interaction
const CONFIRMATION_AUTO_RESET_MS = 15000;

// This kiosk lives at the physical Zam Zam Döner counter — only their own
// dishes belong on it, not Planetary Eats' delivery-only bowls.
const ZAMZAM_GROUP_ID = 'zam-zam-doner';

// A sentinel activeCategory value for the browse-everything landing panel
// (admin-configurable featured tiles + popular items) — distinct from any
// real KIOSK_CATEGORIES key.
const HOME_KEY = 'home';

export default function KioskScreen() {
  const params = useLocalSearchParams<{ confirmed?: string; orderId?: string }>();
  const {
    cart,
    cartCount,
    cartSubtotal,
    updateQuantity,
    removeFromCart,
    clearCart,
    placeKioskOrder,
    kioskHomeSettings,
    appSettings,
    lookupVoucherByCode,
  } = useStore();

  const [screen, setScreen] = useState<KioskScreen>('idle');
  const [menuItems, setMenuItems] = useState<MenuItem[] | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(HOME_KEY);
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [readerConnected, setReaderConnected] = useState(false);
  const [readerChecking, setReaderChecking] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Awaited<ReturnType<typeof lookupVoucherByCode>>>(null);
  const [promoApplied, setPromoApplied] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const promoCode = appSettings.promoCode.trim().toUpperCase();
  const discount = appliedVoucher
    ? Math.min(
        appliedVoucher.type === 'percent' ? cartSubtotal * (appliedVoucher.value / 100) : appliedVoucher.value,
        cartSubtotal
      )
    : promoApplied
    ? cartSubtotal * appSettings.promoDiscount
    : 0;
  const cartTotal = Math.max(cartSubtotal - discount, 0);

  const applyCode = async () => {
    const raw = promoInput.trim();
    if (!raw) return;
    setCodeError(null);
    const upper = raw.toUpperCase();
    if (promoCode && upper === promoCode) {
      setPromoApplied(true);
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
  };

  const removeCode = () => {
    setAppliedVoucher(null);
    setPromoApplied(false);
    setPromoInput('');
    setCodeError(null);
  };

  // Best-effort, silent attempt at startup to find a paired Stripe Terminal
  // card reader (see lib/cardTerminal.ts). If none is set up yet — the
  // default today — this just quietly stays false and "Pay by card" keeps
  // using the existing browser checkout redirect below.
  useEffect(() => {
    connectReader().then((r) => setReaderConnected(r.connected));
  }, []);

  const recheckReader = async () => {
    setReaderChecking(true);
    const r = await connectReader();
    setReaderConnected(r.connected);
    setReaderChecking(false);
  };

  // Returning here from Stripe after a card payment.
  useEffect(() => {
    if (params.confirmed === '1' && params.orderId) {
      setConfirmedOrderId(String(params.orderId));
      setScreen('confirmation');
      clearCart();
      removeCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.confirmed, params.orderId]);

  useEffect(() => {
    fetchMenu().then(setMenuItems);
  }, []);

  const resetIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (screen === 'idle' || screen === 'confirmation') return;
    idleTimer.current = setTimeout(() => {
      clearCart();
      removeCode();
      setActiveCategory(HOME_KEY);
      setScreen('idle');
    }, IDLE_TIMEOUT_MS);
  };

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    if (screen !== 'confirmation') return;
    const t = setTimeout(() => {
      setScreen('idle');
      setConfirmedOrderId(null);
    }, CONFIRMATION_AUTO_RESET_MS);
    return () => clearTimeout(t);
  }, [screen]);

  const startOrder = () => {
    clearCart();
    removeCode();
    setOrderError(null);
    setActiveCategory(HOME_KEY);
    setScreen('menu');
  };

  // "Start Again" on the bottom bar — same reset as walking away and
  // coming back, without waiting for the idle timeout.
  const startOver = () => {
    clearCart();
    removeCode();
    setOrderError(null);
    setActiveCategory(HOME_KEY);
    setScreen('menu');
  };

  const handlePayCounter = async () => {
    setPlacing(true);
    setOrderError(null);
    const orderId = await placeKioskOrder(
      'kiosk-counter',
      appliedVoucher?.id,
      promoApplied ? promoCode : undefined
    );
    setPlacing(false);
    if (!orderId) {
      setOrderError("Sorry, that didn't go through — please try again or ask a staff member.");
      return;
    }
    setConfirmedOrderId(orderId);
    setScreen('confirmation');
  };

  const handlePayCard = async () => {
    setPlacing(true);
    setOrderError(null);
    const orderId = await placeKioskOrder(
      'kiosk-card',
      appliedVoucher?.id,
      promoApplied ? promoCode : undefined
    );
    if (!orderId) {
      setPlacing(false);
      setOrderError("Sorry, that didn't go through — please try again or ask a staff member.");
      return;
    }

    // A physical card reader (Stripe Terminal) takes priority when one's
    // connected — the customer taps/inserts their card on the reader
    // itself, which also shows the amount there. Falls through to the
    // browser checkout redirect below when no reader is set up.
    if (readerConnected) {
      const result = await chargeOnReader(orderId);
      setPlacing(false);
      if (result.success) {
        setConfirmedOrderId(orderId);
        setScreen('confirmation');
      } else {
        setOrderError(result.error || "Card payment didn't go through on the reader — please try again or pay at counter.");
      }
      return;
    }

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          origin: window.location.origin,
          successPath: '/kiosk?confirmed=1',
          cancelPath: '/kiosk',
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch (e) {
      // fall through — order is already placed either way, same pattern as the main checkout
    }
    setPlacing(false);
    setConfirmedOrderId(orderId);
    setScreen('confirmation');
  };

  return (
    <View style={styles.screen} onTouchStart={resetIdleTimer}>
      <KioskHeadTags />
      {screen === 'idle' && <IdleScreen onStart={startOrder} promoImageUrl={kioskHomeSettings.idlePromoImageUrl} />}

      {screen === 'menu' && (
        <MenuScreen
          items={menuItems}
          homeSettings={kioskHomeSettings}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onSelectItem={setCustomizeItem}
          cartCount={cartCount}
          cartSubtotal={cartSubtotal}
          onViewCart={() => setScreen('cart')}
          onStartOver={startOver}
        />
      )}

      {screen === 'cart' && (
        <CartScreen
          cart={cart}
          subtotal={cartSubtotal}
          discount={discount}
          total={cartTotal}
          onUpdateQuantity={updateQuantity}
          onRemove={removeFromCart}
          onBackToMenu={() => setScreen('menu')}
          onCheckout={() => setScreen('payment')}
          promoInput={promoInput}
          onPromoInputChange={setPromoInput}
          onApplyCode={applyCode}
          onRemoveCode={removeCode}
          codeApplied={!!appliedVoucher || promoApplied}
          codeError={codeError}
          checkingCode={checkingCode}
          appliedLabel={appliedVoucher ? appliedVoucher.description : promoApplied ? `Promo (${promoCode})` : null}
        />
      )}

      {screen === 'payment' && (
        <PaymentScreen
          subtotal={cartTotal}
          placing={placing}
          error={orderError}
          readerConnected={readerConnected}
          readerChecking={readerChecking}
          onBack={() => setScreen('cart')}
          onPayCounter={handlePayCounter}
          onPayCard={handlePayCard}
          onRecheckReader={recheckReader}
        />
      )}

      {screen === 'confirmation' && confirmedOrderId && (
        <ConfirmationScreen
          orderId={confirmedOrderId}
          onDone={() => {
            setScreen('idle');
            setConfirmedOrderId(null);
          }}
        />
      )}

      <KioskItemModal visible={!!customizeItem} item={customizeItem} onClose={() => setCustomizeItem(null)} />
    </View>
  );
}

function IdleScreen({ onStart, promoImageUrl }: { onStart: () => void; promoImageUrl: string | null }) {
  if (promoImageUrl) {
    return (
      <Pressable style={styles.idlePromoScreen} onPress={onStart}>
        <Image source={{ uri: promoImageUrl }} style={styles.idlePromoImage} resizeMode="cover" />
        <View style={styles.idlePromoOverlay}>
          <Text style={styles.idlePromoTapText}>Tap anywhere to start your order</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.idleScreen} onPress={onStart}>
      <View style={styles.poweredByTop}>
        <Image
          source={require('../assets/planetary-eats-logo.png')}
          style={styles.poweredByLogo}
          resizeMode="contain"
        />
        <Text style={styles.poweredByText}>Order on planetaryeats.com</Text>
      </View>

      <View style={styles.zamzamBadge}>
        <Image
          source={require('../assets/zamzam-logo.png')}
          style={styles.zamzamLogo}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.idleTitle}>Welcome!</Text>
      <Text style={styles.idleSubtitle}>Tap anywhere to start your order</Text>
    </Pressable>
  );
}

function ItemCard({ item, accentColor, onPress }: { item: MenuItem; accentColor: string; onPress: () => void }) {
  return (
    <Pressable style={styles.gridCard} onPress={onPress}>
      <View style={[styles.gridImageWrap, { backgroundColor: accentColor + '22' }]}>
        {item.dishImage ? (
          <Image source={item.dishImage} style={styles.gridImagePhoto} resizeMode="cover" />
        ) : (
          <Text style={styles.gridEmoji}>{item.emoji}</Text>
        )}
        <View style={styles.addBadge}>
          <Text style={styles.addBadgeText}>+</Text>
        </View>
      </View>
      <Text style={styles.gridName} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={styles.gridPrice}>{formatPrice(item.price)}</Text>
    </Pressable>
  );
}

function MenuScreen({
  items,
  homeSettings,
  activeCategory,
  onCategoryChange,
  onSelectItem,
  cartCount,
  cartSubtotal,
  onViewCart,
  onStartOver,
}: {
  items: MenuItem[] | null;
  homeSettings: KioskHomeSettings;
  activeCategory: string;
  onCategoryChange: (c: string) => void;
  onSelectItem: (item: MenuItem) => void;
  cartCount: number;
  cartSubtotal: number;
  onViewCart: () => void;
  onStartOver: () => void;
}) {
  if (!items) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.forest} size="large" />
      </View>
    );
  }

  const zamzamItems = items.filter((i) => i.groupId === ZAMZAM_GROUP_ID);
  const grouped: Record<string, MenuItem[]> = {};
  zamzamItems.forEach((item) => {
    const key = kioskCategoryKey(item);
    (grouped[key] ??= []).push(item);
  });
  const itemsById = new Map(zamzamItems.map((item) => [item.id, item]));
  const availableCategories = KIOSK_CATEGORIES.filter((c) => grouped[c.key]?.length);
  const isHome = activeCategory === HOME_KEY;
  const effectiveKey = isHome ? HOME_KEY : grouped[activeCategory]?.length ? activeCategory : availableCategories[0]?.key;
  const activeMeta = availableCategories.find((c) => c.key === effectiveKey);
  const visible = effectiveKey && !isHome ? grouped[effectiveKey] ?? [] : [];

  const featuredCategories = homeSettings.featuredCategoryKeys
    .map((key) => availableCategories.find((c) => c.key === key))
    .filter((c): c is KioskCategory => Boolean(c));
  const popularItems = homeSettings.popularItemIds
    .map((id) => itemsById.get(id))
    .filter((item): item is MenuItem => Boolean(item));

  const iconFor = (key: string) => homeSettings.categoryImages?.[key];

  return (
    <View style={styles.menuLayout}>
      <ScrollView style={styles.sidebar} contentContainerStyle={styles.sidebarContent}>
        <View style={styles.sidebarBrand}>
          <Image source={require('../assets/zamzam-logo.png')} style={styles.sidebarBrandLogo} resizeMode="contain" />
        </View>

        <Pressable
          style={[styles.sidebarItem, isHome && { backgroundColor: colors.forest + '17' }]}
          onPress={() => onCategoryChange(HOME_KEY)}
        >
          <View style={[styles.sidebarIconWrap, { backgroundColor: colors.forest + (isHome ? '33' : '18') }]}>
            <Text style={styles.sidebarEmoji}>🏠</Text>
          </View>
          <Text style={[styles.sidebarLabel, isHome && { color: colors.ink, fontWeight: '700' }]} numberOfLines={1}>
            Home
          </Text>
        </Pressable>

        {availableCategories.map((c) => {
          const active = c.key === effectiveKey && !isHome;
          const photo = iconFor(c.key);
          return (
            <Pressable
              key={c.key}
              style={[styles.sidebarItem, active && { backgroundColor: c.color + '17' }]}
              onPress={() => onCategoryChange(c.key)}
            >
              <View style={[styles.sidebarIconWrap, { backgroundColor: c.color + (active ? '33' : '18') }]}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.sidebarIconPhoto} resizeMode="cover" />
                ) : (
                  <Text style={styles.sidebarEmoji}>{c.emoji}</Text>
                )}
              </View>
              <Text style={[styles.sidebarLabel, active && { color: colors.ink, fontWeight: '700' }]} numberOfLines={1}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.mainPanel}>
        {isHome ? (
          <ScrollView contentContainerStyle={styles.homeContent}>
            {featuredCategories.length > 0 && (
              <View style={styles.homeSection}>
                <Text style={styles.homeSectionTitle}>Discover our menu</Text>
                <View style={styles.tileGrid}>
                  {featuredCategories.map((c) => {
                    const photo = iconFor(c.key);
                    return (
                      <Pressable
                        key={c.key}
                        style={[styles.tile, !photo && { backgroundColor: c.color + '17' }]}
                        onPress={() => onCategoryChange(c.key)}
                      >
                        {photo ? (
                          <>
                            <Image source={{ uri: photo }} style={styles.tilePhoto} resizeMode="cover" />
                            <View style={styles.tilePhotoOverlay} />
                            <Text style={[styles.tileLabel, styles.tileLabelOnPhoto]}>{c.label}</Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.tileEmoji}>{c.emoji}</Text>
                            <Text style={styles.tileLabel}>{c.label}</Text>
                          </>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {popularItems.length > 0 && (
              <View style={styles.homeSection}>
                <Text style={styles.homeSectionTitle}>Popular Choices</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.popularRow}>
                    {popularItems.map((item) => (
                      <ItemCard key={item.id} item={item} accentColor={colors.forest} onPress={() => onSelectItem(item)} />
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </ScrollView>
        ) : (
          <>
            {activeMeta && <Text style={styles.categoryHeading}>{activeMeta.label}</Text>}
            <ScrollView contentContainerStyle={styles.grid}>
              {visible.map((item) => (
                <ItemCard key={item.id} item={item} accentColor={activeMeta?.color ?? colors.forest} onPress={() => onSelectItem(item)} />
              ))}
            </ScrollView>
          </>
        )}
      </View>

      <View style={styles.bottomBar}>
        <Text style={styles.bottomBarTotal}>{cartCount > 0 ? formatPrice(cartSubtotal) : '—'}</Text>
        <Pressable style={styles.bottomBarSecondary} onPress={onStartOver}>
          <Text style={styles.bottomBarSecondaryText}>Start Again</Text>
        </Pressable>
        <Pressable
          style={[styles.bottomBarPrimary, cartCount === 0 && styles.bottomBarPrimaryDisabled]}
          onPress={onViewCart}
          disabled={cartCount === 0}
        >
          <Text style={styles.bottomBarPrimaryText}>
            {cartCount > 0 ? `View My Order (${cartCount})` : 'View My Order'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function CartScreen({
  cart,
  subtotal,
  discount,
  total,
  onUpdateQuantity,
  onRemove,
  onBackToMenu,
  onCheckout,
  promoInput,
  onPromoInputChange,
  onApplyCode,
  onRemoveCode,
  codeApplied,
  codeError,
  checkingCode,
  appliedLabel,
}: {
  cart: ReturnType<typeof useStore>['cart'];
  subtotal: number;
  discount: number;
  total: number;
  onUpdateQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onBackToMenu: () => void;
  onCheckout: () => void;
  promoInput: string;
  onPromoInputChange: (v: string) => void;
  onApplyCode: () => void;
  onRemoveCode: () => void;
  codeApplied: boolean;
  codeError: string | null;
  checkingCode: boolean;
  appliedLabel: string | null;
}) {
  return (
    <View style={styles.contentScreen}>
      <Text style={styles.screenTitle}>Your order</Text>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {cart.length === 0 && <Text style={typography.bodyMuted}>Your order is empty.</Text>}
        {cart.map((line) => (
          <View key={line.lineId} style={styles.cartLine}>
            <View style={{ flex: 1 }}>
              <Text style={typography.h3}>{line.item.name}</Text>
              {line.selectedProtein && <Text style={typography.bodyMuted}>{line.selectedProtein}</Text>}
              <Text style={typography.bodyMuted}>{formatPrice(lineUnitPrice(line))} each</Text>
              <Pressable onPress={() => onRemove(line.lineId)} style={{ marginTop: spacing.xs }}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
            <View style={styles.cartLineQty}>
              <Pressable
                style={styles.qtyButton}
                onPress={() => onUpdateQuantity(line.lineId, Math.max(0, line.quantity - 1))}
              >
                <Text style={styles.qtyButtonText}>−</Text>
              </Pressable>
              <Text style={styles.qtyValue}>{line.quantity}</Text>
              <Pressable style={styles.qtyButton} onPress={() => onUpdateQuantity(line.lineId, line.quantity + 1)}>
                <Text style={styles.qtyButtonText}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {cart.length > 0 && (
          <View style={styles.codeSection}>
            <Text style={typography.label}>VOUCHER OR GIFT CODE</Text>
            <View style={styles.codeRow}>
              <TextInput
                value={promoInput}
                onChangeText={onPromoInputChange}
                placeholder="Enter code"
                placeholderTextColor={colors.inkMuted}
                autoCapitalize="characters"
                editable={!codeApplied}
                style={[styles.input, { flex: 1 }]}
              />
              <Pressable
                style={[styles.codeButton, codeApplied && styles.codeButtonDisabled]}
                onPress={codeApplied ? onRemoveCode : onApplyCode}
                disabled={checkingCode}
              >
                <Text style={styles.codeButtonText}>
                  {checkingCode ? '…' : codeApplied ? 'Remove' : 'Apply'}
                </Text>
              </Pressable>
            </View>
            {codeError && <Text style={styles.errorText}>{codeError}</Text>}
            {appliedLabel && <Text style={styles.codeAppliedText}>Applied: {appliedLabel}</Text>}

            <View style={styles.totalsBlock}>
              <View style={styles.totalsRow}>
                <Text style={typography.bodyMuted}>Subtotal</Text>
                <Text style={typography.body}>{formatPrice(subtotal)}</Text>
              </View>
              {discount > 0 && (
                <View style={styles.totalsRow}>
                  <Text style={[typography.bodyMuted, { color: colors.forest }]}>Discount</Text>
                  <Text style={[typography.body, { color: colors.forest }]}>−{formatPrice(discount)}</Text>
                </View>
              )}
              <View style={[styles.totalsRow, { marginTop: spacing.xs }]}>
                <Text style={typography.h3}>Total</Text>
                <Text style={typography.h3}>{formatPrice(total)}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footerBar}>
        <Pressable style={styles.secondaryButton} onPress={onBackToMenu}>
          <Text style={styles.secondaryButtonText}>Add more items</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, cart.length === 0 && styles.primaryButtonDisabled]}
          onPress={onCheckout}
          disabled={cart.length === 0}
        >
          <Text style={styles.primaryButtonText}>Checkout · {formatPrice(total)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PaymentScreen({
  subtotal,
  placing,
  error,
  readerConnected,
  readerChecking,
  onBack,
  onPayCounter,
  onPayCard,
  onRecheckReader,
}: {
  subtotal: number;
  placing: boolean;
  error: string | null;
  readerConnected: boolean;
  readerChecking: boolean;
  onBack: () => void;
  onPayCounter: () => void;
  onPayCard: () => void;
  onRecheckReader: () => void;
}) {
  return (
    <View style={styles.contentScreen}>
      <Text style={styles.screenTitle}>How would you like to pay?</Text>
      <Text style={[typography.h2, { textAlign: 'center', marginTop: spacing.sm }]}>{formatPrice(subtotal)}</Text>

      <View style={styles.paymentOptions}>
        <Pressable style={styles.paymentCard} onPress={onPayCard} disabled={placing}>
          <Text style={styles.paymentEmoji}>💳</Text>
          <Text style={styles.paymentLabel}>Pay by card</Text>
          <Text style={typography.bodyMuted}>
            {readerConnected ? 'Tap or insert card on the reader' : 'Card or Apple Pay, right here'}
          </Text>
        </Pressable>
        <Pressable style={styles.paymentCard} onPress={onPayCounter} disabled={placing}>
          <Text style={styles.paymentEmoji}>🧾</Text>
          <Text style={styles.paymentLabel}>Pay at counter</Text>
          <Text style={typography.bodyMuted}>We'll take your payment there</Text>
        </Pressable>
      </View>

      <Pressable style={styles.readerStatusRow} onPress={onRecheckReader} disabled={readerChecking}>
        <Text style={styles.readerStatusText}>
          {readerChecking
            ? 'Checking for card reader…'
            : readerConnected
            ? '🟢 Card reader connected'
            : '⚪ No card reader connected — tap to search'}
        </Text>
      </Pressable>

      {placing && <ActivityIndicator color={colors.forest} style={{ marginTop: spacing.lg }} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable style={[styles.secondaryButton, { marginTop: spacing.xl }]} onPress={onBack} disabled={placing}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </Pressable>
    </View>
  );
}

function ConfirmationScreen({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [receipt, setReceipt] = useState<{ lines: any[]; total: number } | null>(null);

  // Guest-safe lookup (see supabase/kiosk_receipt_schema.sql) — kiosk
  // customers never sign in, so there's no loaded order list to read this
  // back from the way the regular website's /receipt page does.
  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc('kiosk_order_receipt', { p_order_id: orderId })
      .then(({ data }: any) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (!cancelled && row) setReceipt({ lines: row.lines ?? [], total: Number(row.total) });
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const receiptUrl = typeof window !== 'undefined' ? `${window.location.origin}/kiosk-receipt/${orderId}` : '';

  return (
    <ScrollView contentContainerStyle={styles.confirmationScreen}>
      <Text style={styles.confirmationEmoji}>✅</Text>
      <Text style={styles.idleTitle}>Order placed!</Text>
      <Text style={styles.orderNumber}>{orderId}</Text>
      <Text style={styles.idleSubtitle}>Please wait to be called — thank you!</Text>

      {receipt && (
        <View style={styles.receiptCard}>
          {receipt.lines.map((line: any, i: number) => (
            <View key={i} style={styles.receiptLine}>
              <Text style={typography.body} numberOfLines={1}>
                {line.quantity}× {line.item?.name}
              </Text>
              <Text style={typography.body}>{formatPrice(lineUnitPrice(line) * line.quantity)}</Text>
            </View>
          ))}
          <View style={styles.receiptTotalLine}>
            <Text style={typography.h3}>Total</Text>
            <Text style={typography.h3}>{formatPrice(receipt.total)}</Text>
          </View>
        </View>
      )}

      {receiptUrl !== '' && (
        <View style={styles.qrWrap}>
          <QrCode value={receiptUrl} size={120} />
          <Text style={styles.qrCaption}>Scan for a receipt on your phone</Text>
        </View>
      )}

      <Pressable style={[styles.primaryButton, { marginTop: spacing.xl, width: 280 }]} onPress={onDone}>
        <Text style={styles.primaryButtonText}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  idleScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  idlePromoScreen: {
    flex: 1,
  },
  idlePromoImage: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  idlePromoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  idlePromoTapText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  confirmationScreen: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  receiptCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  receiptLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  receiptTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  qrWrap: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  qrCaption: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.inkMuted,
  },
  readerStatusRow: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
  },
  readerStatusText: {
    fontSize: 13,
    color: colors.inkMuted,
    fontWeight: '600',
  },
  confirmationEmoji: {
    fontSize: 96,
    marginBottom: spacing.lg,
  },
  poweredByTop: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  poweredByLogo: {
    width: 90,
    height: 90,
  },
  poweredByText: {
    marginTop: -spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  zamzamBadge: {
    backgroundColor: '#1A1A1A',
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  zamzamLogo: {
    width: 520,
    height: 189,
  },
  idleTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.ink,
  },
  idleSubtitle: {
    fontSize: 20,
    color: colors.inkMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  orderNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.forest,
    marginTop: spacing.md,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentScreen: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  menuLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 132,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.cream,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  sidebarContent: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  sidebarBrand: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  sidebarBrandLogo: {
    width: 104,
    height: 38,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
  },
  sidebarIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sidebarIconPhoto: {
    width: '100%',
    height: '100%',
  },
  sidebarEmoji: {
    fontSize: 16,
  },
  sidebarLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  mainPanel: {
    flex: 1,
  },
  categoryHeading: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 120,
  },
  gridCard: {
    width: 230,
    backgroundColor: colors.cream,
    borderRadius: radii.lg,
    padding: spacing.sm,
    ...shadow.card,
  },
  gridImageWrap: {
    width: '100%',
    height: 140,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridImagePhoto: {
    width: '100%',
    height: '100%',
    borderRadius: radii.md,
  },
  gridEmoji: {
    fontSize: 56,
  },
  addBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  addBadgeText: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
    marginTop: -2,
  },
  gridName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.sm,
  },
  gridPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.forest,
    marginTop: spacing.xs,
  },
  homeContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  homeSection: {
    marginBottom: spacing.xl,
  },
  homeSectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.md,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    width: 260,
    height: 100,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  tileEmoji: {
    fontSize: 34,
  },
  tileLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  tilePhoto: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  tilePhotoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  tileLabelOnPhoto: {
    color: colors.white,
  },
  popularRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow.card,
  },
  bottomBarTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    minWidth: 80,
  },
  bottomBarSecondary: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bottomBarSecondaryText: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 15,
  },
  bottomBarPrimary: {
    flex: 1,
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  bottomBarPrimaryDisabled: {
    opacity: 0.4,
  },
  bottomBarPrimaryText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  cartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  removeText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  cartLineQty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qtyButton: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  qtyValue: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  codeSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  codeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.ink,
  },
  codeButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeButtonDisabled: {
    backgroundColor: colors.danger,
  },
  codeButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  codeAppliedText: {
    color: colors.forest,
    fontWeight: '600',
    fontSize: 13,
    marginTop: spacing.xs,
  },
  totalsBlock: {
    marginTop: spacing.lg,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  footerBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 17,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 17,
  },
  paymentOptions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  paymentCard: {
    width: 260,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.card,
  },
  paymentEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  paymentLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  errorText: {
    color: colors.danger,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});
