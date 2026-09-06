// Fast add-to-order popup for the self-serve kiosk (/kiosk) — same
// protein/add-on/quantity state as app/item/[id].tsx, but as a quick
// modal instead of a full navigated page (a kiosk customer shouldn't
// have to wait through a page transition for every tap).
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MenuItem } from '../data/menu';
import { useStore } from '../context/StoreContext';
import { colors, radii, shadow, spacing, typography } from '../constants/theme';
import { formatPrice } from '../lib/format';
import QuantityStepper from './QuantityStepper';

interface Props {
  visible: boolean;
  item: MenuItem | null;
  onClose: () => void;
}

export default function KioskItemModal({ visible, item, onClose }: Props) {
  const { addToCart } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedProtein, setSelectedProtein] = useState<string | undefined>(undefined);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setQuantity(1);
    setSelectedProtein(item?.proteinOptions?.[0]);
    setSelectedAddOnIds([]);
  }, [visible, item]);

  if (!item) return null;

  const toggleAddOn = (id: string) => {
    setSelectedAddOnIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const addOnsTotal = (item.addOns ?? [])
    .filter((a) => selectedAddOnIds.includes(a.id))
    .reduce((sum, a) => sum + a.price, 0);
  const unitPrice = item.price + addOnsTotal;

  const handleAdd = () => {
    addToCart(item, quantity, selectedProtein, selectedAddOnIds, undefined);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={typography.h2}>{item.name}</Text>
            <Text style={[typography.bodyMuted, { textAlign: 'center' }]}>{item.description}</Text>
            <Text style={styles.price}>{formatPrice(unitPrice)}</Text>

            {item.proteinOptions && item.proteinOptions.length > 0 && (
              <View style={styles.section}>
                <Text style={typography.label}>CHOOSE YOUR PROTEIN</Text>
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
              <View style={styles.section}>
                <Text style={typography.label}>ADD EXTRAS</Text>
                {item.addOns.map((a) => {
                  const active = selectedAddOnIds.includes(a.id);
                  return (
                    <Pressable key={a.id} style={[styles.addOnRow, active && styles.addOnRowActive]} onPress={() => toggleAddOn(a.id)}>
                      <View style={[styles.checkbox, active && styles.checkboxActive]}>
                        {active && <Text style={styles.checkboxMark}>✓</Text>}
                      </View>
                      <Text style={[typography.body, { flex: 1, marginLeft: spacing.sm }]}>{a.name}</Text>
                      <Text style={typography.bodyMuted}>+{formatPrice(a.price)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={styles.stepperWrap}>
              <QuantityStepper
                quantity={quantity}
                onIncrease={() => setQuantity((q) => q + 1)}
                onDecrease={() => setQuantity((q) => Math.max(1, q - 1))}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.addButton} onPress={handleAdd}>
              <Text style={styles.addButtonText}>
                Add {quantity} · {formatPrice(unitPrice * quantity)}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: colors.cream,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  content: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 56,
    marginBottom: spacing.sm,
  },
  price: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.forest,
    marginTop: spacing.sm,
  },
  section: {
    width: '100%',
    marginTop: spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
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
    fontSize: 15,
  },
  chipTextActive: {
    color: colors.white,
  },
  addOnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addOnRowActive: {
    borderColor: colors.forest,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
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
    fontSize: 14,
  },
  stepperWrap: {
    marginTop: spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  cancelButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.inkMuted,
    fontWeight: '700',
    fontSize: 15,
  },
  addButton: {
    flex: 1,
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
