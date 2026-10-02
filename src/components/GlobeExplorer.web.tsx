// Real 3D Earth (web only) — the user's own Blender scene (Untitled23.blend),
// rendered live with three.js so it can be dragged freely on both axes, all the
// way to the poles. Nothing about it is approximated or hand-placed:
//
//  * Camera and lights are the .blend's own (GlobeCam: 50 mm lens, 3.74 m away,
//    8.45 degrees above the equator; GlobeSun; the GlobeFill area light; the
//    world's warm ambient). See globeShading.ts for how the shading reproduces
//    them live, so the highlight, the lit/shadowed side and the poles behave as
//    they do in Blender when the globe turns — instead of a lit picture that
//    just rotates along with the land (what the earlier baked versions did,
//    and why Antarctica looked gray and dull).
//  * Earth color, roughness and cloud alpha come from the scene's own
//    materials, rendered out from the globe's center as six cube faces
//    (public/globe_cube/*) — no UV seam, no pole pinching.
//  * Earth geometry (public/globe_earth.glb) is the real mesh with its real
//    relief; Trees, Clouds and every label are exported from the same
//    GlobeRoot hierarchy in public/globe_combined.glb, so they share one
//    transform by construction.
//  * Country labels are Blender's own text meshes — same font, plain white
//    emission, and the three soft NameShadow copies — not HTML text. A
//    transparent DOM element sits over each only to catch taps/hover.
//    Their positions are read off those meshes, never computed.
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
import { loadGlobeAssets, makeCloudMaterial, makeEarthMaterial, makeTreeMaterial, shadowUniforms } from './globeShading';
import { Life, loadLife } from './globeLife';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoImage = require('../assets/logo-stacked.png');

interface Props {
  items: MenuItem[]; // must have `origin` set
  onSelect: (item: MenuItem) => void;
  // Called whenever a bowl card opens or closes, so the screen around the globe can
  // get its own floating buttons out of the way of the card.
  onBowlOpenChange?: (open: boolean) => void;
}

// Scene scale: Blender units -> three units. Everything (meshes, camera) is
// scaled by this together, so proportions are exactly Blender's.
const SPHERE_RADIUS = 1.3;
// Blender's GlobeCam sits at (0, -3.7, 0.55) looking at the origin; in glTF
// axes (g = (bx, bz, -by)) that is (0, 0.55, 3.7). Its elevation above the
// equator (8.45 degrees) is what tilts the north pole slightly toward the viewer.
const CAMERA_B = { x: 0, y: 0.55, z: 3.7 };
const CAMERA_DISTANCE = Math.hypot(CAMERA_B.y, CAMERA_B.z);
// Field of view: keeps Blender's exact perspective (set by distance / radius)
// but lets the globe fill the canvas the way the page layout expects, with a
// few degrees of headroom so limb terrain is never clipped by the frustum.
const GLOBE_EXTENT = 1.02; // largest Earth radius incl. relief, in Blender units
const FILL_OF_FRAME = 0.87;
const CAMERA_FOV_DEG =
  ((2 * Math.asin(GLOBE_EXTENT / CAMERA_DISTANCE)) / FILL_OF_FRAME) * (180 / Math.PI);
// How far the globe can pitch before it stops — not a full 90° so it
// never quite flips past vertical (which reads as disorienting), but
// close enough that both poles are fully reachable by dragging.
const PITCH_LIMIT = 1.45;
// The Blender -> glTF export already is the standard Z-up -> Y-up rotation
// (checked by fitting the ten label centroids in both frames: exact to 1e-6),
// so no extra correction is applied to any layer.
const MESH_AXIS_CORRECTION = 0;

