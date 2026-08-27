// Real 3D Earth (web only) — an actual textured sphere rendered with
// three.js. The globe rotates gently on its own and can also be turned by
// hand. No zoom. Each bowl is a real photo pinned to its country; tapping
// one pops the bowl out full-circle over the globe.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import * as THREE from 'three';
import { Asset } from 'expo-asset';
import { MenuItem } from '../data/menu';
import { colors, fonts, radii, spacing } from '../constants/theme';
import BowlPopModal from './BowlPopModal';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const earthTextureModule = require('../assets/earth.jpg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoImage = require('../assets/planetary-eats-logo.png');

interface Props {
  items: MenuItem[]; // must have `origin` set
  onSelect: (item: MenuItem) => void;
}

const SPHERE_RADIUS = 1.3;
const CAMERA_Z = 3.2;
const AUTO_ROTATION_SPEED = 0.00012; // radians per millisecond (one turn in ~52 seconds)

function latLongToVector3(lat: number, long: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (long + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Escape hatch for the one plain DOM element RN has no primitive for.
const CanvasEl = 'canvas' as unknown as React.ComponentType<
  React.CanvasHTMLAttributes<HTMLCanvasElement> & { ref?: React.Ref<HTMLCanvasElement> }
>;

interface Star {
  left: `${number}%`;
  top: `${number}%`;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

function useStarfield(count: number): Star[] {
  return useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() < 0.85 ? 1 : Math.random() < 0.97 ? 2 : 3,
        opacity: 0.15 + Math.random() * 0.35,
        duration: 1.8 + Math.random() * 3.2,
        delay: Math.random() * 4,
      })),
    [count]
  );
}

