// Tapping a bowl's photo pin on the globe pops this up: the bowl, full
// circle, in place of the globe itself (not a full-screen takeover) — plus
// a circular ring of real fact cards (calories, protein, origin story,
// allergens, tags) radiating outward around it, and inline customize +
// add-to-cart controls, all on this one screen (no second tap needed to
// see the detail or add the dish). Swipe left/right — by drag or
// trackpad — to browse other bowls; tap the circle itself (or "View full
// page") to open the full item page; tap the X to dismiss back to the
// globe.
//
// Every fact in the cards comes straight from the same MenuItem data used
// elsewhere (data/menu.ts) — nothing invented per dish.
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

// ---- Fact-card ring (the "bento" cards around the photo) ----------------

interface CardSpec {
  key: string;
  tone: 'light' | 'dark';
  render: (fontScale: number) => React.ReactNode;
}

function buildCards(item: MenuItem): CardSpec[] {
  const cards: CardSpec[] = [];

  cards.push({
    key: 'about',
    tone: 'light',
    render: (f) => (
      <>
        <Text style={[cardStyles.label, { fontSize: 10 * f }]}>ABOUT THIS DISH</Text>
        <Text style={[cardStyles.body, { fontSize: 11 * f, lineHeight: 14 * f }]} numberOfLines={4}>
          {item.description}
        </Text>
      </>
    ),
  });

  if (item.nutrition) {
    cards.push({
      key: 'calories',
      tone: 'light',
      render: (f) => (
        <>
          <Text style={[cardStyles.statValue, { fontSize: 26 * f }]}>{item.nutrition!.calories}</Text>
          <Text style={[cardStyles.label, { fontSize: 10 * f }]}>KCAL</Text>
        </>
      ),
    });
    cards.push({
      key: 'protein',
      tone: 'light',
      render: (f) => (
        <>
          <Text style={[cardStyles.statValue, { fontSize: 26 * f }]}>{item.nutrition!.protein}g</Text>
          <Text style={[cardStyles.label, { fontSize: 10 * f }]}>PROTEIN</Text>
        </>
      ),
    });
    cards.push({
      key: 'macros',
      tone: 'light',
      render: (f) => (
        <>
          <Text style={[cardStyles.label, { fontSize: 10 * f }]}>PER SERVING</Text>
          <Text style={[cardStyles.macroLine, { fontSize: 10 * f }]}>{item.nutrition!.carbs}g carbs</Text>
          <Text style={[cardStyles.macroLine, { fontSize: 10 * f }]}>{item.nutrition!.fiber}g fiber</Text>
          <Text style={[cardStyles.macroLine, { fontSize: 10 * f }]}>{item.nutrition!.fat}g fat</Text>
        </>
      ),
    });
  }

  if (item.origin) {
    cards.push({
      key: 'origin',
      tone: 'dark',
      render: (f) => (
        <>
          <Text style={{ fontSize: 26 * f, marginBottom: 2 }}>{item.origin!.flag}</Text>
          <Text style={[cardStyles.originCountry, { fontSize: 12 * f }]}>{item.origin!.country}</Text>
          <Text style={[cardStyles.originHistory, { fontSize: 9 * f, lineHeight: 12 * f }]} numberOfLines={5}>
            {item.origin!.history}
          </Text>
        </>
      ),
    });
  }

  if (item.allergens && item.allergens.length > 0) {
    cards.push({
      key: 'allergens',
      tone: 'light',
      render: (f) => (
        <>
          <Text style={[cardStyles.label, { fontSize: 10 * f }]}>ALLERGENS</Text>
          <Text style={[cardStyles.body, { fontSize: 11 * f, lineHeight: 14 * f }]}>{item.allergens!.join(', ')}</Text>
        </>
      ),
    });
  }

  if (item.tags && item.tags.length > 0) {
    cards.push({
      key: 'tags',
      tone: 'light',
      render: (f) => (
        <>
          <Text style={[cardStyles.label, { fontSize: 10 * f }]}>GOOD TO KNOW</Text>
          <View style={cardStyles.tagWrap}>
            {item.tags!.slice(0, 3).map((tag) => (
              <View key={tag} style={cardStyles.tagPill}>
                <Text style={[cardStyles.tagPillText, { fontSize: 9 * f }]}>{tag}</Text>
              </View>
            ))}
          </View>
        </>
      ),
    });
  }

  return cards;
}

