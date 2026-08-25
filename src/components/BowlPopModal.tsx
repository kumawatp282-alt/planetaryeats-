// Tapping a bowl's photo pin on the globe pops this up: just the bowl,
// full-circle, in place of the globe itself (not a full-screen takeover).
// Swipe left/right — by drag or trackpad — to browse other bowls, tap the
// circle to open the full item page, tap the X to dismiss back to the globe.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { MenuItem } from '../data/menu';
import { colors, fonts, spacing } from '../constants/theme';
import { formatPrice } from '../lib/format';

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

export default function BowlPopModal({ items, allItems, activeId, size, onClose, onViewBowl }: Props) {
  const [index, setIndex] = useState(0);
  const [siblingId, setSiblingId] = useState<string | null>(null);
  const scale = useRef(new Animated.Value(0.6)).current;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

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

  return (
    <View
      ref={wrapRef}
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}
    >
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

      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.price}>{formatPrice(item.price)}</Text>
      <Text style={styles.hint}>Tap the bowl to view · swipe for more</Text>

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

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(20,16,10,0.55)',
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
  hint: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.inkMuted,
    fontFamily: fonts.body,
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
