// One-time cinematic splash: wordmark holds on screen, then zooms in and
// fades to reveal the app underneath. Mounted once from the root layout, so
// it only plays on a fresh page load, not on in-app navigation.
//
// While the splash holds, we preload the Earth texture in the background so
// the globe is fully ready — not popping in a beat late — the instant the
// splash clears.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Asset } from 'expo-asset';
import { colors, fonts } from '../constants/theme';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const earthTextureModule = require('../assets/earth.jpg');

const HOLD_MS = 3200;
const EXIT_MS = 700;

export default function SplashOverlay() {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const logoScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Asset.fromModule(earthTextureModule).downloadAsync().catch(() => {});

    Animated.timing(scale, {
      toValue: 1,
      duration: 900,
      useNativeDriver: false,
    }).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: EXIT_MS,
          useNativeDriver: false,
        }),
        Animated.timing(logoScale, {
          toValue: 2.2,
          duration: EXIT_MS,
          useNativeDriver: false,
        }),
      ]).start(() => setVisible(false));
    }, HOLD_MS);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity }]}>
      <Animated.View style={{ transform: [{ scale: Animated.multiply(scale, logoScale) }], alignItems: 'center' }}>
        <Text style={styles.wordmark}>PLANETARY EATS</Text>
        <Text style={styles.tagline}>Explore the World, One Bowl at a Time.</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  wordmark: {
    fontSize: 26,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: 2,
    fontFamily: fonts.heading,
  },
  tagline: {
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: 6,
    fontFamily: fonts.body,
  },
});