let twinkleStyleInjected = false;
function useTwinkleKeyframes() {
  useEffect(() => {
    if (twinkleStyleInjected || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes planetary-eats-twinkle {
        0%, 100% { opacity: 0.2; }
        50% { opacity: 1; }
      }
      @keyframes planetary-eats-pin-ring {
        0% { transform: scale(0.85); opacity: 0.55; }
        70% { opacity: 0; }
        100% { transform: scale(1.9); opacity: 0; }
      }
      @keyframes planetary-eats-flag-pop {
        0% { transform: scale(0); opacity: 0; }
        60% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    twinkleStyleInjected = true;
  }, []);
}

export default function GlobeExplorer({ items, onSelect }: Props) {
  const [globeSize, setGlobeSize] = useState(320);
  const [activeBowlId, setActiveBowlId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const markerRefs = useRef<Record<string, View | null>>({});
  // Cursor-hover zoom on pins — read/written every frame in the imperative
  // animate() loop below, so this stays a ref (a pin popping shouldn't
  // trigger a React re-render 60x/sec).
  const hoveredIdRef = useRef<string | null>(null);
  const hoverScaleRef = useRef<Record<string, number>>({});
  const stars = useStarfield(50);
  useTwinkleKeyframes();

  useEffect(() => {
    function updateSize() {
      setGlobeSize(Math.min(window.innerWidth * 0.85, window.innerHeight * 0.5, 480));
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const bowlItems = items.filter((item) => item.origin);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || globeSize < 10) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = CAMERA_Z;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(globeSize, globeSize);

    const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, 96, 96);
    const loader = new THREE.TextureLoader();
    const uri = Asset.fromModule(earthTextureModule).uri;
    // Unlit material — the globe should read as bright and vivid everywhere,
    // not shaded into a dark "night side" like a physically-lit render.
    const material = new THREE.MeshBasicMaterial({ color: 0x0b1a33 });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    // Assign the texture only once it's fully decoded, so the sphere never
    // pops from a blank placeholder to the real map mid-animation — by the
    // time this fires the splash screen has already preloaded the same URI.
    loader.load(uri, (loadedTexture) => {
      if ('colorSpace' in loadedTexture) (loadedTexture as any).colorSpace = (THREE as any).SRGBColorSpace;
      // Mipmapping blurs texels across the UV seam at the antimeridian
      // (u=0/u=1), which shows up as a thin visible line running pole to
      // pole. Turning mipmaps off removes that sampling artifact — at this
      // globe's on-screen size the minification cost is not noticeable.
      loadedTexture.generateMipmaps = false;
      loadedTexture.minFilter = THREE.LinearFilter;
      loadedTexture.magFilter = THREE.LinearFilter;
      loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
      loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
      material.map = loadedTexture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    });

    // Fresnel-based atmosphere glow — bright at the grazing edge, transparent
    // toward the center, like real atmospheric scattering.
    const atmosphereGeometry = new THREE.SphereGeometry(SPHERE_RADIUS * 1.16, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: { glowColor: { value: new THREE.Color(0xe4b878) } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        uniform vec3 glowColor;
        void main() {
          float intensity = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewPos)), 0.0), 3.0);
          gl_FragColor = vec4(glowColor, intensity * 0.9);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial));

    // Soft outer nebula-colored halo behind everything.
    const haloGeometry = new THREE.SphereGeometry(SPHERE_RADIUS * 1.3, 32, 32);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xd9c39a,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(haloGeometry, haloMaterial));

    const markerBase: Record<string, THREE.Vector3> = {};
    bowlItems.forEach((item) => {
      if (item.origin) {
        markerBase[item.id] = latLongToVector3(item.origin.lat, item.origin.long, SPHERE_RADIUS + 0.015);
      }
    });

    // Keep the globe drifting until the user takes control by dragging it.
    const state = { rotY: 0.3, rotX: 0, dragging: false, lastX: 0, lastY: 0 };

    const onPointerDown = (e: PointerEvent) => {
      state.dragging = true;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!state.dragging) return;
      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      state.rotY += dx * 0.006;
      state.rotX = Math.max(-0.9, Math.min(0.9, state.rotX + dy * 0.006));
      state.lastX = e.clientX;
      state.lastY = e.clientY;
    };
    const onPointerUp = () => {
      state.dragging = false;
    };

    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    let raf = 0;
    let lastFrameTime = performance.now();
    const animate = (frameTime: number) => {
      // Use elapsed time so the rotation speed is consistent across displays.
      // Clamp it to prevent a large jump after returning to a background tab.
      const elapsed = Math.min(frameTime - lastFrameTime, 100);
      lastFrameTime = frameTime;
      if (!state.dragging) state.rotY += AUTO_ROTATION_SPEED * elapsed;

      sphere.rotation.y = state.rotY;
      sphere.rotation.x = state.rotX;
      sphere.updateMatrixWorld();

      const pulse = 1 + Math.sin(performance.now() * 0.003) * 0.12;

      bowlItems.forEach((item) => {
        const base = markerBase[item.id];
        const el = markerRefs.current[item.id] as unknown as HTMLElement | null;
        if (!base || !el) return;
        const world = base.clone().applyMatrix4(sphere.matrixWorld);
        const facing = world.z > 0.05;
        const depth = Math.max(0, Math.min(1, world.z / SPHERE_RADIUS));
        const projected = world.clone().project(camera);
        const screenX = (projected.x * 0.5 + 0.5) * globeSize;
        const screenY = (1 - (projected.y * 0.5 + 0.5)) * globeSize;
        const opacity = facing ? 0.4 + depth * 0.6 : 0;

        // Ease this pin's hover scale toward 1.5x when hovered, 1x
        // otherwise — a spring-like pop rather than an instant snap.
        const hoverTarget = hoveredIdRef.current === item.id ? 1.5 : 1;
        const currentHover = hoverScaleRef.current[item.id] ?? 1;
        const nextHover = currentHover + (hoverTarget - currentHover) * 0.25;
        hoverScaleRef.current[item.id] = nextHover;

        const scale = (0.6 + depth * 0.5) * pulse * nextHover;
        el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%) scale(${scale})`;
        el.style.opacity = String(opacity);
        el.style.pointerEvents = facing ? 'auto' : 'none';
        el.style.zIndex = String(Math.round(depth * 1000) + (hoveredIdRef.current === item.id ? 2000 : 0));
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      material.map?.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globeSize]);

  return (
    <View
      style={{
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: spacing.lg,
        paddingBottom: spacing.lg,
        backgroundColor: colors.cream,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Warm, organic wash — soft sage and gold light, not a sci-fi nebula */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          // @ts-expect-error web-only CSS background not in RN's style typings
          background:
            'radial-gradient(ellipse 65% 50% at 20% 10%, rgba(0,0,0,0.05), transparent 62%),' +
            'radial-gradient(ellipse 55% 45% at 85% 80%, rgba(0,0,0,0.06), transparent 60%),' +
            'radial-gradient(ellipse 60% 55% at 70% 20%, rgba(0,0,0,0.04), transparent 65%)',
        }}
      />
      {stars.map((star, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            borderRadius: star.size,
            backgroundColor: colors.sun,
            opacity: star.opacity,
            animationName: 'planetary-eats-twinkle',
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          }}
        />
      ))}

      <Image
        source={logoImage}
        style={styles.brandLogo}
        resizeMode="contain"
        accessibilityLabel="Planetary Eats"
      />
      <Text style={styles.tagline}>Explore the World, One Bowl at a Time.</Text>

      {/* Everything below is confined to the globe's own footprint — the
          bowl pop-out replaces just this area, not the whole screen. */}
      <View style={{ alignItems: 'center', position: 'relative' }}>
        <View
          style={{
            width: globeSize,
            height: globeSize,
            alignItems: 'center',
            justifyContent: 'center',
            // Fully hide the earth (not just dim it) while a bowl is popped
            // out, so the bowl reads as a layer replacing the globe, not one
            // sitting in front of it.
            opacity: activeBowlId ? 0 : 1,
          }}
        >
          <CanvasEl
            ref={canvasRef}
            width={globeSize}
            height={globeSize}
            style={{
              width: globeSize,
              height: globeSize,
              borderRadius: globeSize,
              touchAction: 'none',
              filter: 'brightness(1.08) saturate(1.05) sepia(0.05)',
            }}
          />

          {bowlItems.map((item, index) => (
            <View
              key={item.id}
              ref={(node) => {
                markerRefs.current[item.id] = node;
              }}
              style={{ position: 'absolute', left: 0, top: 0, alignItems: 'center' }}
            >
              {/* Expanding ring — a "here's a bowl" signal you can spot
                  before you even recognize the photo, staggered per pin so
                  the globe doesn't pulse in unison. */}
              <View
                pointerEvents="none"
                style={[
                  styles.pinRing,
                  {
                    animationName: 'planetary-eats-pin-ring',
                    animationDuration: '2.6s',
                    animationDelay: `${(index % 6) * 0.35}s`,
                    animationIterationCount: 'infinite',
                    animationTimingFunction: 'ease-out',
                  } as any,
                ]}
              />

              {item.dishImage ? (
                <Pressable
                  onPress={() => setActiveBowlId(item.id)}
                  onHoverIn={() => {
                    hoveredIdRef.current = item.id;
                  }}
                  onHoverOut={() => {
                    if (hoveredIdRef.current === item.id) hoveredIdRef.current = null;
                  }}
                  style={styles.dishPin}
                  hitSlop={12}
                >
                  <Image source={item.dishImage} style={styles.dishPinImage} resizeMode="cover" />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setActiveBowlId(item.id)}
                  onHoverIn={() => {
                    hoveredIdRef.current = item.id;
                  }}
                  onHoverOut={() => {
                    if (hoveredIdRef.current === item.id) hoveredIdRef.current = null;
                  }}
                  style={styles.dot}
                  hitSlop={12}
                />
              )}

              {/* Flag badge — so you know which country this is without
                  tapping. Always visible, sits on the same transformed
                  wrapper so it tracks the pin as the globe spins. */}
              {item.origin?.flag && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.flagBadge,
                    {
                      animationName: 'planetary-eats-flag-pop',
                      animationDuration: '0.5s',
                      animationDelay: `${0.4 + (index % 6) * 0.08}s`,
                      animationFillMode: 'backwards',
                      animationTimingFunction: 'ease-out',
                    } as any,
                  ]}
                >
                  <Text style={styles.flagBadgeText}>{item.origin.flag}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <Text style={[styles.hint, activeBowlId ? { opacity: 0 } : null]}>
          Drag to spin · tap a bowl to explore
        </Text>

        <BowlPopModal
          items={bowlItems}
          allItems={items}
          activeId={activeBowlId}
          size={globeSize}
          onClose={() => setActiveBowlId(null)}
          onViewBowl={(item) => {
            setActiveBowlId(null);
            onSelect(item);
          }}
        />
      </View>
    </View>
  );
}

const styles = {
  brandLogo: {
    width: 220,
    height: 68,
    // Same multiply trick as AppHeader — see its comment for why.
    mixBlendMode: 'multiply' as const,
  },
  tagline: {
    fontSize: 15,
    color: colors.inkMuted,
    marginTop: 2,
    marginBottom: spacing.md,
    fontFamily: fonts.body,
  },
  hint: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.inkMuted,
    textAlign: 'center' as const,
    fontFamily: fonts.body,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.sun,
    borderWidth: 2,
    borderColor: colors.card,
  },
  dishPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.sun,
    overflow: 'hidden' as const,
    backgroundColor: colors.card,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dishPinImage: {
    width: '100%' as const,
    height: '100%' as const,
  },
  pinRing: {
    position: 'absolute' as const,
    top: '50%' as const,
    left: '50%' as const,
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.sun,
  },
  flagBadge: {
    position: 'absolute' as const,
    right: -6,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.card,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  flagBadgeText: {
    fontSize: 11,
    lineHeight: 13,
  },
};
