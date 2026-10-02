// Real 3D Earth (web only) — the user's own Blender scene, rendered live
// with three.js so it can be freely dragged on both axes, all the way to
// the poles. Everything comes from the same Blender file
// (~/Downloads/Untitled23.blend — the actual project, not just an
// export), and — this is the important bit, after two rounds of a
// hand-written lat/long formula putting countries, trees and poles in
// subtly wrong places — country-label positions are no longer computed
// at all. They're read directly off the real `Name_<country>` objects the
// user placed by hand in that scene, exported alongside the Earth/Clouds/
// Trees geometry in one glTF (public/globe_combined.glb) so every layer
// shares the exact same transform by construction: whatever Blender says
// is true here, no formula to get wrong. See latLongToVector3's comment
// further down for why it still exists (as a fallback only) and the new
// top comment on the Name_* extraction code below for how this works.
//
// public/globe_earth.glb carries the real "Earth" mesh's geometry *and*
// its color baked straight to per-vertex colors (Cycles "Combined" bake,
// target VERTEX_COLORS) rather than to a UV image texture — the image-bake
// version had a genuine Cycles artifact at the pole (the shader's
// Object-space noise coordinates get degenerate right at the UV seam/pole,
// baking out as a flat gray smear there independent of what's actually
// painted on the mesh); a real Cycles *render* of the same material never
// showed this, only the UV-texel bake did, so moving the bake target off
// UV sampling entirely removes the defect at its root instead of patching
// around it. public/globe_combined.glb carries Clouds (its own baked
// alpha texture, globe_clouds.png), Trees0/1/2 (flat per-cluster colors,
// no baking needed), and the real `Name_<country>` label meshes (hidden —
// only their position is used, see below). All baked from — and all
// rendered unlit to match — the exact lighting in that scene; see the
// unlit comment further down for why. No zoom, no auto-rotation. Each
// country is plain text pinned to its location; tapping one pops the bowl
// out full-circle over the globe.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import * as THREE from 'three';
// eslint-disable-next-line import/no-unresolved
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// eslint-disable-next-line import/no-unresolved
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
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
// Distance matters more than it looks like it should here: at the old 3.2,
// the sphere's own angular radius (~24°) was actually *larger* than the
// camera's half-FOV (22.5° of a 45° FOV) — the globe was wider than its
// own camera frustum, so terrain right at the limb (this is what was
// cutting off the Himalayas while dragging) was being clipped by the
// camera itself, before the circular canvas mask ever got involved.
// 3.85 gives the sphere's edge a few degrees of headroom inside the frame.
const CAMERA_Z = 3.85;
// How far the globe can pitch before it stops — not a full 90° so it
// never quite flips past vertical (which reads as disorienting), but
// close enough that both poles are fully reachable by dragging.
const PITCH_LIMIT = 1.45;
// Earlier rounds of this file guessed this value (90°, then 180°) from
// visual spot-checks, which is what let real bugs (mirrored trees,
// mislabeled countries) slip through looking "plausible". It was
// re-derived properly this round: exported the real Earth mesh
// uncompressed, parsed the raw glTF buffer in Python, matched exported
// vertices back to their Blender-side counterparts by UV, and fit their
// raw local (x,y,z) against the sphere's own (sin phi cos theta, sin phi
// sin theta, cos phi) terms (RMSE < 0.013 on unit-scale coordinates —
// not a visual approximation, an exact numeric fit). That exposed
// Blender's glTF exporter applying (x,y,z) -> (x,-z,-y) on export (a
// reflection, not the textbook Z-up/Y-up rotation) — composing that with
// latLongToVector3's real formula (below) needs *no* extra correction at
// all, so this is 0. Kept as a named constant (not deleted) so a future
// re-export/re-bake has one obvious place to redo this derivation rather
// than guessing a new angle.
const MESH_AXIS_CORRECTION = 0;

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

