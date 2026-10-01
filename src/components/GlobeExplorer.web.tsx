// Real Earth (web only) — the actual Blender-rendered globe (72 frames, a
// full 360° turntable at 5° steps, from supabase/../design assets),
// displayed as a swapped image rather than a live WebGL mesh. Dragging
// horizontally scrubs through the frames; pins are positioned with plain
// trig that reproduces the exact camera this globe was rendered with
// (see PROJECTION NOTES below), so they track the artwork precisely. No
// pitch-drag and no zoom — the render only exists at one fixed tilt and
// distance. Each bowl is a real photo pinned to its country; tapping one
// pops the bowl out full-circle over the globe.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { MenuItem } from '../data/menu';
import { colors, fonts, radii, spacing } from '../constants/theme';
import BowlPopModal from './BowlPopModal';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoImage = require('../assets/planetary-eats-logo.png');

interface Props {
  items: MenuItem[]; // must have `origin` set
  onSelect: (item: MenuItem) => void;
}

// PROJECTION NOTES — these five numbers describe exactly how the Blender
// turntable was rendered (see public/globe_frames/globe_frames.json):
// a camera at FRAME_DIST, elevated FRAME_TILT_DEG above the equatorial
// plane, with vertical field of view FRAME_FOV_DEG, looking at a unit
// globe that rotates by FRAME_STEP_DEG between each successive frame
// (frame 0 = 0°). Reproducing that exact camera in plain trig — rather
// than re-deriving it from scratch — is what lets a pin computed from
// lat/long land in the same spot the artwork actually shows that country.
// FRAME_LON_OFFSET_DEG was solved empirically (not stated in the render
// metadata): it's the phase difference between this app's existing
// lat/long→vector convention (inherited from the old textured-sphere
// globe) and this render's own prime-meridian alignment — calibrated by
// projecting known pins (Germany, Turkey, West Africa) and fitting the
// offset that lines them up with the baked country labels in frame 0.
const FRAME_COUNT = 72;
const FRAME_STEP_DEG = -5;
const FRAME_TILT_DEG = 18;
const FRAME_DIST = 3.7;
const FRAME_FOV_DEG = 39.597752709049864;
const FRAME_LON_OFFSET_DEG = 90;
const DRAG_DEG_PER_PX = 0.344; // matches the old sphere's drag feel (0.006 rad/px)

