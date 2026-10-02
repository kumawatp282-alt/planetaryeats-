// The scene's wildlife — birds and whales (the NL_* objects in Untitled23.blend) —
// reproduced live.
//
// public/globe_life/nl_data.json holds the scene graph exactly as it is in
// Blender: for every object its parent, local location / rotation / scale, and
// the scene's drivers (the flock orbits, the wing flaps, the whale tails) as
// the formulas Blender evaluates, value = r*frame + c + a*sin(w*frame + p).
// public/globe_life/nl_meshes.glb holds the 62 distinct meshes. About 1,400
// objects share those meshes, so each mesh is drawn once as an instanced mesh
// and every frame we only recompute the transforms — which is cheap.
//
// Everything is evaluated in Blender's own axes (Z up) and converted to the
// scene's Y-up axes at the very end, so the math is a line-for-line copy of what
// Blender does (checked against Blender's own world matrices to 2e-6).
import * as THREE from 'three';
// eslint-disable-next-line import/no-unresolved
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GlobeAssets, makeLifeMaterial } from './globeShading';

interface Driver {
  i: number; // which rotation_euler channel
  r: number;
  c: number;
  a: number;
  w: number;
  p: number;
}

interface NodeData {
  n: string;
  p: number; // parent index, -1 for the root
  t: number[];
  e: number[];
  s: number[];
  m: number; // mesh index, -1 for an empty
  d: Driver[];
}

interface LifeData {
  fps: number;
  nodes: NodeData[];
  meshes: string[];
  materials: Record<string, { c: number[]; r: number }>;
}

export interface Life {
  group: THREE.Group;
  fps: number;
  update(frame: number): void;
  dispose(): void;
}

// Blender (x, y, z) -> three (x, z, -y), and back.
const B2T = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);
const T2B = B2T.clone().transpose();

// How much of the scene's wildlife the page shows, and how it behaves. The scene
// has ~270 birds and 23 whales; on the page that was a lot of distracting dark
// shapes, so the page keeps a sparse, smaller selection of them, and none whose
// flight path would cross over a country's name.
const BIRD_SCALE = 0.5; // bird size relative to the scene's
const KEEP_EVERY_BIRD = 3; // keep 1 bird in 3 (of those not crossing a name)
const KEEP_EVERY_WHALE = 2; // keep 1 whale in 2
const NAME_CLEARANCE = 0.24; // radians (~14 degrees) a flight path must stay clear of every country name