// The scene's timeline. Everything that moves (the flocks, wing beats, whale
// tails, the cloud drift) is a function of the frame number, exactly as in the
// .blend; the page just plays it in real time at the scene's frame rate,
// starting from frame 1. (The one exception is the clouds, which keep drifting.)
const CLOUD_DRIFT_END_FRAME = 240; // CloudsAction: keyed on frames 1 and 240
const CLOUD_DRIFT_RADIANS = 0.5235987901687622; // 30 degrees about the polar axis
// The cloud-alpha cube was captured with the clouds at the start of that drift
// (rotation 0), so the drifted pattern is a lookup rotated by the angle so far.
const CLOUD_CAPTURE_ANGLE = 0;
// After the keyed 30 degrees the clouds in Blender simply stop; on the page they keep
// drifting at a calm, steady pace, eased in from where the keyed motion ends so
// there is no jolt.
const CLOUD_CRUISE_RAD_PER_FRAME = 0.00145; // ~2.5 degrees a second at 30 fps
const CLOUD_EASE_FRAMES = 180;
function cloudAngle(frame: number): number {
  const t = Math.max(0, Math.min(1, (frame - 1) / (CLOUD_DRIFT_END_FRAME - 1)));
  // Blender's default Bezier ease (auto-clamped, flat handles at a third of the span).
  const keyed = CLOUD_DRIFT_RADIANS * (3 * t * t - 2 * t * t * t);
  const f = Math.max(0, frame - CLOUD_DRIFT_END_FRAME);
  const u = Math.min(1, f / CLOUD_EASE_FRAMES);
  // integral of a smoothstep speed ramp: speed 0 -> cruise over CLOUD_EASE_FRAMES
  const eased = CLOUD_EASE_FRAMES * (u * u * u - (u * u * u * u) / 2);
  const cruise = CLOUD_CRUISE_RAD_PER_FRAME * (f <= CLOUD_EASE_FRAMES ? eased : CLOUD_EASE_FRAMES * 0.5 + (f - CLOUD_EASE_FRAMES));
  return keyed + cruise;
}