function frameUrl(index: number): string {
  const n = ((index % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
  return `/globe_frames/f_${String(n).padStart(3, '0')}.webp`;
}

// Precomputed camera basis — the render camera never moves, only the
// globe spins, so this only needs to be derived once.
const TILT_RAD = (FRAME_TILT_DEG * Math.PI) / 180;
const CAM_Y = FRAME_DIST * Math.sin(TILT_RAD);
const CAM_Z = FRAME_DIST * Math.cos(TILT_RAD);
const FWD_LEN = Math.sqrt(CAM_Y * CAM_Y + CAM_Z * CAM_Z);
const FWD = { x: 0, y: -CAM_Y / FWD_LEN, z: -CAM_Z / FWD_LEN };
// right = normalize(cross(forward, worldUp)); worldUp = (0,1,0)
const RIGHT_RAW = { x: -FWD.z, y: 0, z: FWD.x };
const RIGHT_LEN = Math.sqrt(RIGHT_RAW.x * RIGHT_RAW.x + RIGHT_RAW.z * RIGHT_RAW.z);
const RIGHT = { x: RIGHT_RAW.x / RIGHT_LEN, y: 0, z: RIGHT_RAW.z / RIGHT_LEN };
// camUp = cross(right, forward)
const CAM_UP = {
  x: RIGHT.y * FWD.z - RIGHT.z * FWD.y,
  y: RIGHT.z * FWD.x - RIGHT.x * FWD.z,
  z: RIGHT.x * FWD.y - RIGHT.y * FWD.x,
};
const PROJ_F = 1 / Math.tan((FRAME_FOV_DEG * Math.PI) / 180 / 2);

interface Projected {
  x: number;
  y: number;
  facing: number; // -1..1, >0 means the point faces the camera
}

// Projects a lat/long pin onto the current frame's image, at the globe's
// current (continuous) yaw angle — same math that determines which frame
// is on screen, just evaluated exactly instead of snapped to a frame.
function projectPin(lat: number, long: number, rotYDeg: number): Projected {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((long + FRAME_LON_OFFSET_DEG) * Math.PI) / 180;
  const x = -Math.sin(phi) * Math.cos(theta);
  const y = Math.cos(phi);
  const z = Math.sin(phi) * Math.sin(theta);

  // Negated: the globe's yaw convention here turns out opposite to the
  // frame-index convention (frame N = rotY/STEP_DEG) — verified by
  // projecting known pins against the actual rendered frames and checking
  // they land on the baked country labels at several drag angles, not
  // just at frame 0 where the two conventions happen to agree trivially.
  const r = (-rotYDeg * Math.PI) / 180;
  const xr = x * Math.cos(r) + z * Math.sin(r);
  const zr = -x * Math.sin(r) + z * Math.cos(r);
  const yr = y;

  const relX = xr;
  const relY = yr - CAM_Y;
  const relZ = zr - CAM_Z;
  const camX = relX * RIGHT.x + relY * RIGHT.y + relZ * RIGHT.z;
  const camY = relX * CAM_UP.x + relY * CAM_UP.y + relZ * CAM_UP.z;
  const camZ = relX * FWD.x + relY * FWD.y + relZ * FWD.z;

  const ndcX = (camX / camZ) * PROJ_F;
  const ndcY = (camY / camZ) * PROJ_F;

  const toCamX = -xr;
  const toCamY = CAM_Y - yr;
  const toCamZ = CAM_Z - zr;
  const toCamLen = Math.sqrt(toCamX * toCamX + toCamY * toCamY + toCamZ * toCamZ);
  const pointLen = Math.sqrt(xr * xr + yr * yr + zr * zr);
  const facing = (xr * toCamX + yr * toCamY + zr * toCamZ) / (pointLen * toCamLen);

  return { x: (ndcX * 0.5 + 0.5) * 100, y: (1 - (ndcY * 0.5 + 0.5)) * 100, facing };
}

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

// Warms the browser's HTTP cache for every frame so scrubbing never shows
// a blank/loading frame after the first drag — fired once, fire-and-forget.
let framesPreloaded = false;
function usePreloadFrames() {
  useEffect(() => {
    if (framesPreloaded || typeof window === 'undefined') return;
    framesPreloaded = true;
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new window.Image();
      img.src = frameUrl(i);
    }
  }, []);
}

export default function GlobeExplorer({ items, onSelect }: Props) {
  const [globeSize, setGlobeSize] = useState(320);
  const [activeBowlId, setActiveBowlId] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const markerRefs = useRef<Record<string, View | null>>({});
  // Cursor-hover zoom on pins — read/written every frame in the imperative
  // animate() loop below, so this stays a ref (a pin popping shouldn't
  // trigger a React re-render 60x/sec).
  const hoveredIdRef = useRef<string | null>(null);
  const hoverScaleRef = useRef<Record<string, number>>({});
  const stars = useStarfield(50);
  useTwinkleKeyframes();
  usePreloadFrames();

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
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img || globeSize < 10) return;

    // The globe holds a fixed front-facing pose (rotY=0, frame 0, matching
    // the splash film's final frame) every time the page loads, and only
    // moves if someone drags it.
    const state = { rotY: 0, dragging: false, lastX: 0, frame: -1 };

    const onPointerDown = (e: PointerEvent) => {
      state.dragging = true;
      state.lastX = e.clientX;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!state.dragging) return;
      const dx = e.clientX - state.lastX;
      state.rotY += dx * DRAG_DEG_PER_PX;
      state.lastX = e.clientX;
    };
    const onPointerUp = () => {
      state.dragging = false;
      wrap.style.cursor = 'grab';
    };

    wrap.style.cursor = 'grab';
    wrap.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    let raf = 0;
    const animate = () => {
      const desiredFrame = Math.round(state.rotY / FRAME_STEP_DEG);
      const wrappedFrame = ((desiredFrame % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
      if (wrappedFrame !== state.frame) {
        state.frame = wrappedFrame;
        img.src = frameUrl(wrappedFrame);
      }

      const pulse = 1 + Math.sin(performance.now() * 0.003) * 0.12;

      bowlItems.forEach((item) => {
        if (!item.origin) return;
        const el = markerRefs.current[item.id] as unknown as HTMLElement | null;
        if (!el) return;
        const { x, y, facing } = projectPin(item.origin.lat, item.origin.long, state.rotY);
        const screenX = (x / 100) * globeSize;
        const screenY = (y / 100) * globeSize;
        const visible = facing > 0.05;
        const depth = Math.max(0, Math.min(1, facing));
        const opacity = visible ? 0.4 + depth * 0.6 : 0;

        // Ease this pin's hover scale toward 1.5x when hovered, 1x
        // otherwise — a spring-like pop rather than an instant snap.
        const hoverTarget = hoveredIdRef.current === item.id ? 1.5 : 1;
        const currentHover = hoverScaleRef.current[item.id] ?? 1;
        const nextHover = currentHover + (hoverTarget - currentHover) * 0.25;
        hoverScaleRef.current[item.id] = nextHover;

        const scale = (0.6 + depth * 0.5) * pulse * nextHover;
        el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%) scale(${scale})`;
        el.style.opacity = String(opacity);
        el.style.pointerEvents = visible ? 'auto' : 'none';
        el.style.zIndex = String(Math.round(depth * 1000) + (hoveredIdRef.current === item.id ? 2000 : 0));
      });

      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      wrap.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
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
          // @ts-expect-error ref typed for RN View, used here as a plain div
          ref={wrapRef}
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
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img
            ref={imgRef}
            src={frameUrl(0)}
            draggable={false}
            style={{
              width: globeSize,
              height: globeSize,
              touchAction: 'none',
              userSelect: 'none',
              filter: 'drop-shadow(0 18px 40px rgba(58,46,30,0.28))',
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
