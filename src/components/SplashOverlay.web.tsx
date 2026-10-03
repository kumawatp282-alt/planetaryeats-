// Web-only intro: the logo fades in on black, holds a moment, then the layer fades
// into the app.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoImage = require('../assets/logo-stacked.png');

const HOLD_MS = 3200;
const REDUCED_MOTION_HOLD_MS = 500;
const EXIT_MS = 520;
const INTRO_COMPLETE_EVENT = 'planetary-eats:intro-complete';

function markIntroComplete() {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.planetaryIntro = 'complete';
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(INTRO_COMPLETE_EVENT));
  }
}

export default function SplashOverlay() {
  const [visible, setVisible] = useState(true);
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const logoScale = useRef(new Animated.Value(reducedMotion ? 1 : 0.93)).current;
  const finishing = useRef(false);

  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;

    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: reducedMotion ? 120 : EXIT_MS,
      useNativeDriver: false,
    }).start(() => {
      markIntroComplete();
      setVisible(false);
    });
  }, [overlayOpacity, reducedMotion]);

  useEffect(() => {
    if (!reducedMotion) {
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 620,
          delay: 180,
          useNativeDriver: false,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 900,
          delay: 120,
          useNativeDriver: false,
        }),
      ]).start();
    }

    const timer = window.setTimeout(finish, reducedMotion ? REDUCED_MOTION_HOLD_MS : HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [finish, logoOpacity, logoScale, reducedMotion]);

  if (!visible) return null;

  return (
    <Animated.View
      accessibilityLabel="Planetary Eats introduction"
      pointerEvents="none"
      style={[styles.wrap, { opacity: overlayOpacity }]}
    >
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <Image
          source={logoImage}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Planetary Eats"
        />
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
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  logo: {
    width: 320,
    height: 168, // 800 x 419 artwork
  },
});
