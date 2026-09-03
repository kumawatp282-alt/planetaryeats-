import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const LINKS: { label: string; path: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Home', path: '/', icon: 'planet-outline' },
  { label: 'Eco Shop', path: '/shop', icon: 'leaf-outline' },
  { label: 'Your cart', path: '/cart', icon: 'cart-outline' },
  { label: 'Your orders', path: '/orders', icon: 'receipt-outline' },
  { label: "Today's intake", path: '/nutrition', icon: 'nutrition-outline' },
  { label: 'Profile', path: '/profile', icon: 'person-outline' },
];

const MORE_LINKS: { label: string; path: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Rewards', path: '/rewards', icon: 'star-outline' },
  { label: 'Need help?', path: '/help', icon: 'help-circle-outline' },
  { label: 'Become a courier', path: '/courier', icon: 'bicycle-outline' },
  { label: 'For Business', path: '/business', icon: 'briefcase-outline' },
  { label: 'Partner with us', path: '/partner', icon: 'people-outline' },
];

const LEGAL_LINKS: { label: string; path: string }[] = [
  { label: 'Impressum', path: '/impressum' },
  { label: 'Datenschutz', path: '/datenschutz' },
];

export default function NavMenu({ visible, onClose }: Props) {
  const router = useRouter();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.panel}>
          {LINKS.map((link) => (
            <Pressable
              key={link.path}
              style={styles.row}
              onPress={() => {
                onClose();
                router.push(link.path as any);
              }}
            >
              <Ionicons name={link.icon} size={18} color={colors.forest} />
              <Text style={[typography.body, { marginLeft: spacing.sm }]}>{link.label}</Text>
            </Pressable>
          ))}

          <View style={styles.divider} />

          {MORE_LINKS.map((link) => (
            <Pressable
              key={link.path}
              style={styles.row}
              onPress={() => {
                onClose();
                router.push(link.path as any);
              }}
            >
              <Ionicons name={link.icon} size={18} color={colors.forest} />
              <Text style={[typography.body, { marginLeft: spacing.sm }]}>{link.label}</Text>
            </Pressable>
          ))}

          <View style={styles.divider} />

          {LEGAL_LINKS.map((link) => (
            <Pressable
              key={link.path}
              style={styles.legalRow}
              onPress={() => {
                onClose();
                router.push(link.path as any);
              }}
            >
              <Text style={styles.legalText}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'flex-end',
  },
  panel: {
    marginTop: 60,
    marginRight: spacing.md,
    width: 220,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  legalRow: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  legalText: {
    fontSize: 12,
    color: colors.inkMuted,
  },
});
