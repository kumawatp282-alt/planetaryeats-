import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MenuItem } from '../data/menu';
import { colors, radii, shadow, spacing, typography } from '../constants/theme';
import { formatPrice } from '../lib/format';

interface Props {
  item: MenuItem;
  onPress: () => void;
}

export default function MenuItemCard({ item, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.emojiWrap}>
        {item.dishImage ? (
          <Image source={item.dishImage} style={styles.dishImage} resizeMode="cover" />
        ) : (
          <Text style={styles.emoji}>{item.emoji}</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={typography.h3} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[typography.bodyMuted, styles.description]} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={typography.price}>{formatPrice(item.price)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  cardPressed: {
    opacity: 0.85,
  },
  emojiWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  emoji: {
    fontSize: 30,
  },
  dishImage: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  description: {
    marginVertical: 2,
  },
});
