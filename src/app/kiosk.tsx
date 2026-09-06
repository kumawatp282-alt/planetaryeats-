// Self-serve ordering kiosk — a completely separate mode from the regular
// website (no header/nav, no sign-in, no delivery/address logic). Meant
// to run full-screen on an iPad at the counter. One stateful screen
// rather than a multi-route flow, matching how /staff and /rider are
// also single, self-contained kiosk routes.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { Category, categories, fetchMenu, MenuItem } from '../data/menu';
import { lineUnitPrice, useStore } from '../context/StoreContext';
import { colors, radii, shadow, spacing, typography } from '../constants/theme';
import { formatPrice } from '../lib/format';
import KioskItemModal from '../components/KioskItemModal';

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

export default function KioskScreen() {
  const params = useLocalSearchParams<{ confirmed?: string; orderId?: string }>();
  const { cart, cartCount, cartSubtotal, updateQuantity, removeFromCart, clearCart, placeKioskOrder } = useStore();

  const [screen, setScreen] = useState<KioskScreen>('idle');
  const [menuItems, setMenuItems] = useState<MenuItem[] | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('Bowls');
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Returning here from Stripe after a card payment.
  useEffect(() => {
    if (params.confirmed === '1' && params.orderId) {
      setConfirmedOrderId(String(params.orderId));
      setScreen('confirmation');
      clearCart();
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
    setOrderError(null);
    setScreen('menu');
  };

  const handlePayCounter = async () => {
    setPlacing(true);
    setOrderError(null);
    const orderId = await placeKioskOrder('kiosk-counter');
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
    const orderId = await placeKioskOrder('kiosk-card');
    if (!orderId) {
      setPlacing(false);
      setOrderError("Sorry, that didn't go through — please try again or ask a staff member.");
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
      {screen === 'idle' && <IdleScreen onStart={startOrder} />}

      {screen === 'menu' && (
        <MenuScreen
          items={menuItems}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onSelectItem={setCustomizeItem}
          cartCount={cartCount}
          cartSubtotal={cartSubtotal}
          onViewCart={() => setScreen('cart')}
        />
      )}

      {screen === 'cart' && (
        <CartScreen
          cart={cart}
          subtotal={cartSubtotal}
          onUpdateQuantity={updateQuantity}
          onRemove={removeFromCart}
          onBackToMenu={() => setScreen('menu')}
          onCheckout={() => setScreen('payment')}
        />
      )}

      {screen === 'payment' && (
        <PaymentScreen
          subtotal={cartSubtotal}
          placing={placing}
          error={orderError}
          onBack={() => setScreen('cart')}
          onPayCounter={handlePayCounter}
          onPayCard={handlePayCard}
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

function IdleScreen({ onStart }: { onStart: () => void }) {
  return (
    <Pressable style={styles.idleScreen} onPress={onStart}>
      <Text style={styles.idleEmoji}>🍽️</Text>
      <Text style={styles.idleTitle}>Welcome!</Text>
      <Text style={styles.idleSubtitle}>Tap anywhere to start your order</Text>
    </Pressable>
  );
}

function MenuScreen({
  items,
  activeCategory,
  onCategoryChange,
  onSelectItem,
  cartCount,
  cartSubtotal,
  onViewCart,
}: {
  items: MenuItem[] | null;
  activeCategory: Category;
  onCategoryChange: (c: Category) => void;
  onSelectItem: (item: MenuItem) => void;
  cartCount: number;
  cartSubtotal: number;
  onViewCart: () => void;
}) {
  if (!items) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.forest} size="large" />
      </View>
    );
  }

  const visible = items.filter((i) => i.category === activeCategory);

  return (
    <View style={styles.contentScreen}>
      <View style={styles.categoryRow}>
        {categories.map((c) => (
          <Pressable
            key={c}
            style={[styles.categoryTab, activeCategory === c && styles.categoryTabActive]}
            onPress={() => onCategoryChange(c)}
          >
            <Text style={[styles.categoryTabText, activeCategory === c && styles.categoryTabTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {visible.map((item) => (
          <Pressable key={item.id} style={styles.gridCard} onPress={() => onSelectItem(item)}>
            {item.dishImage ? (
              <Image source={item.dishImage} style={styles.gridImage} resizeMode="cover" />
            ) : (
              <View style={[styles.gridImage, styles.gridImageEmoji]}>
                <Text style={{ fontSize: 40 }}>{item.emoji}</Text>
              </View>
            )}
            <Text style={styles.gridName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.gridPrice}>{formatPrice(item.price)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {cartCount > 0 && (
        <Pressable style={styles.cartBar} onPress={onViewCart}>
          <Text style={styles.cartBarText}>
            View order ({cartCount}) · {formatPrice(cartSubtotal)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function CartScreen({
  cart,
  subtotal,
  onUpdateQuantity,
  onRemove,
  onBackToMenu,
  onCheckout,
}: {
  cart: ReturnType<typeof useStore>['cart'];
  subtotal: number;
  onUpdateQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onBackToMenu: () => void;
  onCheckout: () => void;
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
          <Text style={styles.primaryButtonText}>Checkout · {formatPrice(subtotal)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PaymentScreen({
  subtotal,
  placing,
  error,
  onBack,
  onPayCounter,
  onPayCard,
}: {
  subtotal: number;
  placing: boolean;
  error: string | null;
  onBack: () => void;
  onPayCounter: () => void;
  onPayCard: () => void;
}) {
  return (
    <View style={styles.contentScreen}>
      <Text style={styles.screenTitle}>How would you like to pay?</Text>
      <Text style={[typography.h2, { textAlign: 'center', marginTop: spacing.sm }]}>{formatPrice(subtotal)}</Text>

      <View style={styles.paymentOptions}>
        <Pressable style={styles.paymentCard} onPress={onPayCard} disabled={placing}>
          <Text style={styles.paymentEmoji}>💳</Text>
          <Text style={styles.paymentLabel}>Pay by card</Text>
          <Text style={typography.bodyMuted}>Card or Apple Pay, right here</Text>
        </Pressable>
        <Pressable style={styles.paymentCard} onPress={onPayCounter} disabled={placing}>
          <Text style={styles.paymentEmoji}>🧾</Text>
          <Text style={styles.paymentLabel}>Pay at counter</Text>
          <Text style={typography.bodyMuted}>We'll take your payment there</Text>
        </Pressable>
      </View>

      {placing && <ActivityIndicator color={colors.forest} style={{ marginTop: spacing.lg }} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable style={[styles.secondaryButton, { marginTop: spacing.xl }]} onPress={onBack} disabled={placing}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </Pressable>
    </View>
  );
}

function ConfirmationScreen({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  return (
    <View style={styles.idleScreen}>
      <Text style={styles.idleEmoji}>✅</Text>
      <Text style={styles.idleTitle}>Order placed!</Text>
      <Text style={styles.orderNumber}>{orderId}</Text>
      <Text style={styles.idleSubtitle}>Please wait to be called — thank you!</Text>
      <Pressable style={[styles.primaryButton, { marginTop: spacing.xl, width: 280 }]} onPress={onDone}>
        <Text style={styles.primaryButtonText}>Done</Text>
      </Pressable>
    </View>
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
  idleEmoji: {
    fontSize: 96,
    marginBottom: spacing.lg,
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
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryTabActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  categoryTabText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.inkMuted,
  },
  categoryTabTextActive: {
    color: colors.white,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: 120,
  },
  gridCard: {
    width: 220,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    ...shadow.card,
  },
  gridImage: {
    width: '100%',
    height: 120,
    borderRadius: radii.sm,
  },
  gridImageEmoji: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
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
  cartBar: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.forest,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadow.card,
  },
  cartBarText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 18,
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
