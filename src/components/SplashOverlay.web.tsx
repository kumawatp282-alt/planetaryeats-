// Web-only cinematic splash. The approved wordmark-to-globe film plays once
// when the root layout mounts, then fades into the live Three.js globe below.
// Native platforms keep the lightweight Animated fallback in SplashOverlay.tsx.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../constants/theme';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoImage = require('../assets/planetary-eats-logo.png');

const VIDEO_SRC = '/planetary-eats-logo-to-globe.mp4';
const VIDEO_BACKGROUND = '#FAF3E6';
const EXIT_MS = 280;
const PLAYBACK_FALLBACK_MS = 4800;

const VideoElement = 'video' as unknown as React.ComponentType<
  React.VideoHTMLAttributes<HTMLVideoElement> & { ref?: React.Ref<HTMLVideoElement> }
>;

const videoStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
  objectFit: 'contain',
  backgroundColor: VIDEO_BACKGROUND,
};

export default function SplashOverlay() {
  const [visible, setVisible] = useState(true);
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const opacity = useRef(new Animated.Value(1)).current;
  const finishing = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: EXIT_MS,
      useNativeDriver: false,
    }).start(() => setVisible(false));
  }, [opacity]);

  useEffect(() => {
    if (reducedMotion) {
      const reducedMotionTimer = setTimeout(finish, 520);
      return () => clearTimeout(reducedMotionTimer);
    }

    // Autoplay can fail under unusual browser policies. Never leave the app
    // hidden behind the splash if playback or decoding stalls.
    const fallbackTimer = setTimeout(finish, PLAYBACK_FALLBACK_MS);
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.play().catch(() => finish());
    }
    return () => clearTimeout(fallbackTimer);
  }, [finish, reducedMotion]);

  if (!visible) return null;

  return (
    <Animated.View
      accessibilityLabel="Planetary Eats introduction"
      style={[styles.wrap, { opacity }]}
    >
      {reducedMotion ? (
        <View style={styles.reducedMotionLockup}>
          <Image source={logoImage} style={styles.logo} resizeMode="contain" />
          <Text style={styles.tagline}>The world is on the menu.</Text>
        </View>
      ) : (
        <VideoElement
          ref={videoRef}
          src={VIDEO_SRC}
          autoPlay
          muted
          playsInline
          preload="auto"
          controls={false}
          tabIndex={-1}
          aria-hidden="true"
          onEnded={finish}
          onError={finish}
          style={videoStyle}
        />
      )}
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
    backgroundColor: VIDEO_BACKGROUND,
  },
  reducedMotionLockup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 250,
    height: 250,
  },
  tagline: {
    marginTop: 6,
    color: colors.inkMuted,
    fontSize: 13,
    fontFamily: fonts.body,
  },
});