// Country names that swing round to face the viewer pop out, so whichever name is
// in front is easy to read and tap, and ones near the edge stay small.
//  - every name facing roughly toward the viewer swells a little;
//  - the single front-most name (the one nearest the middle) swells a lot more, so
//    a cluster such as Germany / Italy / Greece never balloons into one blob;
//  - the size is a spring, so a name that arrives at the front overshoots slightly
//    and settles — a "pop" — rather than just sliding up.
const LABEL_FACING_BOOST = 0.3; // up to 1.3x for any name facing the viewer
const LABEL_LEADER_BOOST = 0.55; // up to ~1.85x for the one at the front
const LABEL_SPRING_STIFFNESS = 170;
const LABEL_SPRING_DAMPING = 14;
// Names are sized to fit their country in Blender, so the short ones (Italy, USA, Japan)
// are tiny. Every name is lifted to at least this width (Blender units) so each one is
// readable — the same lift applies when it pops.
const LABEL_MIN_WIDTH = 0.13;
const LABEL_MAX_LIFT = 1.9;
function smoothstep(lo: number, hi: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
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

export default function GlobeExplorer({ items, onSelect, onBowlOpenChange }: Props) {
  const [globeSize, setGlobeSize] = useState(320);
  const [logoHeight, setLogoHeight] = useState(84);
  const [activeBowlId, setActiveBowlId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const markerRefs = useRef<Record<string, View | null>>({});
  // Cursor-hover zoom on pins — read/written every frame in the imperative
  // animate() loop below, so this stays a ref (a pin popping shouldn't
  // trigger a React re-render 60x/sec).
  const hoveredIdRef = useRef<string | null>(null);
  const hoverScaleRef = useRef<Record<string, number>>({});
  // Per-label spring (size, velocity) for the pop when a name reaches the front.
  const popRef = useRef<Record<string, { x: number; v: number }>>({}); // keyed by label (Name_italy…)
  const stars = useStarfield(50);
  useTwinkleKeyframes();

  useEffect(() => {
    function updateSize() {
      setGlobeSize(Math.min(window.innerWidth * 0.95, window.innerHeight * 0.66, 760));
      // The logo scales with the window's height so the globe and the hint below
      // it always fit (stacked artwork is 800 x 419).
      setLogoHeight(Math.max(60, Math.min(96, (window.innerHeight - 48) * 0.12)));
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const bowlItems = items.filter((item) => item.origin);

  useEffect(() => {
    onBowlOpenChange?.(activeBowlId !== null);
  }, [activeBowlId, onBowlOpenChange]);
  useEffect(() => () => onBowlOpenChange?.(false), [onBowlOpenChange]);

  // Ways back to the globe from an open bowl card besides its X: the header logo
  // ("home"), the Escape key, and (below) a tap on any empty space.
  useEffect(() => {
    if (activeBowlId === null) return;
    const close = () => setActiveBowlId(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('planetary-eats:home', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('planetary-eats:home', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [activeBowlId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || globeSize < 10) return;

    const debug = typeof window !== 'undefined' && /globedebug/.test(window.location.search);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 100);
    camera.position.set(CAMERA_B.x, CAMERA_B.y, CAMERA_B.z).multiplyScalar(SPHERE_RADIUS);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: debug,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(globeSize, globeSize);

    // Blender composites in linear, unclamped light and only then applies its
    // "Standard" view transform (clamp + sRGB). The clouds in particular are
    // brighter than 1.0 in linear light (~1.44), so blending them over the
    // globe in an 8-bit sRGB framebuffer — which clamps each layer first and
    // blends the encoded values — visibly under-brightens them. So the scene
    // is drawn into a half-float linear target and converted in one final pass.
    // (Falls back to drawing straight to the canvas where float targets aren't
    // supported.)
    const hdrSupported =
      renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    const hdrTarget = hdrSupported
      ? new THREE.WebGLRenderTarget(4, 4, {
          type: THREE.HalfFloatType,
          format: THREE.RGBAFormat,
          samples: 4,
          depthBuffer: true,
        })
      : null;
    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const postMaterial = new THREE.ShaderMaterial({
      uniforms: { tMap: { value: hdrTarget ? hdrTarget.texture : null } },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D tMap;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tMap, vUv);
          // The target holds premultiplied light; Standard view transform =
          // clamp to [0,1] then sRGB, applied to the un-premultiplied color.
          vec3 straight = c.a > 0.0001 ? c.rgb / c.a : vec3(0.0);
          gl_FragColor = vec4(clamp(straight, 0.0, 1.0), 1.0);
          #include <colorspace_fragment>
          gl_FragColor = vec4(gl_FragColor.rgb * c.a, c.a);
        }
      `,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial));
    // Sun shadow map: the trees and the wildlife (layer 1) seen from the sun
    // (GlobeSun's direction, fixed in the world — it is the globe that turns),
    // as a plain depth image the Earth's shader looks up to find what is in
    // shade. Soft-filtered there, like Blender's.
    const SUN_WORLD = new THREE.Vector3(0.599087, 0.609219, 0.519564); // GlobeSun, in scene axes
    const SHADOW_NEAR = 3;
    const SHADOW_FAR = 9;
    const SHADOW_EXTENT = SPHERE_RADIUS * 1.32; // covers the globe plus its tallest relief and the animals
    const shadowSize = Math.min(window.screen?.width ?? 1024, window.screen?.height ?? 1024) < 700 ? 1024 : 2048;
    const shadowDepth = new THREE.DepthTexture(shadowSize, shadowSize);
    shadowDepth.type = THREE.UnsignedIntType;
    shadowDepth.minFilter = THREE.NearestFilter;
    shadowDepth.magFilter = THREE.NearestFilter;
    const shadowTarget = new THREE.WebGLRenderTarget(shadowSize, shadowSize, {
      depthTexture: shadowDepth,
      depthBuffer: true,
    });
    const shadowCamera = new THREE.OrthographicCamera(
      -SHADOW_EXTENT,
      SHADOW_EXTENT,
      SHADOW_EXTENT,
      -SHADOW_EXTENT,
      SHADOW_NEAR,
      SHADOW_FAR
    );
    shadowCamera.position.copy(SUN_WORLD).normalize().multiplyScalar(6);
    shadowCamera.lookAt(0, 0, 0);
    shadowCamera.layers.set(1);
    shadowCamera.updateMatrixWorld(true);
    shadowCamera.updateProjectionMatrix();
    shadowUniforms.uShadowMap.value = shadowDepth;
    shadowUniforms.uShadowMatrix.value.multiplyMatrices(shadowCamera.projectionMatrix, shadowCamera.matrixWorldInverse);
    shadowUniforms.uShadowTexel.value.set(1 / shadowSize, 1 / shadowSize);
    shadowUniforms.uShadowDepthRange.value = SHADOW_FAR - SHADOW_NEAR;
    const shadowMaterial = new THREE.MeshDepthMaterial({ side: THREE.DoubleSide });
    camera.layers.enable(1); // casters are on layer 1 as well as the default layer
    const renderShadows = () => {
      scene.overrideMaterial = shadowMaterial;
      renderer.setRenderTarget(shadowTarget);
      renderer.clear();
      renderer.render(scene, shadowCamera);
      scene.overrideMaterial = null;
      renderer.setRenderTarget(null);
    };

    const drawSize = new THREE.Vector2();
    const frame = () => {
      renderShadows();
      if (!hdrTarget) {
        renderer.render(scene, camera);
        return;
      }
      renderer.getDrawingBufferSize(drawSize);
      if (hdrTarget.width !== drawSize.x || hdrTarget.height !== drawSize.y) {
        hdrTarget.setSize(drawSize.x, drawSize.y);
      }
      renderer.setRenderTarget(hdrTarget);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    };

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

    const anisotropy = renderer.capabilities.getMaxAnisotropy();
    let disposed = false;
    // Cube-face albedo/roughness/cloud-alpha textures plus the specular table;
    // every layer's material is built from these once they have decoded.
    const assetsPromise = loadGlobeAssets(anisotropy);
    const INV_SCALE = 1 / SPHERE_RADIUS;

    // Trees, Clouds and Earth are Draco-compressed on export — needs the
    // matching decoder, served from public/draco/ rather than a CDN.
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    let loadedMesh: THREE.Object3D | null = null;

    // The real globe mesh, with its real relief and normals. Its color and
    // roughness are looked up per pixel from the cube faces by direction, and
    // lit live (see globeShading.ts) — so the geometry here carries no color.
    Promise.all([gltfLoader.loadAsync('/globe_earth.glb'), assetsPromise])
      .then(([gltf, assets]) => {
        if (disposed) return;
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = makeEarthMaterial(assets, INV_SCALE);
            child.layers.enable(1); // the terrain shades itself — the Himalayas now cast real shadows
          }
        });
        gltf.scene.scale.setScalar(SPHERE_RADIUS);
        gltf.scene.rotation.x = MESH_AXIS_CORRECTION;
        globeGroup.remove(placeholder);
        placeholderGeometry.dispose();
        placeholderMaterial.dispose();
        globeGroup.add(gltf.scene);
        loadedMesh = gltf.scene;
      })
      // eslint-disable-next-line no-console
      .catch((err) => console.error('Globe Earth failed to load', err));

    // Clouds, trees and every country label, all in one glTF exported
    // straight from the real GlobeRoot hierarchy in Blender — see the
    // top-of-file comment for why labels are read from this instead of
    // computed. Same SPHERE_RADIUS scale and MESH_AXIS_CORRECTION as
    // Earth above, since this came out of an identical export call on
    // siblings of the same Earth object (same scene, same transform).
    // Tree materials' base colors (linear), straight from the .blend.
    const TREE_ALBEDO: Record<string, [number, number, number]> = {
      Trees0: [0.17, 0.46, 0.1],
      Trees1: [0.04, 0.27, 0.06],
      Trees2: [0.05, 0.22, 0.12],
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
    const labelCenters: Record<string, THREE.Vector3> = {};
    const labelLift: Record<string, number> = {};
    // Where each country name sits on the globe, so the wildlife can steer clear of them.
    let resolveNameDirections: (dirs: THREE.Vector3[]) => void = () => undefined;
    const nameDirections = new Promise<THREE.Vector3[]>((resolve) => {
      resolveNameDirections = resolve;
    });
    let cloudMaterial: THREE.ShaderMaterial | null = null;
    let life: Life | null = null;
    Promise.all([gltfLoader.loadAsync('/globe_combined.glb'), assetsPromise])
      .then(([gltf, assets]) => {
        if (disposed) return;
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
          const box = new THREE.Box3().setFromObject(textNode);
          const center = box.getCenter(new THREE.Vector3());
          centers[key] = center;
          labelCenters[key] = center;
          const width = Math.max(...box.getSize(new THREE.Vector3()).toArray()) / SPHERE_RADIUS;
          labelLift[key] = Math.max(1, Math.min(LABEL_MAX_LIFT, LABEL_MIN_WIDTH / Math.max(width, 1e-3)));
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

        resolveNameDirections(Object.values(centers).map((c) => c.clone().normalize()));

        bowlItems.forEach((item) => {
          if (!item.origin) return;
          const key = nameKeyFor(item.origin.country);
          if (centers[key]) {
            markerBase[item.id] = centers[key];
          } else {
            // eslint-disable-next-line no-console
            console.warn(`No ${key} label mesh in globe_combined.glb for "${item.origin.country}" — add one in Blender and re-export; this item has no tap target on the globe until then.`);
          }
        });

        gltf.scene.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          if (child.name === 'Clouds') {
            cloudMaterial = makeCloudMaterial(assets, INV_SCALE);
            child.material = cloudMaterial;
            child.renderOrder = 1;
          } else if (child.name.startsWith('Trees')) {
            child.material = makeTreeMaterial(assets, INV_SCALE, TREE_ALBEDO[child.name] ?? [0.05, 0.25, 0.08]);
            child.layers.enable(1); // casts sun shadows
          }
        });

        globeGroup.add(gltf.scene);
        loadedExtras = gltf.scene;
      })
      // eslint-disable-next-line no-console
      .catch((err) => {
        resolveNameDirections([]);
        console.error('Globe layers failed to load', err);
      });

    // Birds, whales and the atmosphere shell (the scene's NL_* objects).
    Promise.all([assetsPromise, nameDirections])
      .then(([assets, names]) => loadLife(gltfLoader, assets, INV_SCALE, SPHERE_RADIUS, names))
      .then((loaded) => {
        if (disposed) {
          loaded.dispose();
          return;
        }
        life = loaded;
        globeGroup.add(loaded.group);
      })
      // eslint-disable-next-line no-console
      .catch((err) => console.error('Globe wildlife failed to load', err));

    // The globe starts exactly as Blender's GlobeCam frames it (rotY=0,
    // rotX=0) every time the page loads, and only moves if someone drags it
    // — free on both axes, so the poles are reachable, not just a left-right
    // spin.
    const state: {
      rotY: number;
      rotX: number;
      dragging: boolean;
      lastX: number;
      lastY: number;
      override: THREE.Quaternion | null;
      frame: number | null;
    } = { rotY: 0, rotX: 0, dragging: false, lastX: 0, lastY: 0, override: null, frame: null };
    if (debug) {
      // Test hook (?globedebug): lets a verification script set the pose and
      // read pixels back to compare against Blender renders of the same view.
      (window as any).__globe = {
        THREE,
        renderer,
        scene,
        camera,
        globeGroup,
        state,
        canvas,
        frame,
        getLife: () => life,
      };
    }

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
    const startedAt = performance.now();
    let lastLabelTick = startedAt;
    const animate = () => {
      // The scene's timeline: frame 1 at load, advancing at the scene's fps.
      // (?globedebug can pin it to a given frame for comparison renders.)
      const sceneFrame = state.frame ?? 1 + ((performance.now() - startedAt) / 1000) * (life?.fps ?? 30);
      life?.update(sceneFrame);
      if (cloudMaterial) {
        cloudMaterial.uniforms.uCloudRot.value = CLOUD_CAPTURE_ANGLE - cloudAngle(sceneFrame);
      }
      if (state.override) {
        globeGroup.quaternion.copy(state.override); // ?globedebug only
      } else {
        globeGroup.rotation.y = state.rotY;
        globeGroup.rotation.x = state.rotX;
      }
      globeGroup.updateMatrixWorld();

      const nowMs = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastLabelTick) / 1000));
      lastLabelTick = nowMs;
      // Every name, whether or not it has a bowl: how squarely it faces the camera
      // (1 = dead-on, 0 = on the limb), which one is at the front, and its size.
      const labelDir: Record<string, THREE.Vector3> = {};
      const labelDot: Record<string, number> = {};
      let leaderKey = '';
      let leaderDot = -1;
      Object.keys(labelPivots).forEach((key) => {
        const c = labelCenters[key];
        if (!c) return;
        const w = c.clone().applyMatrix4(globeGroup.matrixWorld);
        const dir = w.clone().normalize();
        const d = dir.dot(camera.position.clone().sub(w).normalize());
        labelDir[key] = dir;
        labelDot[key] = d;
        if (d > leaderDot) {
          leaderDot = d;
          leaderKey = key;
        }
      });
      const labelSize: Record<string, number> = {};
      Object.keys(labelPivots).forEach((key) => {
        const lift = labelLift[key] ?? 1;
        let emphasis = 1;
        // (a pinned ?globedebug pose is for like-for-like comparison with Blender renders, so no emphasis)
        if (!state.override && labelDir[key]) {
          const facingAmt = smoothstep(0.5, 0.9, labelDot[key]);
          // only the name at the front pops fully; its close neighbours (Germany / Italy /
          // Greece sit within ~10 degrees of each other) share a smaller swell
          const apart = Math.acos(Math.max(-1, Math.min(1, labelDir[key].dot(labelDir[leaderKey]))));
          const leads = 1 - smoothstep(0.07, 0.25, apart);
          // ...and names right beside the front one give way a little so they don't overlap it
          const yields = (1 - leads) * (1 - smoothstep(0.1, 0.3, apart));
          const target = (1 + LABEL_FACING_BOOST * facingAmt + LABEL_LEADER_BOOST * facingAmt * leads) * (1 - 0.25 * yields);
          const spring = popRef.current[key] ?? { x: 1, v: 0 };
          spring.v += (LABEL_SPRING_STIFFNESS * (target - spring.x) - LABEL_SPRING_DAMPING * spring.v) * dt;
          spring.x += spring.v * dt;
          popRef.current[key] = spring;
          emphasis = Math.max(0.9, spring.x);
        }
        labelSize[key] = emphasis * (state.override ? 1 : lift);
        labelPivots[key].scale.setScalar(labelSize[key]);
      });

      bowlItems.forEach((item) => {
        const base = markerBase[item.id];
        const el = markerRefs.current[item.id] as unknown as HTMLElement | null;
        if (!base || !el) return;
        const world = base.clone().applyMatrix4(globeGroup.matrixWorld);
        // How squarely this label faces the (elevated) Blender camera: 1 =
        // dead-on, 0 = on the limb, negative = on the far side.
        const faceDot = world.clone().normalize().dot(camera.position.clone().sub(world).normalize());
        const facing = faceDot > 0.05;
        const depth = Math.max(0, Math.min(1, faceDot));
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
        const key = item.origin ? nameKeyFor(item.origin.country) : '';
        const size = labelSize[key] ?? 1;

        const pivot = labelPivots[key];
        if (pivot) pivot.scale.setScalar(nextHover * size);

        // The visible label is the real 3D text in the scene; this DOM element
        // is only the invisible tap/hover target pinned over it.
        const scale = (0.75 + depth * 0.35) * nextHover * size;
        el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%) scale(${scale})`;
        el.style.opacity = String(opacity);
        el.style.pointerEvents = facing ? 'auto' : 'none';
        el.style.zIndex = String(Math.round(depth * 1000) + (hoveredIdRef.current === item.id ? 2000 : 0));
      });

      frame();
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      life?.dispose();
      shadowTarget.dispose();
      shadowDepth.dispose();
      shadowMaterial.dispose();
      shadowUniforms.uShadowMap.value = null;
      hdrTarget?.dispose();
      postMaterial.dispose();
      renderer.dispose();
      dracoLoader.dispose();
      disposed = true;
      placeholderGeometry.dispose();
      placeholderMaterial.dispose();
      // The cube/spec textures are shared across remounts (see
      // loadGlobeAssets), so only geometry and materials are released here.
      [loadedMesh, loadedExtras].forEach((obj) => {
        if (!obj) return;
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material)?.dispose();
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
        backgroundColor: colors.cream, // black — the globe's contrast
        overflow: activeBowlId ? 'visible' : 'hidden',
        position: 'relative',
      }}
    >
      {/* Open bowl card: a tap on any empty space (this backdrop) closes it. */}
      {activeBowlId !== null && (
        <Pressable
          accessibilityLabel="Close"
          onPress={() => setActiveBowlId(null)}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, cursor: 'default' } as any}
        />
      )}
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
            backgroundColor: colors.white,
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
            style={{ width: (logoHeight * 800) / 419, height: logoHeight }}
            resizeMode="contain"
            accessibilityLabel="Planetary Eats"
          />
          <Text style={[styles.tagline, { color: 'rgba(255,255,255,0.72)' }]}>
            Good for you. Good for the planet.
          </Text>
        </>
      )}

      {/* Everything below is confined to the globe's own footprint — the
          bowl pop-out replaces just this area, not the whole screen. */}
      <View pointerEvents="box-none" style={{ alignItems: 'center', position: 'relative' }}>
        <View
          // The (invisible) globe and its name targets must not catch taps or drags
          // while a bowl card is open.
          pointerEvents={activeBowlId ? 'none' : 'auto'}
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

        <Text style={[styles.hint, { color: 'rgba(255,255,255,0.6)' }, activeBowlId ? { opacity: 0 } : null]}>
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
  tagline: {
    fontSize: 15,
    color: colors.inkMuted,
    marginTop: 10,
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
