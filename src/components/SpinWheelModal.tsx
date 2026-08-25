// "Not sure what to eat/drink/dessert?" randomizer — a slot-machine style
// reel that cycles through items in the chosen category, decelerates, and
// lands on a random pick.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Category, MenuItem } from '../data/menu';
import { colors, radii, spacing, typography } from '../constants/theme';
import { formatPrice } from '../lib/format';

interface Props {
  visible: boolean;
  items: MenuItem[]; // all items across categories — filtered internally
  onClose: () => void;
  onSelect: (item: MenuItem) => void;
}

const TICK_COUNT = 24;
const CATEGORIES: Category[] = ['Bowls', 'Drinks', 'Desserts'];

export default function SpinWheelModal({ visible, items, onClose, onSelect }: Props) {
  const [category, setCategory] = useState<Category>('Bowls');
  const [index, setIndex] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pool = items.filter((item) => item.category === category);

  useEffect(() => {
    if (visible) {
      setCategory('Bowls');
      startSpin('Bowls');
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function startSpin(forCategory?: Category) {
    const activeCategory = forCategory ?? category;
    const activePool = items.filter((item) => item.category === activeCategory);
    if (activePool.length === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSpinning(true);
    setDone(false);
    const finalIndex = Math.floor(Math.random() * activePool.length);
    let tick = 0;

    const step = () => {
      tick += 1;
      setIndex((prev) => (prev + 1) % activePool.length);
      const progress = tick / TICK_COUNT;
      const delay = 60 + Math.pow(progress, 3) * 260; // ease out
      if (tick < TICK_COUNT) {
        timerRef.current = setTimeout(step, delay);
      } else {
        setIndex(finalIndex);
        setSpinning(false);
        setDone(true);
      }
    };
    timerRef.current = setTimeout(step, 60);
  }

  const handleCategoryChange = (next: Category) => {
    setCategory(next);
    startSpin(next);
  };

  const current = pool[index];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={typography.h2}>Not sure what to have?</Text>
          <Text style={[typography.bodyMuted, { marginTop: 4, marginBottom: spacing.md }]}>
            Let the wheel decide.
          </Text>

          <View style={styles.categoryRow}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                style={[styles.categoryPill, category === c && styles.categoryPillActive]}
                onPress={() => handleCategoryChange(c)}
              >
                <Text style={[styles.categoryText, category === c && styles.categoryTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          {current && (
            <View style={styles.reel}>
              <Text style={styles.reelEmoji}>{current.emoji}</Text>
              <Text style={styles.reelName}>{current.name}</Text>
              {done && <Text style={styles.reelPrice}>{formatPrice(current.price)}</Text>}
            </View>
          )}

          <View style={styles.actions}>
            {done ? (
              <>
                <Pressable style={styles.primaryButton} onPress={() => current && onSelect(current)}>
                  <Text style={styles.primaryButtonText}>View this {category === 'Bowls' ? 'bowl' : 'item'}</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => startSpin()}>
                  <Text style={styles.secondaryButtonText}>Spin again</Text>
                </Pressable>
              </>
            ) : (
              <Text style={[typography.bodyMuted, { textAlign: 'center' }]}>{spinning ? 'Spinning…' : ''}</Text>
            )}
          </View>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  categoryPill: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
  },
  categoryPillActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  categoryTextActive: {
    color: colors.white,
  },
  reel: {
    width: '100%',
    backgroundColor: colors.cream,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  reelEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  reelName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  reelPrice: {
    marginTop: spacing.xs,
    fontSize: 15,
    fontWeight: '700',
    color: colors.forest,
  },
  actions: {
    width: '100%',
    minHeight: 44,
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  secondaryButtonText: {
    color: colors.leaf,
    fontWeight: '600',
    fontSize: 14,
  },
  closeButton: {
    marginTop: spacing.md,
  },
  closeButtonText: {
    color: colors.inkMuted,
    fontSize: 13,
  },
});