function BentoCard({
  card,
  index,
  total,
  radius,
  cardSize,
  fontScale,
  anim,
}: {
  card: CardSpec;
  index: number;
  total: number;
  radius: number;
  cardSize: number;
  fontScale: number;
  anim: Animated.Value;
}) {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  const targetX = Math.cos(angle) * radius;
  const targetY = Math.sin(angle) * radius;

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, targetX] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, targetY] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  return (
    <Animated.View
      style={[
        cardStyles.card,
        card.tone === 'dark' && cardStyles.cardDark,
        {
          width: cardSize,
          minHeight: cardSize,
          opacity: anim,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    >
      {card.render(fontScale)}
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
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const scale = useRef(new Animated.Value(0.6)).current;
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
    scale.setValue(0.6);
    Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: false }).start();
    cardsAnim.setValue(0);
    Animated.stagger(
      55,
      buildCards(items[found >= 0 ? found : 0] ?? items[0]).map(() =>
        Animated.spring(cardsAnim, { toValue: 1, friction: 7, tension: 70, useNativeDriver: false })
      )
    ).start();
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
    setSelectedAddOnIds([]);
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

  // Not memoized with useMemo — this sits after the early returns above,
  // and buildCards() is cheap enough (a handful of small objects) that a
  // plain per-render call is simpler than working around the Rules of
  // Hooks for it.
  const cards = buildCards(item);

  // Cards scale mainly off the window, not the photo — the photo (`size`)
  // can legitimately range from ~250 to 480px, and scaling the ring
  // proportionally to a 480px photo would blow the ring far past the
  // viewport. Clamped so the ring never gets illegibly tiny either.
  const cardSize = Math.max(64, Math.min(112, windowWidth * 0.09));
  const radiusPad = Math.max(10, Math.min(26, windowWidth * 0.02));
  const radius = size / 2 + radiusPad + cardSize / 2;
  const stageSize = radius * 2 + cardSize;
  const fontScale = Math.max(0.65, Math.min(1, Math.min(windowWidth, windowHeight) / 700));

  const addOnsTotal = (item.addOns ?? [])
    .filter((a) => selectedAddOnIds.includes(a.id))
    .reduce((sum, a) => sum + a.price, 0);
  const unitPrice = item.price + addOnsTotal;

  const toggleAddOn = (id: string) => {
    setSelectedAddOnIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const handleAddToCart = () => {
    addToCart(item, quantity, selectedProtein, selectedAddOnIds, undefined);
    setJustAdded(true);
  };

  return (
    <View
      ref={wrapRef}
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}
    >
      <View style={[styles.stage, { width: stageSize, height: stageSize }]}>
        <View style={[styles.cardLayer, { width: stageSize, height: stageSize }]} pointerEvents="box-none">
          {cards.map((card, i) => (
            <BentoCard
              key={card.key}
              card={card}
              index={i}
              total={cards.length}
              radius={radius}
              cardSize={cardSize}
              fontScale={fontScale}
              anim={cardsAnim}
            />
          ))}
        </View>

        <Animated.View
          style={[
            styles.circleWrap,
            { width: size, height: size, transform: [{ scale }, { translateX }] },
            { cursor: 'pointer' },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
            {item.dishImage ? (
              <Image source={item.dishImage} style={styles.circleImage} resizeMode="cover" />
            ) : (
              <View style={styles.circleImage}>
                <Text style={{ fontSize: 72 }}>{item.emoji}</Text>
              </View>
            )}
          </View>

          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </Animated.View>
      </View>

      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.price}>{formatPrice(unitPrice)}</Text>

      {item.proteinOptions && item.proteinOptions.length > 0 && (
        <View style={styles.customizeSection}>
          <Text style={styles.customizeLabel}>CHOOSE YOUR PROTEIN</Text>
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
        </View>
      )}

      {item.addOns && item.addOns.length > 0 && (
        <View style={styles.customizeSection}>
          <Text style={styles.customizeLabel}>ADD EXTRAS</Text>
          {item.addOns.map((a) => {
            const active = selectedAddOnIds.includes(a.id);
            return (
              <Pressable key={a.id} style={[styles.addOnRow, active && styles.addOnRowActive]} onPress={() => toggleAddOn(a.id)}>
                <View style={[styles.checkbox, active && styles.checkboxActive]}>
                  {active && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.addOnName}>{a.name}</Text>
                <Text style={styles.addOnPrice}>+{formatPrice(a.price)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.addRow}>
        <QuantityStepper quantity={quantity} onIncrease={() => setQuantity((q) => q + 1)} onDecrease={() => setQuantity((q) => Math.max(1, q - 1))} />
        <Pressable style={styles.addButton} onPress={handleAddToCart}>
          <Text style={styles.addButtonText}>
            {justAdded ? 'Added ✓' : `Add ${quantity} · ${formatPrice(unitPrice * quantity)}`}
          </Text>
        </Pressable>
      </View>

      {item.nutrition && remainingCalories !== null && (
        <Text style={styles.fitText}>
          {remainingCalories >= item.nutrition.calories
            ? '✓ Fits today’s goal'
            : `⚠ ${Math.round(item.nutrition.calories - remainingCalories)} kcal over today's goal`}
        </Text>
      )}

      <Pressable onPress={() => onViewBowlRef.current(item)} hitSlop={6}>
        <Text style={styles.hint}>View full page · swipe for more</Text>
      </Pressable>

      <View style={styles.dots}>
        {items.map((i, dotIndex) => (
          <View key={i.id} style={[styles.dot, dotIndex === index && styles.dotActive]} />
        ))}
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
  );
}

const cardStyles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  cardDark: {
    backgroundColor: colors.forest,
  },
  label: {
    fontWeight: '700',
    color: colors.inkMuted,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  body: {
    color: colors.ink,
    textAlign: 'center',
  },
  statValue: {
    fontWeight: '800',
    color: colors.ink,
  },
  macroLine: {
    color: colors.ink,
    textAlign: 'center',
  },
  originCountry: {
    fontWeight: '700',
    color: colors.white,
    marginBottom: 4,
  },
  originHistory: {
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
    fontWeight: '600',
    color: colors.ink,
  },
});

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    overflow: 'hidden',
    borderWidth: 5,
    borderColor: colors.card,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  name: {
    marginTop: spacing.md,
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
    fontFamily: fonts.heading,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  price: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: colors.clay,
  },
  customizeSection: {
    width: '100%',
    maxWidth: 360,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  customizeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkMuted,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
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
  addOnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addOnRowActive: {
    borderColor: colors.forest,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
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
    fontWeight: '700',
    fontSize: 11,
  },
  addOnName: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 13,
    color: colors.ink,
  },
  addOnPrice: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
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
  fitText: {
    marginTop: spacing.sm,
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  hint: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.inkMuted,
    fontFamily: fonts.body,
    textDecorationLine: 'underline',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
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
    marginTop: spacing.md,
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
