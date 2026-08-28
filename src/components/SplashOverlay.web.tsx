// Web-only restaurant reveal: dish photography drifts in circular bubbles
// behind the existing wordmark, then the monochrome layer fades into the app.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  type ImageStyle,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoImage = require('../assets/planetary-eats-logo.png');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const indianDish = require('../assets/dishes/indian-butter-masala-bowl.jpg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const japaneseDish = require('../assets/dishes/japanese-katsu-curry-bowl.jpg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mexicanDish = require('../assets/dishes/mexican-chipotle-barbacoa-bowl.jpg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const germanDish = require('../assets/dishes/german-jagerschnitzel-bowl.jpg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mediterraneanDish = require('../assets/dishes/mediterranean-lemon-herb-bowl.jpg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const singaporeanDish = require('../assets/dishes/singaporean-hainanese-bowl.jpg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const westAfricanDish = require('../assets/dishes/west-african-peanut-stew-bowl.jpg');

const HOLD_MS = 3200;
const REDUCED_MOTION_HOLD_MS = 500;
const EXIT_MS = 520;
const INTRO_COMPLETE_EVENT = 'planetary-eats:intro-complete';

const bubbles = [
  {
    source: indianDish,
    position: { left: '-4%' as const, top: '7%' as const },
    ratio: 0.22,
    animationName: 'pe-bubble-drift-a',
    duration: 3600,
    delay: -500,
  },
  {
    source: japaneseDish,
    position: { right: '7%' as const, top: '-5%' as const },
    ratio: 0.16,
    animationName: 'pe-bubble-drift-b',
    duration: 4100,
    delay: -1200,
  },
  {
    source: mexicanDish,
    position: { left: '8%' as const, top: '48%' as const },
    ratio: 0.17,
    animationName: 'pe-bubble-drift-c',
    duration: 3900,
    delay: -900,
  },
  {
    source: germanDish,
    position: { left: '25%' as const, bottom: '-10%' as const },
    ratio: 0.24,
    animationName: 'pe-bubble-drift-b',
    duration: 4300,
    delay: -1500,
  },
  {
    source: mediterraneanDish,
    position: { right: '18%' as const, top: '31%' as const },
    ratio: 0.2,
    animationName: 'pe-bubble-drift-a',
    duration: 3700,
    delay: -1800,
  },
  {
    source: singaporeanDish,
    position: { right: '-2%' as const, bottom: '5%' as const },
    ratio: 0.18,
    animationName: 'pe-bubble-drift-c',
    duration: 4000,
    delay: -300,
  },
  {
    source: westAfricanDish,
    position: { left: '45%' as const, top: '-10%' as const },
    ratio: 0.13,
    animationName: 'pe-bubble-drift-c',
    duration: 3500,
    delay: -700,
  },
] as const;

let motionStylesInjected = false;
function useBubbleMotionStyles() {
  useEffect(() => {
    if (motionStylesInjected || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.id = 'planetary-eats-bubble-motion';
    style.textContent = `
      @keyframes pe-bubble-drift-a {
        0% { transform: translate3d(-14px, 18px, 0) scale(0.94); }
        100% { transform: translate3d(20px, -16px, 0) scale(1.04); }
      }
      @keyframes pe-bubble-drift-b {
        0% { transform: translate3d(18px, -12px, 0) scale(1.03); }
        100% { transform: translate3d(-18px, 20px, 0) scale(0.95); }
      }
      @keyframes pe-bubble-drift-c {
        0% { transform: translate3d(-10px, -18px, 0) scale(0.96); }
        100% { transform: translate3d(16px, 16px, 0) scale(1.05); }
      }
    `;
    document.head.appendChild(style);
    motionStylesInjected = true;
  }, []);
}

function markIntroComplete() {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.planetaryIntro = 'complete';
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(INTRO_COMPLETE_EVENT));
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export default function SplashOverlay() {
  const [visible, setVisible] = useState(true);
  const { width, height } = useWindowDimensions();
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const logoScale = useRef(new Animated.Value(reducedMotion ? 1 : 0.93)).current;
  const finishing = useRef(false);

  useBubbleMotionStyles();

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

    const timer = window.setTimeout(
      finish,
      reducedMotion ? REDUCED_MOTION_HOLD_MS : HOLD_MS
    );
    return () => window.clearTimeout(timer);
  }, [finish, logoOpacity, logoScale, reducedMotion]);

  if (!visible) return null;

  const shortSide = Math.min(width, height);

  return (
    <Animated.View
      accessibilityLabel="Planetary Eats introduction"
      pointerEvents="none"
      style={[styles.wrap, { opacity: overlayOpacity }]}
    >
      <View style={styles.bubbleField} accessibilityElementsHidden>
        {bubbles.map((bubble, index) => {
          const size = clamp(shortSide * bubble.ratio, 76, 210);
          const webMotionStyle = {
            animationName: reducedMotion ? 'none' : bubble.animationName,
            animationDuration: `${bubble.duration}ms`,
            animationDelay: `${bubble.delay}ms`,
            animationDirection: 'alternate',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          } as unknown as ImageStyle;
          return (
            <Image
              key={index}
              source={bubble.source}
              resizeMode="cover"
              style={[
                styles.bubble,
                bubble.position,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                },
                webMotionStyle,
              ]}
            />
          );
        })}
      </View>

      <View style={styles.logoHalo} />
      <Animated.View
        style={[
          styles.logoLayer,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
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
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  bubbleField: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  bubble: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    opacity: 0.9,
    boxShadow: '0 16px 55px rgba(0, 0, 0, 0.42)',
  },
  logoHalo: {
    position: 'absolute',
    width: 380,
    height: 260,
    borderRadius: 190,
    zIndex: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    boxShadow: '0 0 70px 55px rgba(0, 0, 0, 0.68)',
  },
  logoLayer: {
    zIndex: 3,
  },
  logo: {
    width: 300,
    height: 205,
    filter: 'invert(1) grayscale(1)',
    mixBlendMode: 'screen',
  },
});
