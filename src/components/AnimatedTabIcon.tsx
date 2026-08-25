// Small bounce + fade-in dot when a tab becomes active, so switching tabs
// feels alive instead of an instant icon-color swap.
import React, { useEffect, useRef } from 'react';
import { Animated, ColorValue, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';

interface Props {
  name: React.ComponentProps<typeof Ionicons>['name'];
  // React Navigation's tabBarIcon callback hands back ColorValue (which can
  // be a platform-color wrapper, not always a plain string) — match that
  // signature instead of narrowing to `string`.
  color: ColorValue;
  size: number;
  focused: boolean;
}

export default function AnimatedTabIcon({ name, color, size, focused }: Props) {
  const scale = useRef(new Animated.Value(focused ? 1.15 : 1)).current;
  const dotOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.15 : 1,
        friction: 5,
        tension: 140,
        useNativeDriver: false,
      }),
      Animated.timing(dotOpacity, {
        toValue: focused ? 1 : 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused]);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size + 16, height: size + 10 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={name} color={color} size={size} />
      </Animated.View>
      <Animated.View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.forest,
          marginTop: 3,
          opacity: dotOpacity,
        }}
      />
    </View>
  );
}
