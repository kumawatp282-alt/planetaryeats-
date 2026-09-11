// The richer "twist" on tapping a globe pin: instead of jumping straight to
// the full item page, this shows a circular bento-style reveal — the dish
// photo at the center, real facts (calories, protein, origin story,
// allergens, tags) arranged as cards around it, each animating outward
// from the center on open ("appearing from nowhere"). Every fact shown
// here comes straight from the same MenuItem data already used elsewhere
// (data/menu.ts) — nothing invented per-dish.
//
// Sized off `maxSize` — the caller's own already-correct measurement of
// how much room is actually available (GlobeExplorer passes its
// `globeSize`, the same value BowlPopModal is already sized by). This
// site's content sits in a narrow mobile-first column even on a wide
// desktop browser, and `globeSize` already accounts for that; measuring
// independently here via onLayout on a position:absolute overlay proved
// unreliable (it picked up the wrong ancestor box on first layout).
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MenuItem } from '../data/menu';
import { colors, fonts, radii, shadow, spacing } from '../constants/theme';

interface Props {
  item: MenuItem | null;
  maxSize: number;
  onClose: () => void;
  onViewFullPage: (item: MenuItem) => void;
}

interface CardSpec {
  key: string;
  tone: 'light' | 'dark';
  render: (fontScale: number) => React.ReactNode;
}

// Reference design at scale 1 — a real container narrower than this scales
// every size down proportionally (clamped so cards never get illegibly
// small or absurdly large).
const REF_CENTER_PHOTO_SIZE = 152;
const REF_CARD_SIZE = 132;
const REF_RADIUS_PAD = 26;
// radius = CENTER/2 + PAD + CARD/2, and stage = radius*2 + CARD, so:
const REF_STAGE_SIZE = REF_CENTER_PHOTO_SIZE + REF_RADIUS_PAD * 2 + REF_CARD_SIZE * 2;
const MIN_STAGE_SIZE = 250;
const MAX_STAGE_SIZE = REF_STAGE_SIZE;

