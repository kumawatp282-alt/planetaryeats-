// Web-only cinematic splash. The approved wordmark-to-globe film plays once
// when the root layout mounts, then its final Earth moves onto the exact live
// canvas bounds before fading. That bridge makes the film and Three.js globe
// read as one continuous object instead of two unrelated scenes.
// Native platforms keep the lightweight Animated fallback in SplashOverlay.tsx.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../constants/theme';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoImage = require('../assets/planetary-eats-logo.png');

const VIDEO_SRC = '/planetary-eats-logo-to-globe.mp4';
const VIDEO_BACKGROUND = '#FAF3E6';
const SOURCE_WIDTH = 1280;
const SOURCE_HEIGHT = 720;
const SOURCE_GLOBE_CENTER_X = 640;
const SOURCE_GLOBE_CENTER_Y = 329;
const SOURCE_GLOBE_DIAMETER = 330;
const MOVE_MS = 650;
const EXIT_MS = 360;
const PLAYBACK_FALLBACK_MS = 4800;
const INTRO_COMPLETE_EVENT = 'planetary-eats:intro-complete';

const VideoElement = 'video' as unknown as React.ComponentType<
  React.VideoHTMLAttributes<HTMLVideoElement> & { ref?: React.Ref<HTMLVideoElement> }
>;

const videoStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
  objectFit: 'contain',
  backgroundColor: VIDEO_BACKGROUND,
  transform: 'translate3d(0, 0, 0)',
  willChange: 'transform',
};

function markIntroComplete() {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.planetaryIntro = 'complete';
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(INTRO_COMPLETE_EVENT));
  }
}

function moveFinalFrameToLiveGlobe(video: HTMLVideoElement): boolean {
  const globe = document.getElementById('planetary-eats-live-globe');
  if (!globe) return false;

  const videoRect = video.getBoundingClientRect();
  const globeRect = globe.getBoundingClientRect();
  if (videoRect.width < 1 || videoRect.height < 1 || globeRect.width < 1) return false;

  // Reconstruct the actual object-fit: contain box so the source coordinates
  // remain correct on wide, tall and mobile browser windows.
  const contentScale = Math.min(
    videoRect.width / SOURCE_WIDTH,
    videoRect.height / SOURCE_HEIGHT
  );
  const contentWidth = SOURCE_WIDTH * contentScale;
  const contentHeight = SOURCE_HEIGHT * contentScale;
  const contentLeft = (videoRect.width - contentWidth) / 2;
  const contentTop = (videoRect.height - contentHeight) / 2;
  const sourceCenterX = contentLeft + SOURCE_GLOBE_CENTER_X * contentScale;
  const sourceCenterY = contentTop + SOURCE_GLOBE_CENTER_Y * contentScale;
  const sourceDiameter = SOURCE_GLOBE_DIAMETER * contentScale;
  const targetCenterX = globeRect.left + globeRect.width / 2 - videoRect.left;
  const targetCenterY = globeRect.top + globeRect.height / 2 - videoRect.top;
  const scale = globeRect.width / sourceDiameter;

  video.style.transformOrigin = `${sourceCenterX}px ${sourceCenterY}px`;
  video.style.transition = `transform ${MOVE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
  video.style.transform = `translate3d(${targetCenterX - sourceCenterX}px, ${
    targetCenterY - sourceCenterY
  }px, 0) scale(${scale})`;
  return true;
}

export default function SplashOverlay() {
  const [visible, setVisible] = useState(true);
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const opacity = useRef(new Animated.Value(1)).current;
  const finishing = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const finish = useCallback((bridgeToGlobe: boolean) => {
    if (finishing.current) return;
    finishing.current = true;

    const video = videoRef.current;
    const hasBridge = Boolean(bridgeToGlobe && video && moveFinalFrameToLiveGlobe(video));
    const fadeDelay = hasBridge ? MOVE_MS : 0;

    window.setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: EXIT_MS,
        useNativeDriver: false,
      }).start(() => {
        markIntroComplete();
        setVisible(false);
      });
    }, fadeDelay);
  }, [opacity]);

  useEffect(() => {
    if (reducedMotion) {
      const reducedMotionTimer = setTimeout(() => finish(false), 520);
      return () => clearTimeout(reducedMotionTimer);
    }

    // Autoplay can fail under unusual browser policies. Never leave the app
    // hidden behind the splash if playback or decoding stalls.
    const fallbackTimer = setTimeout(() => finish(false), PLAYBACK_FALLBACK_MS);
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.play().catch(() => finish(false));
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
          onEnded={() => finish(true)}
          onError={() => finish(false)}
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
