// Real 3D Earth (web only) — the user's own Blender-made globe mesh
// (public/planetary_globe.glb: the actual mesh + the color texture baked
// in that same session), rendered live with three.js so it can be freely
// dragged on both axes — including all the way to the poles — rather
// than the fixed-tilt pre-rendered frame sequence this replaced (that
// could only spin horizontally and never showed the poles at all). No
// zoom, no auto-rotation. Each country is plain text pinned to its
// location; tapping one pops the bowl out full-circle over the globe.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import * as THREE from 'three';
// eslint-disable-next-line import/no-unresolved
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MenuItem } from '../data/menu';
import { colors, fonts, spacing } from '../constants/theme';
import BowlPopModal from './BowlPopModal';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoImage = require('../assets/planetary-eats-logo.png');

interface Props {
  items: MenuItem[]; // must have `origin` set
  onSelect: (item: MenuItem) => void;
}

const SPHERE_RADIUS = 1.3;
const CAMERA_Z = 3.2;
// How far the globe can pitch before it stops — not a full 90° so it
// never quite flips past vertical (which reads as disorienting), but
// close enough that both poles are fully reachable by dragging.
const PITCH_LIMIT = 1.45;

// Longitude phase for this mesh's own texture UV layout. Same as the
// original sphere's convention (long+180) — verified directly against
// the mesh's own data: decoded the .glb's vertex positions and UVs,
// derived the true relationship (texture longitude = u*360 - 180, a
// standard equirectangular unwrap), and cross-checked by sampling the
// actual texture pixels at a few real cities' computed (u,v) — Germany's
// coordinates land squarely on the Alps/Italy, Singapore's on the
// Indonesian archipelago. An earlier 90° offset here came from a flawed
// camera-model fit against the (now-removed) baked frame render and was
// wrong — it happened to look plausible for a cluster of nearby European
// pins but put Japan and Singapore over Africa once dragged into view.
const LON_OFFSET_DEG = 180;

