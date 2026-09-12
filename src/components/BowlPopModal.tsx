// Tapping a bowl's photo pin on the globe pops this up: a cluster of
// circular tiles — a big photo circle plus real facts (calories, protein,
// origin story, tags/allergens, and any admin-added extra tiles), a quick
// protein choice, and Add to cart — all in place of the globe itself (not
// a full-screen takeover). Swipe left/right — by drag or trackpad — on the
// photo to browse other bowls; tap it (or "View full page") to open the
// full item page; tap the X to dismiss back to the globe.
//
// Every fact comes straight from the same MenuItem data used elsewhere
// (data/menu.ts) — the built-in tiles are edited from the admin panel's
// dish editor, and `item.facts` is a free-form list of extra tiles an
// admin can add/reorder/remove there too.
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MenuItem } from '../data/menu';
import { useStore, useTodayNutrition } from '../context/StoreContext';
import { colors, fonts, radii, shadow, spacing } from '../constants/theme';
import { formatPrice } from '../lib/format';
import QuantityStepper from './QuantityStepper';

interface Props {
  items: MenuItem[];
  allItems: MenuItem[];
  activeId: string | null;
  size: number;
  onClose: () => void;
  onViewBowl: (item: MenuItem) => void;
}

const SWIPE_THRESHOLD = 60;
const TAP_THRESHOLD = 8;
const WHEEL_SWIPE_THRESHOLD = 40;
const WHEEL_LOCK_MS = 450;