export async function loadLife(
  loader: GLTFLoader,
  assets: GlobeAssets,
  invScale: number,
  sphereRadius: number,
  nameDirections: THREE.Vector3[] // unit vectors to each country name, in the globe's own (scene) axes
): Promise<Life> {
  const [data, gltf] = await Promise.all([
    fetch('/globe_life/nl_data.json').then((r) => r.json() as Promise<LifeData>),
    loader.loadAsync('/globe_life/nl_meshes.glb'),
  ]);

  // Geometry parts (one per material) for each distinct mesh, by mesh name.
  const parts: Record<string, { geometry: THREE.BufferGeometry; material: string }[]> = {};
  gltf.scene.children.forEach((node) => {
    const list: { geometry: THREE.BufferGeometry; material: string }[] = [];
    node.traverse((o) => {
      if (o instanceof THREE.Mesh) list.push({ geometry: o.geometry, material: (o.material as THREE.Material).name });
    });
    parts[node.name] = list;
  });

  const group = new THREE.Group();
  group.scale.setScalar(sphereRadius);

  const materialCache: Record<string, THREE.ShaderMaterial> = {};
  const materialFor = (name: string) => {
    if (!materialCache[name]) {
      const m = data.materials[name];
      materialCache[name] = makeLifeMaterial(assets, invScale, [m.c[0], m.c[1], m.c[2]], m.r);
    }
    return materialCache[name];
  };

  const { nodes } = data;
  const count = nodes.length;
  const meshName = (n: NodeData) => (n.m >= 0 ? data.meshes[n.m] : '');
  const isBird = (n: NodeData) => meshName(n).startsWith('NL_bird_');
  const isWhale = (n: NodeData) => meshName(n) === 'NL_whale';

  // ---- Static local matrices (everything without a driver) -------------------------
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'ZYX'); // Blender's "XYZ" euler = Rz * Ry * Rx
  const staticLocal: (THREE.Matrix4 | null)[] = nodes.map((n) => {
    if (n.d.length) return null;
    euler.set(n.e[0], n.e[1], n.e[2], 'ZYX');
    scl.fromArray(n.s);
    if (isBird(n)) scl.multiplyScalar(BIRD_SCALE); // smaller birds (wings are children, so they follow)
    return new THREE.Matrix4().compose(pos.fromArray(n.t), quat.setFromEuler(euler), scl);
  });
  const world: THREE.Matrix4[] = nodes.map(() => new THREE.Matrix4());
  const local = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();

  // `active[i]` = this node is drawn. Starts all-true so the selection below can
  // measure every flight path; then thinned.
  const active: boolean[] = new Array(count).fill(true);

  function computeWorlds(frame: number) {
    for (let i = 0; i < count; i++) {
      if (!active[i]) continue;
      const n = nodes[i];
      let L = staticLocal[i];
      if (!L) {
        const ang = [n.e[0], n.e[1], n.e[2]];
        for (let k = 0; k < n.d.length; k++) {
          const d = n.d[k];
          ang[d.i] = d.r * frame + d.c + d.a * Math.sin(d.w * frame + d.p);
        }
        euler.set(ang[0], ang[1], ang[2], 'ZYX');
        scl.fromArray(n.s);
        L = local.compose(pos.fromArray(n.t), quat.setFromEuler(euler), scl);
      }
      if (n.p < 0) world[i].copy(L);
      else world[i].multiplyMatrices(world[n.p], L);
    }
  }

  // ---- Choose which animals the page shows --------------------------------------------
  // A flock flies a small circle about its pivot's axis (the spin driver turns about
  // the pivot's Z). A bird at angle `alpha` from that axis therefore stays at
  // `alpha` for ever, so a name at angle `theta` from the same axis is crossed
  // whenever |theta - alpha| is small. Drop any animal whose circle passes within
  // NAME_CLEARANCE of a name, then keep a sparse share of the rest.
  computeWorlds(0);
  const blenderDirs = nameDirections.map((d) => new THREE.Vector3(d.x, -d.z, d.y).normalize()); // scene -> Blender axes
  const axisOf = new THREE.Vector3();
  const dirOf = new THREE.Vector3();
  let keptBirds = 0;
  let keptWhales = 0;
  for (let i = 0; i < count; i++) {
    const n = nodes[i];
    if (!(isBird(n) || isWhale(n))) continue;
    // the circle's axis = the nearest ancestor pivot's Z axis in the globe's frame
    let a = n.p;
    while (a >= 0 && !nodes[a].n.startsWith('NL_pivot_')) a = nodes[a].p;
    if (a < 0) continue;
    const e = world[a].elements;
    axisOf.set(e[8], e[9], e[10]).normalize();
    const we = world[i].elements;
    dirOf.set(we[12], we[13], we[14]).normalize();
    const alpha = Math.acos(Math.max(-1, Math.min(1, dirOf.dot(axisOf))));
    let crosses = false;
    for (const nameDir of blenderDirs) {
      const theta = Math.acos(Math.max(-1, Math.min(1, nameDir.dot(axisOf))));
      if (Math.abs(theta - alpha) < NAME_CLEARANCE) {
        crosses = true;
        break;
      }
    }
    let keep = !crosses;
    if (keep) {
      if (isBird(n)) keep = keptBirds++ % KEEP_EVERY_BIRD === 0;
      else keep = keptWhales++ % KEEP_EVERY_WHALE === 0;
    }
    if (!keep) active[i] = false;
  }
  // wings, tails and anything else hanging off a dropped body goes with it
  for (let i = 0; i < count; i++) {
    const p = nodes[i].p;
    if (p >= 0 && !active[p]) active[i] = false;
  }

  // ---- Instanced meshes for what is kept -------------------------------------------------
  const instancesPerMesh: number[] = new Array(data.meshes.length).fill(0);
  nodes.forEach((n, i) => {
    if (n.m >= 0 && active[i]) instancesPerMesh[n.m]++;
  });
  // One InstancedMesh per (mesh, material); a node's instance slot is shared by
  // all of its mesh's parts.
  const instanced: THREE.InstancedMesh[][] = data.meshes.map((name, mi) =>
    (parts[name] ?? []).map((part) => {
      const im = new THREE.InstancedMesh(part.geometry, materialFor(part.material), Math.max(1, instancesPerMesh[mi]));
      im.count = instancesPerMesh[mi];
      im.frustumCulled = false;
      im.layers.enable(1); // casts sun shadows (see GlobeExplorer)
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(im);
      return im;
    })
  );
  const slot: number[] = new Array(count).fill(-1);
  const next: number[] = new Array(data.meshes.length).fill(0);
  const meshNodes: number[] = [];
  nodes.forEach((n, i) => {
    if (n.m >= 0 && active[i]) {
      slot[i] = next[n.m]++;
      meshNodes.push(i);
    }
  });

  function update(frame: number) {
    computeWorlds(frame);
    for (let k = 0; k < meshNodes.length; k++) {
      const i = meshNodes[k];
      tmp.multiplyMatrices(B2T, world[i]).multiply(T2B);
      const list = instanced[nodes[i].m];
      for (let j = 0; j < list.length; j++) list[j].setMatrixAt(slot[i], tmp);
    }
    for (let m = 0; m < instanced.length; m++) {
      for (let j = 0; j < instanced[m].length; j++) instanced[m][j].instanceMatrix.needsUpdate = true;
    }
  }
  update(1);

  return {
    group,
    fps: data.fps,
    update,
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      Object.values(materialCache).forEach((m) => m.dispose());
    },
  };
}
