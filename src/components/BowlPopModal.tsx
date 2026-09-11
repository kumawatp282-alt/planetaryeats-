// Tapping a bowl's photo pin on the globe pops this up: a bento-grid card
// — photo, real facts (calories, protein, origin story, tags/allergens),
// a couple of empty placeholder tiles for whatever gets added next, a
// quick protein choice, and Add to cart — all sized to fit in one screen
// with no scrolling, in place of the globe itself (not a full-screen
// takeover). Swipe left/right — by drag or trackpad — on the photo to
// browse other bowls; tap it (or "View full page") to open the full item
// page; tap the X to dismiss back to the globe.
//
// Every fact comes straight from the same MenuItem data used elsewhere
// (data/menu.ts) — nothing invented per dish.
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

// A tile's own flex share of its column's height, so the grid always adds
// up the same way regardless of which optional tiles a given dish has.
const TILE_COUNT = 9; // origin, about, emptyA, photo, goodToKnow, calories, protein, macros, emptyB

function TileFade({
  index,
  anim,
  style,
  children,
}: {
  index: number;
  anim: Animated.Value;
  style?: any;
  children: React.ReactNode;
}) {
  const start = Math.min(0.75, (index / TILE_COUNT) * 0.8);
  const end = Math.min(1, start + 0.35);
  const opacity = anim.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: 'clamp' });
  const translateY = anim.interpolate({ inputRange: [start, end], outputRange: [14, 0], extrapolate: 'clamp' });
  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

export default function BowlPopModal({ items, allItems, activeId, size, onClose, onViewBowl }: Props) {
  const { remainingCalories } = useTodayNutrition();
  const { addToCart } = useStore();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
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

  // The grid is budgeted against the real viewport so the whole card fits
  // in one screen without scrolling on a typical laptop/desktop window —
  // clamped so it's never absurdly short (tiny window) or tall (huge one).
  const gridHeight = Math.max(280, Math.min(480, windowHeight - 380));
  const blockWidth = Math.min(windowWidth * 0.92, 720);

  const goodToKnow = [...(item.tags ?? []), ...(item.allergens ?? [])];
  const photoScale = cardsAnim.interpolate({ inputRange: [0, 0.3], outputRange: [0.94, 1], extrapolate: 'clamp' });
  const photoOpacity = cardsAnim.interpolate({ inputRange: [0, 0.25], outputRange: [0, 1], extrapolate: 'clamp' });

  let t = 0; // running tile index, for the stagger

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

        <View style={[styles.grid, { height: gridHeight }]}>
          <View style={styles.column}>
            <TileFade index={t++} anim={cardsAnim} style={[styles.tile, styles.tileDark, { flex: 1.3 }]}>
              {item.origin ? (
                <>
                  <Text style={styles.originFlag}>{item.origin.flag}</Text>
                  <Text style={styles.originCountry}>{item.origin.country}</Text>
                  <Text style={styles.originHistory} numberOfLines={6}>
                    {item.origin.history}
                  </Text>
                </>
              ) : (
                <Text style={styles.tileLabelDark}>ORIGIN</Text>
              )}
            </TileFade>
            <TileFade index={t++} anim={cardsAnim} style={[styles.tile, { flex: 1 }]}>
              <Text style={styles.tileLabel}>ABOUT THIS DISH</Text>
              <Text style={styles.tileBody} numberOfLines={5}>
                {item.description}
              </Text>
            </TileFade>
            <TileFade index={t++} anim={cardsAnim} style={[styles.tile, styles.tileEmpty, { flex: 0.8 }]}>
              <Text style={styles.emptyPlus}>+</Text>
              <Text style={styles.emptyLabel}>Add info</Text>
            </TileFade>
          </View>

          <View style={[styles.column, { flex: 1.3 }]}>
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.tile,
                styles.photoTile,
                { flex: 2.2, opacity: photoOpacity, transform: [{ translateX }, { scale: photoScale }], cursor: 'pointer' } as any,
              ]}
            >
              {item.dishImage ? (
                <Image source={item.dishImage} style={styles.photoImage} resizeMode="cover" />
              ) : (
                <View style={[styles.photoImage, styles.photoEmoji]}>
                  <Text style={{ fontSize: 64 }}>{item.emoji}</Text>
                </View>
              )}
            </Animated.View>
            <TileFade index={t++} anim={cardsAnim} style={[styles.tile, { flex: 0.8 }]}>
              <Text style={styles.tileLabel}>GOOD TO KNOW</Text>
              {goodToKnow.length > 0 ? (
                <View style={styles.tagWrap}>
                  {goodToKnow.slice(0, 4).map((tag) => (
                    <View key={tag} style={styles.tagPill}>
                      <Text style={styles.tagPillText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.tileBody}>—</Text>
              )}
            </TileFade>
          </View>

          <View style={styles.column}>
            <TileFade index={t++} anim={cardsAnim} style={[styles.tile, { flex: 1 }]}>
              {item.nutrition ? (
                <>
                  <Text style={styles.statValue}>{item.nutrition.calories}</Text>
                  <Text style={styles.tileLabel}>KCAL</Text>
                </>
              ) : (
                <Text style={styles.tileLabel}>KCAL</Text>
              )}
            </TileFade>
            <TileFade index={t++} anim={cardsAnim} style={[styles.tile, { flex: 1 }]}>
              {item.nutrition ? (
                <>
                  <Text style={styles.statValue}>{item.nutrition.protein}g</Text>
                  <Text style={styles.tileLabel}>PROTEIN</Text>
                </>
              ) : (
                <Text style={styles.tileLabel}>PROTEIN</Text>
              )}
            </TileFade>
            <TileFade index={t++} anim={cardsAnim} style={[styles.tile, { flex: 1 }]}>
              <Text style={styles.tileLabel}>PER SERVING</Text>
              {item.nutrition ? (
                <>
                  <Text style={styles.macroLine}>{item.nutrition.carbs}g carbs</Text>
                  <Text style={styles.macroLine}>{item.nutrition.fiber}g fiber</Text>
                  <Text style={styles.macroLine}>{item.nutrition.fat}g fat</Text>
                </>
              ) : (
                <Text style={styles.tileBody}>—</Text>
              )}
            </TileFade>
            <TileFade index={t++} anim={cardsAnim} style={[styles.tile, styles.tileEmpty, { flex: 0.8 }]}>
              <Text style={styles.emptyPlus}>+</Text>
              <Text style={styles.emptyLabel}>Add info</Text>
            </TileFade>
          </View>
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
    maxWidth: 720,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
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
  grid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  column: {
    flex: 1,
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.card,
  },
  tileDark: {
    backgroundColor: colors.forest,
  },
  tileEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    shadowOpacity: 0,
    elevation: 0,
  },
  emptyPlus: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.border,
  },
  emptyLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.border,
    marginTop: 2,
  },
  photoTile: {
    padding: 0,
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
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkMuted,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  tileLabelDark: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tileBody: {
    fontSize: 11,
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 14,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
  },
  macroLine: {
    fontSize: 10,
    color: colors.ink,
    textAlign: 'center',
  },
  originFlag: {
    fontSize: 24,
    marginBottom: 2,
  },
  originCountry: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 4,
  },
  originHistory: {
    fontSize: 9,
    lineHeight: 12,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
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
    fontSize: 9,
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