function TileFade({
  index,
  total,
  anim,
  style,
  children,
}: {
  index: number;
  total: number;
  anim: Animated.Value;
  style?: any;
  children: React.ReactNode;
}) {
  const start = Math.min(0.75, (index / Math.max(1, total)) * 0.8);
  const end = Math.min(1, start + 0.35);
  const opacity = anim.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: 'clamp' });
  const scale = anim.interpolate({ inputRange: [start, end], outputRange: [0.8, 1], extrapolate: 'clamp' });
  return (
    <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

export default function BowlPopModal({ items, allItems, activeId, size, onClose, onViewBowl }: Props) {
  const { remainingCalories } = useTodayNutrition();
  const { addToCart } = useStore();
  const { width: windowWidth } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [siblingId, setSiblingId] = useState<string | null>(null);
  const [selectedProtein, setSelectedProtein] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const cardsAnim = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const wrapRef = useRef<View | null>(null);
  const indexRef = useRef(0);
  const wheelLocked = useRef(false);
  const wheelAccum = useRef(0);
  const itemsRef = useRef(items);
  const onViewBowlRef = useRef(onViewBowl);
  const sizeRef = useRef(size);
  const displayedItemRef = useRef<MenuItem | null>(null);

  useEffect(() => {
    itemsRef.current = items;
    onViewBowlRef.current = onViewBowl;
    sizeRef.current = size;
  });

  // A pin's own item can share a "stop" with other items (e.g. Turkey's
  // Döner pin also offers Dürüm and Falafelteller from the same shop) —
  // reset back to the pin's primary item whenever the pin changes.
  useEffect(() => {
    setSiblingId(null);
  }, [index, activeId]);

  useEffect(() => {
    if (!activeId) return;
    const found = items.findIndex((i) => i.id === activeId);
    setIndex(found >= 0 ? found : 0);
    cardsAnim.setValue(0);
    Animated.timing(cardsAnim, { toValue: 1, duration: 650, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Reset any in-progress customization whenever a different dish is shown
  // (new pin, or switching between siblings).
  useEffect(() => {
    const pinItem = items[index];
    const shown = (siblingId && pinItem?.groupId && allItems.find((i) => i.id === siblingId)) || pinItem;
    setSelectedProtein(shown?.proteinOptions?.[0]);
    setQuantity(1);
    setJustAdded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, siblingId, activeId]);

  const goTo = (nextIndex: number) => {
    const clamped = ((nextIndex % items.length) + items.length) % items.length;
    translateX.setValue(0);
    setIndex(clamped);
  };

  // A single responder owns both tap-to-view and swipe-to-cycle — a nested
  // Pressable here would race the PanResponder for the gesture and, on web,
  // the Pressable's click wins before a drag ever registers as a swipe.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4,
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        const size = sizeRef.current;
        if (Math.abs(gesture.dx) < TAP_THRESHOLD && Math.abs(gesture.dy) < TAP_THRESHOLD) {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start();
          const tappedItem = displayedItemRef.current ?? itemsRef.current[indexRef.current];
          if (tappedItem) onViewBowlRef.current(tappedItem);
        } else if (gesture.dx > SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: size, duration: 160, useNativeDriver: false }).start(() =>
            goTo(indexRef.current - 1)
          );
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: -size, duration: 160, useNativeDriver: false }).start(() =>
            goTo(indexRef.current + 1)
          );
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  // Trackpad / mouse-wheel horizontal swipe support — PanResponder alone
  // only catches click-drag, not a real trackpad swipe gesture.
  useEffect(() => {
    const node = wrapRef.current as unknown as HTMLElement | null;
    if (!node || !activeId) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (wheelLocked.current) return;
      wheelAccum.current += e.deltaX;
      if (Math.abs(wheelAccum.current) > WHEEL_SWIPE_THRESHOLD) {
        wheelLocked.current = true;
        const dir = wheelAccum.current > 0 ? 1 : -1;
        wheelAccum.current = 0;
        goTo(indexRef.current + dir);
        setTimeout(() => {
          wheelLocked.current = false;
        }, WHEEL_LOCK_MS);
      }
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [activeId]);

  if (!activeId) return null;
  const pinItem = items[index];
  if (!pinItem) return null;
  const siblings = pinItem.groupId ? allItems.filter((i) => i.groupId === pinItem.groupId) : [];
  const item = (siblingId && siblings.find((i) => i.id === siblingId)) || pinItem;
  displayedItemRef.current = item;

  const unitPrice = item.price;

  const handleAddToCart = () => {
    addToCart(item, quantity, selectedProtein, [], undefined);
    setJustAdded(true);
  };

  // A cluster of same-shape circles, wrapping to fit whatever width is
  // available — no fixed grid to overflow or leave gaps in. Sized down a
  // notch on narrow windows so the cluster still wraps into a tidy shape
  // rather than one long column.
  const isNarrow = windowWidth < 560;
  const blockWidth = Math.min(windowWidth * 0.94, 760);
  const photoSize = isNarrow ? 168 : 210;
  const factSize = isNarrow ? 104 : 128;
  const clusterGap = isNarrow ? spacing.md : spacing.lg;

  const goodToKnow = [...(item.tags ?? []), ...(item.allergens ?? [])];
  const photoScale = cardsAnim.interpolate({ inputRange: [0, 0.3], outputRange: [0.94, 1], extrapolate: 'clamp' });
  const photoOpacity = cardsAnim.interpolate({ inputRange: [0, 0.25], outputRange: [0, 1], extrapolate: 'clamp' });

  // Built-in fact tiles only appear when the dish actually has that data —
  // no empty placeholder circles. `item.facts` (admin-added, from the
  // dish editor's "Extra info tiles" section) are appended after them, in
  // the order the admin arranged them.
  const tiles: { key: string; dark?: boolean; content: React.ReactNode }[] = [];
  if (item.origin) {
    tiles.push({
      key: 'origin',
      dark: true,
      content: (
        <>
          <Text style={styles.originFlag}>{item.origin.flag}</Text>
          <Text style={styles.originCountry}>{item.origin.country}</Text>
          <Text style={styles.originHistory} numberOfLines={3}>
            {item.origin.history}
          </Text>
        </>
      ),
    });
  }
  tiles.push({
    key: 'about',
    content: (
      <>
        <Text style={styles.tileLabel}>ABOUT</Text>
        <Text style={styles.tileBody} numberOfLines={4}>
          {item.description}
        </Text>
      </>
    ),
  });
  if (goodToKnow.length > 0) {
    tiles.push({
      key: 'good-to-know',
      content: (
        <>
          <Text style={styles.tileLabel}>GOOD TO KNOW</Text>
          <View style={styles.tagWrap}>
            {goodToKnow.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagPillText}>{tag}</Text>
              </View>
            ))}
          </View>
        </>
      ),
    });
  }
  if (item.nutrition) {
    tiles.push({
      key: 'calories',
      content: (
        <>
          <Text style={styles.statValue}>{item.nutrition.calories}</Text>
          <Text style={styles.tileLabel}>KCAL</Text>
        </>
      ),
    });
    tiles.push({
      key: 'protein',
      content: (
        <>
          <Text style={styles.statValue}>{item.nutrition.protein}g</Text>
          <Text style={styles.tileLabel}>PROTEIN</Text>
        </>
      ),
    });
    tiles.push({
      key: 'macros',
      content: (
        <>
          <Text style={styles.tileLabel}>PER SERVING</Text>
          <Text style={styles.macroLine}>{item.nutrition.carbs}g carbs</Text>
          <Text style={styles.macroLine}>{item.nutrition.fiber}g fiber</Text>
          <Text style={styles.macroLine}>{item.nutrition.fat}g fat</Text>
        </>
      ),
    });
  }
  (item.facts ?? []).forEach((fact, i) => {
    tiles.push({
      key: `fact-${i}`,
      content: (
        <>
          <Text style={styles.tileLabel} numberOfLines={2}>
            {fact.label.toUpperCase()}
          </Text>
          <Text style={styles.tileBody} numberOfLines={4}>
            {fact.body}
          </Text>
        </>
      ),
    });
  });

  return (
    <View
      ref={wrapRef}
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}
    >
      <View style={[styles.block, { width: blockWidth }]}>
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.price}>{formatPrice(unitPrice)}</Text>

        <View style={[styles.cluster, { gap: clusterGap, marginTop: spacing.lg }]}>
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.circle,
              styles.photoCircle,
              {
                width: photoSize,
                height: photoSize,
                borderRadius: photoSize / 2,
                opacity: photoOpacity,
                transform: [{ translateX }, { scale: photoScale }],
                cursor: 'pointer',
              } as any,
            ]}
          >
            {item.dishImage ? (
              <Image source={item.dishImage} style={styles.photoImage} resizeMode="cover" />
            ) : (
              <View style={[styles.photoImage, styles.photoEmoji]}>
                <Text style={{ fontSize: 56 }}>{item.emoji}</Text>
              </View>
            )}
          </Animated.View>

          {tiles.map((tile, i) => (
            <TileFade
              key={tile.key}
              index={i}
              total={tiles.length}
              anim={cardsAnim}
              style={[
                styles.circle,
                tile.dark && styles.circleDark,
                { width: factSize, height: factSize, borderRadius: factSize / 2 },
              ]}
            >
              {tile.content}
            </TileFade>
          ))}
        </View>

        {item.proteinOptions && item.proteinOptions.length > 0 && (
          <View style={styles.chipRow}>
            {item.proteinOptions.map((p) => (
              <Pressable
                key={p}
                style={[styles.chip, selectedProtein === p && styles.chipActive]}
                onPress={() => setSelectedProtein(p)}
              >
                <Text style={[styles.chipText, selectedProtein === p && styles.chipTextActive]}>{p}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.bottomBar}>
          <QuantityStepper
            quantity={quantity}
            onIncrease={() => setQuantity((q) => q + 1)}
            onDecrease={() => setQuantity((q) => Math.max(1, q - 1))}
          />
          <Pressable style={styles.addButton} onPress={handleAddToCart}>
            <Text style={styles.addButtonText}>
              {justAdded ? 'Added ✓' : `Add ${quantity} · ${formatPrice(unitPrice * quantity)}`}
            </Text>
          </Pressable>
          <Pressable onPress={() => onViewBowlRef.current(item)} hitSlop={6}>
            <Text style={styles.hint}>View full page</Text>
          </Pressable>
        </View>

        <View style={styles.footerRow}>
          {item.nutrition && remainingCalories !== null && (
            <Text style={styles.fitText}>
              {remainingCalories >= item.nutrition.calories
                ? '✓ Fits today’s goal'
                : `⚠ ${Math.round(item.nutrition.calories - remainingCalories)} kcal over today's goal`}
            </Text>
          )}
          <View style={styles.dots}>
            {items.map((i, dotIndex) => (
              <View key={i.id} style={[styles.dot, dotIndex === index && styles.dotActive]} />
            ))}
          </View>
        </View>

        {siblings.length > 1 && (
          <View style={styles.siblingBlock}>
            <Text style={styles.siblingLabel}>Also from {pinItem.groupLabel}</Text>
            <View style={styles.siblingRow}>
              {siblings.map((sibling) => {
                const selected = sibling.id === item.id;
                return (
                  <Pressable
                    key={sibling.id}
                    style={[styles.siblingChip, selected && styles.siblingChipActive]}
                    onPress={() => setSiblingId(sibling.id)}
                    hitSlop={6}
                  >
                    <View style={styles.siblingThumb}>
                      {sibling.dishImage ? (
                        <Image source={sibling.dishImage} style={styles.siblingThumbImage} resizeMode="cover" />
                      ) : (
                        <Text style={{ fontSize: 20 }}>{sibling.emoji}</Text>
                      )}
                    </View>
                    <Text style={[styles.siblingChipText, selected && styles.siblingChipTextActive]}>
                      {sibling.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    maxWidth: 760,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  closeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink,
    fontFamily: fonts.heading,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  price: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: colors.clay,
    textAlign: 'center',
  },
  cluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    borderRadius: 999,
    backgroundColor: colors.card,
    padding: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.card,
  },
  circleDark: {
    backgroundColor: colors.forest,
  },
  photoCircle: {
    padding: 0,
    borderWidth: 3,
    borderColor: colors.card,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoEmoji: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  tileLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.inkMuted,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 3,
  },
  tileBody: {
    fontSize: 10,
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 13,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
  },
  macroLine: {
    fontSize: 9,
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 12,
  },
  originFlag: {
    fontSize: 20,
    marginBottom: 2,
  },
  originCountry: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 3,
  },
  originHistory: {
    fontSize: 8,
    lineHeight: 11,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    justifyContent: 'center',
  },
  tagPill: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagPillText: {
    fontSize: 8,
    fontWeight: '600',
    color: colors.ink,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  chipText: {
    fontWeight: '700',
    color: colors.inkMuted,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.white,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  addButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  hint: {
    fontSize: 12,
    color: colors.inkMuted,
    fontFamily: fonts.body,
    textDecorationLine: 'underline',
  },
  footerRow: {
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 4,
  },
  fitText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.sun,
  },
  siblingBlock: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  siblingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkMuted,
    fontFamily: fonts.body,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
  },
  siblingRow: {
    flexDirection: 'row',
    gap: 10,
  },
  siblingChip: {
    alignItems: 'center',
    width: 68,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  siblingChipActive: {
    borderColor: colors.sun,
    backgroundColor: colors.card,
  },
  siblingThumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  siblingThumbImage: {
    width: '100%',
    height: '100%',
  },
  siblingChipText: {
    marginTop: 4,
    fontSize: 10,
    color: colors.inkMuted,
    fontFamily: fonts.body,
    textAlign: 'center',
  },
  siblingChipTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
});