function buildCards(item: MenuItem): CardSpec[] {
  const cards: CardSpec[] = [];

  cards.push({
    key: 'about',
    tone: 'light',
    render: (f) => (
      <>
        <Text style={[styles.cardLabel, { fontSize: 10 * f }]}>ABOUT THIS DISH</Text>
        <Text style={[styles.cardBody, { fontSize: 11 * f, lineHeight: 14 * f }]} numberOfLines={4}>
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
          <Text style={[styles.statValue, { fontSize: 26 * f }]}>{item.nutrition!.calories}</Text>
          <Text style={[styles.cardLabel, { fontSize: 10 * f }]}>KCAL</Text>
        </>
      ),
    });
    cards.push({
      key: 'protein',
      tone: 'light',
      render: (f) => (
        <>
          <Text style={[styles.statValue, { fontSize: 26 * f }]}>{item.nutrition!.protein}g</Text>
          <Text style={[styles.cardLabel, { fontSize: 10 * f }]}>PROTEIN</Text>
        </>
      ),
    });
    cards.push({
      key: 'macros',
      tone: 'light',
      render: (f) => (
        <>
          <Text style={[styles.cardLabel, { fontSize: 10 * f }]}>PER SERVING</Text>
          <Text style={[styles.macroLine, { fontSize: 10 * f }]}>{item.nutrition!.carbs}g carbs</Text>
          <Text style={[styles.macroLine, { fontSize: 10 * f }]}>{item.nutrition!.fiber}g fiber</Text>
          <Text style={[styles.macroLine, { fontSize: 10 * f }]}>{item.nutrition!.fat}g fat</Text>
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
          <Text style={[styles.originCountry, { fontSize: 12 * f }]}>{item.origin!.country}</Text>
          <Text style={[styles.originHistory, { fontSize: 9 * f, lineHeight: 12 * f }]} numberOfLines={5}>
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
          <Text style={[styles.cardLabel, { fontSize: 10 * f }]}>ALLERGENS</Text>
          <Text style={[styles.cardBody, { fontSize: 11 * f, lineHeight: 14 * f }]}>{item.allergens!.join(', ')}</Text>
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
          <Text style={[styles.cardLabel, { fontSize: 10 * f }]}>GOOD TO KNOW</Text>
          <View style={styles.tagWrap}>
            {item.tags!.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={[styles.tagPillText, { fontSize: 9 * f }]}>{tag}</Text>
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
        styles.card,
        card.tone === 'dark' && styles.cardDark,
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

export default function DishBentoModal({ item, maxSize, onClose, onViewFullPage }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const photoScale = useRef(new Animated.Value(0.4)).current;

  const cards = useMemo(() => (item ? buildCards(item) : []), [item]);

  const scale = useMemo(() => {
    const stage = Math.max(MIN_STAGE_SIZE, Math.min(MAX_STAGE_SIZE, maxSize));
    return stage / REF_STAGE_SIZE;
  }, [maxSize]);

  const centerPhotoSize = REF_CENTER_PHOTO_SIZE * scale;
  const cardSize = REF_CARD_SIZE * scale;
  const radiusPad = REF_RADIUS_PAD * scale;
  const radius = centerPhotoSize / 2 + radiusPad + cardSize / 2;
  const stageSize = radius * 2 + cardSize;
  // Text shrinks less aggressively than the cards themselves — a tiny
  // circle with legible-but-tight text beats a tiny circle with
  // unreadable text.
  const fontScale = Math.max(scale, 0.62);

  useEffect(() => {
    if (!item) return;
    anim.setValue(0);
    photoScale.setValue(0.4);
    Animated.spring(photoScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: false }).start();
    Animated.stagger(
      55,
      cards.map(() => Animated.spring(anim, { toValue: 1, friction: 7, tension: 70, useNativeDriver: false }))
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item) return null;

  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <ScrollView contentContainerStyle={styles.scrollContent} pointerEvents="box-none">
        <View style={[styles.stage, { width: stageSize, height: stageSize }]}>
          <View style={[styles.cardLayer, { width: stageSize, height: stageSize }]}>
            {cards.map((card, i) => (
              <BentoCard
                key={card.key}
                card={card}
                index={i}
                total={cards.length}
                radius={radius}
                cardSize={cardSize}
                fontScale={fontScale}
                anim={anim}
              />
            ))}
          </View>

          <Animated.View
            style={[
              styles.centerPhotoWrap,
              { width: centerPhotoSize, height: centerPhotoSize, borderRadius: centerPhotoSize / 2 },
              { transform: [{ scale: photoScale }] },
            ]}
          >
            {item.dishImage ? (
              <Image source={item.dishImage} style={styles.centerPhoto} resizeMode="cover" />
            ) : (
              <View style={[styles.centerPhoto, styles.centerPhotoEmoji]}>
                <Text style={{ fontSize: 56 * scale }}>{item.emoji}</Text>
              </View>
            )}
          </Animated.View>
        </View>

        <Text style={[styles.dishName, { fontSize: 22 * Math.max(scale, 0.8) }]}>{item.name}</Text>

        <Pressable style={styles.ctaButton} onPress={() => onViewFullPage(item)}>
          <Text style={styles.ctaText}>Customize & add to cart →</Text>
        </Pressable>
      </ScrollView>

      <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.97)',
    zIndex: 50,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
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
  centerPhotoWrap: {
    overflow: 'hidden',
    borderWidth: 5,
    borderColor: colors.card,
    backgroundColor: colors.card,
    ...shadow.card,
  },
  centerPhoto: {
    width: '100%',
    height: '100%',
  },
  centerPhotoEmoji: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishName: {
    marginTop: spacing.lg,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: fonts.heading,
    textAlign: 'center',
  },
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
  cardLabel: {
    fontWeight: '700',
    color: colors.inkMuted,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  cardBody: {
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
  ctaButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.forest,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  ctaText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 51,
  },
  closeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