// FALLBACK ONLY. Every country currently on the menu has a real hand-placed
// `Name_<country>` object in the Blender scene, and the marker-placement
// code below reads that object's actual exported position instead of
// calling this — the three previous rounds of this file each shipped a
// subtly-wrong version of this exact formula (two different axis/sign
// mistakes that each looked right on a handful of spot-checked countries),
// which is exactly the class of bug that reading Blender's own data instead
// of recomputing it sidesteps entirely. This stays only so a *future* menu
// item whose country has no Name_<country> label in the scene still gets
// placed somewhere plausible by real-world lat/long rather than not
// appearing at all — if that ever triggers, the right fix is to add a real
// label object in Blender and re-export, not to trust this formula's exact
// placement.
function latLongToVector3(lat: number, long: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (long + LON_OFFSET_DEG) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Matches a menu item's origin.country ("West Africa") to its real label
// object's name in the Blender scene (Name_westafrica) — every country name
// in data/menu.ts happens to need nothing more than lowercasing and
// dropping spaces to match how the user named these objects.
function nameKeyFor(country: string): string {
  return `Name_${country.toLowerCase().replace(/\s+/g, '')}`;
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

    // Filled in once globe_combined.glb loads (see below) — a plain object
    // rather than state, since it's read every frame in the imperative
    // animate() loop, not rendered from.
    const markerBase: Record<string, THREE.Vector3> = {};

    // Plain-color placeholder, visible for the brief moment before the
    // real mesh finishes loading, so the canvas is never blank.
    const placeholderGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, 48, 48);
    const placeholderMaterial = new THREE.MeshBasicMaterial({ color: 0x1c3f63 });
    const placeholder = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
    globeGroup.add(placeholder);

    // Unlit, deliberately. These textures aren't plain color maps — they're
    // baked directly from the user's actual Blender scene (Cycles "Combined"
    // bake: the real EarthMat procedural material, lit by the real GlobeSun
    // + GlobeFill lights, including the soft shadow and specular highlight
    // that scene produces). The lighting is already *in* the pixels, so
    // relighting it live would double up — real-time lights on top of an
    // already-lit bake looks wrong, not right. Unlit just displays exactly
    // what Blender rendered, from any angle, since there's nothing left for
    // real-time lighting to compute.
    const textureLoader = new THREE.TextureLoader();
    const anisotropy = renderer.capabilities.getMaxAnisotropy();

    function applyColorTexture(mesh: THREE.Mesh, url: string, transparent: boolean) {
      textureLoader.load(url, (tex) => {
        if ('colorSpace' in tex) (tex as any).colorSpace = (THREE as any).SRGBColorSpace;
        tex.anisotropy = anisotropy;
        // The texture wraps all the way around the globe — without this the
        // left/right edge columns don't blend into each other, which draws a
        // hairline along the seam meridian.
        tex.wrapS = THREE.RepeatWrapping;
        mesh.material = new THREE.MeshBasicMaterial({
          map: tex,
          transparent,
          depthWrite: !transparent,
        });
      });
    }

    // Trees were Draco-compressed on export (85k+131k+39k vertices,
    // ~7MB raw -> ~1MB compressed) — needs the matching decoder, served
    // from public/draco/ alongside everything else rather than a CDN.
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    let loadedMesh: THREE.Object3D | null = null;

    // The real globe mesh. Color comes from real per-vertex data baked
    // straight off the material (see the top-of-file comment for why
    // that's a vertex-color bake rather than a UV-texture bake) — so this
    // just needs vertexColors switched on, no texture to load or apply.
    gltfLoader.load('/globe_earth.glb', (gltf) => {
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // The bake was stored through a Reinhard curve (t = v / (1 + v)) so
          // its HDR highlights survived the 16-bit export. Blender's own
          // scene is set to the "Standard" view transform, which has no such
          // curve — it just clamps at 1.0 — so undo it here (v = t / (1 - t),
          // then clamp) to land on exactly what Blender shows. Leaving the
          // Reinhard curve in is what turned bright deserts/ice into dull gray.
          const src = child.geometry.attributes.color as THREE.BufferAttribute;
          const out = new Float32Array(src.count * 3);
          for (let i = 0; i < src.count; i++) {
            const t3 = [src.getX(i), src.getY(i), src.getZ(i)];
            for (let c = 0; c < 3; c++) {
              const t = Math.min(t3[c], 0.9999);
              out[i * 3 + c] = Math.min(t / (1 - t), 1);
            }
          }
          child.geometry.setAttribute('color', new THREE.BufferAttribute(out, 3));
          child.material = new THREE.MeshBasicMaterial({ vertexColors: true });
        }
      });
      gltf.scene.scale.setScalar(SPHERE_RADIUS);
      gltf.scene.rotation.x = MESH_AXIS_CORRECTION;
      globeGroup.remove(placeholder);
      placeholderGeometry.dispose();
      placeholderMaterial.dispose();
      globeGroup.add(gltf.scene);
      loadedMesh = gltf.scene;
    });

    // Clouds, trees and every country label, all in one glTF exported
    // straight from the real GlobeRoot hierarchy in Blender — see the
    // top-of-file comment for why labels are read from this instead of
    // computed. Same SPHERE_RADIUS scale and MESH_AXIS_CORRECTION as
    // Earth above, since this came out of an identical export call on
    // siblings of the same Earth object (same scene, same transform).
    const TREE_COLORS: Record<string, number> = {
      Tree0: 0x2b7519,
      Tree1: 0x0a4710,
      Tree2: 0x0d381e,
    };
    let loadedExtras: THREE.Object3D | null = null;
    // Blender's own label materials: "NameWhite" is a plain white Emission
    // (strength 1.4, i.e. clamped pure white), and each label has three
    // slightly-offset soft-shadow copies ("NameShadow0/1/2") — a Transparent/
    // Emission mix of a near-black navy (0, 0.02, 0.05) at 27.5% / 16.5% /
    // 9.9% opacity. Reproduced exactly here rather than approximated.
    const LABEL_SHADOW_OPACITY = [0.275, 0.165, 0.099];
    // Per-country group (text + its 3 shadows) pivoting around the label's own
    // center, so a hover "pop" scales it in place rather than around the globe.
    const labelPivots: Record<string, THREE.Group> = {};
    gltfLoader.load('/globe_combined.glb', (gltf) => {
      gltf.scene.scale.setScalar(SPHERE_RADIUS);
      gltf.scene.rotation.x = MESH_AXIS_CORRECTION;
      // Compute this *before* adding to globeGroup — with no parent yet,
      // updateMatrixWorld() resolves each child's "world" matrix using
      // only the scale/rotation just set above, which is exactly the
      // globeGroup-local frame markerBase needs (globeGroup itself only
      // ever gets the live drag rotation applied, nothing else).
      gltf.scene.updateMatrixWorld(true);

      const countryKeys = new Set<string>();
      gltf.scene.traverse((child) => {
        if (/^Name_[a-z]+$/.test(child.name)) countryKeys.add(child.name);
      });

      const centers: Record<string, THREE.Vector3> = {};
      countryKeys.forEach((key) => {
        const textNode = gltf.scene.getObjectByName(key) as THREE.Mesh;
        const center = new THREE.Box3().setFromObject(textNode).getCenter(new THREE.Vector3());
        centers[key] = center;
        // Re-pivot: shift each of the 4 meshes' own vertices so (0,0,0) is the
        // label's center, and park them under a group sitting at that center.
        const local = center.clone().divideScalar(SPHERE_RADIUS);
        const pivot = new THREE.Group();
        pivot.position.copy(local);
        const parts = [key, `${key}_shadow0`, `${key}_shadow1`, `${key}_shadow2`];
        parts.forEach((partName, idx) => {
          const mesh = gltf.scene.getObjectByName(partName) as THREE.Mesh | undefined;
          if (!mesh) return;
          mesh.geometry.translate(-local.x, -local.y, -local.z);
          if (idx === 0) {
            mesh.material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
            mesh.renderOrder = 3;
          } else {
            mesh.material = new THREE.MeshBasicMaterial({
              color: new THREE.Color(0, 0.02, 0.05),
              transparent: true,
              opacity: LABEL_SHADOW_OPACITY[idx - 1],
              depthWrite: false,
              side: THREE.DoubleSide,
            });
            mesh.renderOrder = 2;
          }
          gltf.scene.remove(mesh);
          pivot.add(mesh);
        });
        gltf.scene.add(pivot);
        labelPivots[key] = pivot;
      });

      bowlItems.forEach((item) => {
        if (!item.origin) return;
        const key = nameKeyFor(item.origin.country);
        if (centers[key]) {
          markerBase[item.id] = centers[key];
        } else {
          // eslint-disable-next-line no-console
          console.warn(`No Name_<country> label found in globe_combined.glb for "${item.origin.country}" — falling back to computed lat/long, which has a history of being subtly wrong.`);
          markerBase[item.id] = latLongToVector3(item.origin.lat, item.origin.long, SPHERE_RADIUS + 0.015);
        }
      });

      gltf.scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        if (child.name === 'Clouds') {
          applyColorTexture(child, '/globe_clouds.png', true);
        } else if (child.name.startsWith('Trees')) {
          const prevName = (child.material as THREE.Material)?.name ?? '';
          const color = TREE_COLORS[prevName] ?? TREE_COLORS[child.name] ?? 0x1e5c22;
          child.material = new THREE.MeshBasicMaterial({ color });
        }
      });

      globeGroup.add(gltf.scene);
      loadedExtras = gltf.scene;
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

        if (item.origin) {
          const pivot = labelPivots[nameKeyFor(item.origin.country)];
          if (pivot) pivot.scale.setScalar(nextHover);
        }

        // The visible label is the real 3D text in the scene; this DOM element
        // is only the invisible tap/hover target pinned over it.
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
      dracoLoader.dispose();
      placeholderGeometry.dispose();
      placeholderMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      [loadedMesh, loadedExtras].forEach((obj) => {
        if (!obj) return;
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            const mat = child.material as THREE.MeshBasicMaterial;
            mat?.map?.dispose();
            mat?.dispose();
          }
        });
      });
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
  // Invisible on purpose: the real label (Blender's own text geometry, font
  // and soft shadow) is drawn inside the 3D scene. This text only exists to
  // give the tap/hover target a sensible footprint and an accessible name.
  countryLabel: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: 'transparent',
    fontFamily: fonts.body,
    letterSpacing: 0.3,
  },
};