function latLongToVector3(lat: number, long: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (long + LON_OFFSET_DEG) * (Math.PI / 180);
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
      @keyframes planetary-eats-label-pop {
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
      setGlobeSize(Math.min(window.innerWidth * 0.95, window.innerHeight * 0.72, 760));
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

    // Everything that spins lives under one group, so rotation applies the
    // same way whether it's still the placeholder sphere or (once loaded)
    // the real Blender mesh — no bookkeeping needed to carry rotation over
    // when the swap happens.
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Plain-color placeholder, visible for the brief moment before the
    // real mesh finishes loading, so the canvas is never blank.
    const placeholderGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, 48, 48);
    const placeholderMaterial = new THREE.MeshBasicMaterial({ color: 0x1c3f63 });
    const placeholder = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
    globeGroup.add(placeholder);

    // Lit, not unlit — the mesh's normal map (the mountain/terrain relief
    // baked in Blender) only has anything to shade against when there are
    // real lights in the scene. A strong ambient floor keeps every side
    // bright (no globe-has-a-dark-side problem while free-dragging); the
    // directional light on top of that is what makes the terrain actually
    // read as bumpy/three-dimensional instead of a flat printed texture.
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const keyLight = new THREE.DirectionalLight(0xfff3df, 1.3);
    keyLight.position.set(-2.4, 2.6, 3.2);
    scene.add(keyLight);

    const gltfLoader = new GLTFLoader();
    let loadedMesh: THREE.Object3D | null = null;
    gltfLoader.load('/planetary_globe.glb', (gltf) => {
      gltf.scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const prevMaterial = child.material as THREE.MeshStandardMaterial;
        const colorMap = prevMaterial?.map ?? null;
        const normalMap = prevMaterial?.normalMap ?? null;
        if (colorMap) {
          if ('colorSpace' in colorMap) (colorMap as any).colorSpace = (THREE as any).SRGBColorSpace;
          // Default anisotropy is 1, which blurs badly at the shallow
          // viewing angles a sphere's curvature constantly produces —
          // most of the globe is never viewed face-on to its surface.
          // This is what was reading as "lower quality than Blender":
          // Blender's viewport applies proper anisotropic filtering by
          // default, three.js does not unless asked.
          colorMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
          colorMap.needsUpdate = true;
        }
        if (normalMap) normalMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
        child.material = new THREE.MeshStandardMaterial({
          map: colorMap ?? undefined,
          normalMap: normalMap ?? undefined,
          roughness: 0.88,
          metalness: 0,
        });
      });
      gltf.scene.scale.setScalar(SPHERE_RADIUS);
      globeGroup.remove(placeholder);
      placeholderGeometry.dispose();
      placeholderMaterial.dispose();
      globeGroup.add(gltf.scene);
      loadedMesh = gltf.scene;
    });

    // A thin, soft rim-light right at the globe's own edge — not the wide
    // separate "ring" the old satellite-photo globe used (that warm-gold
    // glow was tuned against a dark navy ocean; against this globe's own
    // bright pastel palette it read as a mismatched halo sitting apart
    // from it rather than part of it). Tight radius, low intensity, pale
    // neutral color: barely-there edge definition, not a second shape.
    const atmosphereGeometry = new THREE.SphereGeometry(SPHERE_RADIUS * 1.045, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: { glowColor: { value: new THREE.Color(0xffffff) } },
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
          float intensity = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewPos)), 0.0), 4.0);
          gl_FragColor = vec4(glowColor, intensity * 0.35);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial));

    const markerBase: Record<string, THREE.Vector3> = {};
    bowlItems.forEach((item) => {
      if (item.origin) {
        markerBase[item.id] = latLongToVector3(item.origin.lat, item.origin.long, SPHERE_RADIUS + 0.015);
      }
    });

    // The globe holds a fixed front-facing pose (rotY=0, rotX=0) every
    // time the page loads, and only moves if someone drags it — free on
    // both axes, so the poles are reachable, not just a left-right spin.
    const state = { rotY: 0, rotX: 0, dragging: false, lastX: 0, lastY: 0 };

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
      state.rotX = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, state.rotX + dy * 0.006));
      state.lastX = e.clientX;
      state.lastY = e.clientY;
    };
    const onPointerUp = () => {
      state.dragging = false;
      canvas.style.cursor = 'grab';
    };

    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    let raf = 0;
    const animate = () => {
      globeGroup.rotation.y = state.rotY;
      globeGroup.rotation.x = state.rotX;
      globeGroup.updateMatrixWorld();

      bowlItems.forEach((item) => {
        const base = markerBase[item.id];
        const el = markerRefs.current[item.id] as unknown as HTMLElement | null;
        if (!base || !el) return;
        const world = base.clone().applyMatrix4(globeGroup.matrixWorld);
        const facing = world.z > 0.05;
        const depth = Math.max(0, Math.min(1, world.z / SPHERE_RADIUS));
        const projected = world.clone().project(camera);
        const screenX = (projected.x * 0.5 + 0.5) * globeSize;
        const screenY = (1 - (projected.y * 0.5 + 0.5)) * globeSize;
        const opacity = facing ? 0.45 + depth * 0.55 : 0;

        // Ease this label's hover scale toward a gentle pop when hovered,
        // 1x otherwise — a spring-like pop rather than an instant snap.
        const hoverTarget = hoveredIdRef.current === item.id ? 1.18 : 1;
        const currentHover = hoverScaleRef.current[item.id] ?? 1;
        const nextHover = currentHover + (hoverTarget - currentHover) * 0.25;
        hoverScaleRef.current[item.id] = nextHover;

        const scale = (0.75 + depth * 0.35) * nextHover;
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
      placeholderGeometry.dispose();
      placeholderMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      if (loadedMesh) {
        loadedMesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            const mat = child.material as THREE.MeshStandardMaterial;
            mat?.map?.dispose();
            mat?.normalMap?.dispose();
            (child.material as THREE.Material)?.dispose();
          }
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globeSize]);

  return (
    <View
      style={{
        width: '100%',
        // A tapped pin's popup (photo + fact cards + customize controls)
        // can be much taller than the globe's own hero-section footprint —
        // let the container grow to fit it (and stop clipping it) rather
        // than forcing everything into one fixed height. Normal globe
        // browsing still gets the clean fixed-height/clipped hero look.
        //
        // The bowl card itself is absolutely positioned (see BowlPopModal)
        // so it never contributes to this container's own flow height —
        // centering it with justifyContent:'center' was centering against
        // the (mostly invisible) globe canvas box instead, which left a
        // tall empty gap above the card and crammed it toward the bottom
        // on any window where the card was taller than the canvas. Flowing
        // from the top avoids that entirely: the card just starts right
        // below the header and uses its own real height.
        height: activeBowlId ? undefined : '100%',
        minHeight: '100%',
        alignItems: 'center',
        justifyContent: activeBowlId ? 'flex-start' : 'center',
        paddingTop: activeBowlId ? spacing.xl : spacing.lg,
        paddingBottom: activeBowlId ? spacing.lg : spacing.lg,
        backgroundColor: colors.cream,
        overflow: activeBowlId ? 'visible' : 'hidden',
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

      {/* Hidden while a bowl is open — that vertical space goes to the
          bento card instead, which is what "fit everything on one screen,
          no scrolling" actually needs. */}
      {!activeBowlId && (
        <>
          <Image
            source={logoImage}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityLabel="Planetary Eats"
          />
          <Text style={styles.tagline}>Good for you. Good for the planet.</Text>
        </>
      )}

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
            id="planetary-eats-live-globe"
            ref={canvasRef}
            width={globeSize}
            height={globeSize}
            style={{
              width: globeSize,
              height: globeSize,
              borderRadius: globeSize,
              touchAction: 'none',
              filter: 'drop-shadow(0 18px 40px rgba(58,46,30,0.28))',
            }}
          />

          {bowlItems.map((item, index) => (
            <View
              key={item.id}
              ref={(node) => {
                markerRefs.current[item.id] = node;
              }}
              style={{ position: 'absolute', left: 0, top: 0 }}
            >
              <Pressable
                onPress={() => setActiveBowlId(item.id)}
                onHoverIn={() => {
                  hoveredIdRef.current = item.id;
                }}
                onHoverOut={() => {
                  if (hoveredIdRef.current === item.id) hoveredIdRef.current = null;
                }}
                hitSlop={10}
                style={[
                  styles.labelHit,
                  {
                    animationName: 'planetary-eats-label-pop',
                    animationDuration: '0.5s',
                    animationDelay: `${(index % 6) * 0.08}s`,
                    animationFillMode: 'backwards',
                    animationTimingFunction: 'ease-out',
                  } as any,
                ]}
              >
                <Text style={styles.countryLabel} numberOfLines={1}>
                  {item.origin?.country}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <Text style={[styles.hint, activeBowlId ? { opacity: 0 } : null]}>
          Drag to spin · tap a country to explore
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
  labelHit: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    cursor: 'pointer' as const,
  },
  countryLabel: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    fontFamily: fonts.body,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
};
