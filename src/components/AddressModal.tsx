// Opened from the header's address pill. Delivery mode: type + verify an
// address against the 10km Freising radius (shares the exact check used on
// checkout, via StoreContext, so the two never disagree). Collection mode:
// just confirms where to pick up.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../context/StoreContext';
import { colors, radii, spacing, typography } from '../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AddressModal({ visible, onClose }: Props) {
  const {
    fulfillmentMethod,
    setFulfillmentMethod,
    deliveryAddress,
    setDeliveryAddressText,
    checkDeliveryAddress,
    deliveryCheckStatus,
    deliveryDistanceKm,
    appSettings,
  } = useStore();
  const [input, setInput] = useState(deliveryAddress);

  useEffect(() => {
    if (visible) setInput(deliveryAddress);
  }, [visible, deliveryAddress]);

  const handleCheck = () => {
    setDeliveryAddressText(input);
    checkDeliveryAddress(input);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={typography.h3}>{fulfillmentMethod === 'pickup' ? 'Collection' : 'Delivery address'}</Text>

          <View style={styles.methodRow}>
            <Pressable
              style={[styles.methodButton, fulfillmentMethod === 'delivery' && styles.methodButtonActive]}
              onPress={() => setFulfillmentMethod('delivery')}
            >
              <Text style={[styles.methodText, fulfillmentMethod === 'delivery' && styles.methodTextActive]}>
                Delivery
              </Text>
            </Pressable>
            <Pressable
              style={[styles.methodButton, fulfillmentMethod === 'pickup' && styles.methodButtonActive]}
              onPress={() => setFulfillmentMethod('pickup')}
            >
              <Text style={[styles.methodText, fulfillmentMethod === 'pickup' && styles.methodTextActive]}>
                Collection
              </Text>
            </Pressable>
          </View>

          {fulfillmentMethod === 'pickup' ? (
            <View style={styles.pickupBlock}>
              <Text style={typography.body}>Pick up your order at our kitchen in {appSettings.restaurantName}.</Text>
              <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>No delivery address needed.</Text>
              <Pressable style={styles.primaryButton} onPress={onClose}>
                <Text style={styles.primaryButtonText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ marginTop: spacing.md }}>
              <Text style={typography.label}>YOUR ADDRESS</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={input}
                  onChangeText={(text) => {
                    setInput(text);
                    setDeliveryAddressText(text);
                  }}
                  placeholder="Street, city, postcode"
                  placeholderTextColor={colors.inkMuted}
                  style={[styles.input, { flex: 1 }]}
                  autoFocus
                />
                <Pressable
                  style={[styles.checkButton, !input.trim() && styles.checkButtonDisabled]}
                  onPress={handleCheck}
                  disabled={!input.trim() || deliveryCheckStatus === 'checking'}
                >
                  <Text style={styles.checkButtonText}>
                    {deliveryCheckStatus === 'checking' ? '...' : 'Check'}
                  </Text>
                </Pressable>
              </View>

              {deliveryCheckStatus === 'ok' && deliveryDistanceKm !== null && (
                <Text style={styles.ok}>
                  ✓ We deliver here — {deliveryDistanceKm.toFixed(1)} km from our kitchen in{' '}
                  {appSettings.restaurantName}
                </Text>
              )}
              {deliveryCheckStatus === 'too-far' && deliveryDistanceKm !== null && (
                <Text style={styles.bad}>
                  ✗ That's {deliveryDistanceKm.toFixed(1)} km away — outside our {appSettings.deliveryRadiusKm} km
                  zone. Try Collection instead.
                </Text>
              )}
              {deliveryCheckStatus === 'closed-area' && (
                <Text style={styles.bad}>✗ We don't currently deliver to that area. Try Collection instead.</Text>
              )}
              {deliveryCheckStatus === 'not-found' && (
                <Text style={styles.bad}>Couldn't find that address — check the spelling and try again.</Text>
              )}

              <Pressable
                style={[styles.primaryButton, deliveryCheckStatus !== 'ok' && styles.primaryButtonDisabled]}
                disabled={deliveryCheckStatus !== 'ok'}
                onPress={onClose}
              >
                <Text style={styles.primaryButtonText}>Save address</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,16,10,0.5)',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 90,
  },
  sheet: {
    width: '92%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  methodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  methodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  methodText: {
    fontWeight: '600',
    color: colors.inkMuted,
  },
  methodTextActive: {
    color: colors.white,
  },
  pickupBlock: {
    marginTop: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.ink,
  },
  checkButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonDisabled: {
    backgroundColor: colors.border,
  },
  checkButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  ok: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.forest,
    fontWeight: '600',
  },
  bad: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
