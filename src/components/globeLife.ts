// The scene's wildlife — birds and whales (the NL_* objects in Untitled23.blend)
// and the atmosphere shell — reproduced live.
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
import { GlobeAssets, makeAtmosphereMaterial, makeLifeMaterial } from './globeShading';

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
  atmosphere: { scale: number; color: number[]; strength: number; ior: number; power: number; mult: number };
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

export async function loadLife(
  loader: GLTFLoader,
  assets: GlobeAssets,
  invScale: number,
  sphereRadius: number
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
  const instancesPerMesh: number[] = new Array(data.meshes.length).fill(0);
  nodes.forEach((n) => {
    if (n.m >= 0) instancesPerMesh[n.m]++;
  });

  // One InstancedMesh per (mesh, material); a node's instance slot is shared by
  // all of its mesh's parts.
  const instanced: THREE.InstancedMesh[][] = data.meshes.map((name, mi) =>
    (parts[name] ?? []).map((part) => {
      const im = new THREE.InstancedMesh(part.geometry, materialFor(part.material), instancesPerMesh[mi]);
      im.frustumCulled = false;
      im.layers.enable(1); // casts sun shadows (see GlobeExplorer)
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(im);
      return im;
    })
  );

  const slot: number[] = new Array(count).fill(-1);
  const next: number[] = new Array(data.meshes.length).fill(0);
  nodes.forEach((n, i) => {
    if (n.m >= 0) slot[i] = next[n.m]++;
  });

  // Static local matrices for everything that has no driver.
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'ZYX'); // Blender's "XYZ" euler = Rz * Ry * Rx
  const staticLocal: (THREE.Matrix4 | null)[] = nodes.map((n) => {
    if (n.d.length) return null;
    euler.set(n.e[0], n.e[1], n.e[2], 'ZYX');
    return new THREE.Matrix4().compose(pos.fromArray(n.t), quat.setFromEuler(euler), scl.fromArray(n.s));
  });
  const world: THREE.Matrix4[] = nodes.map(() => new THREE.Matrix4());
  const local = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();
  const meshNodes: number[] = [];
  nodes.forEach((n, i) => {
    if (n.m >= 0) meshNodes.push(i);
  });

  // The atmosphere shell (NL_Atmosphere), drawn last so it veils everything.
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(data.atmosphere.scale, 128, 64),
    makeAtmosphereMaterial(data.atmosphere)
  );
  atmosphere.renderOrder = 10;
  group.add(atmosphere);

  function update(frame: number) {
    for (let i = 0; i < count; i++) {
      const n = nodes[i];
      let L = staticLocal[i];
      if (!L) {
        const e0 = n.e[0];
        const e1 = n.e[1];
        const e2 = n.e[2];
        const ang = [e0, e1, e2];
        for (let k = 0; k < n.d.length; k++) {
          const d = n.d[k];
          ang[d.i] = d.r * frame + d.c + d.a * Math.sin(d.w * frame + d.p);
        }
        euler.set(ang[0], ang[1], ang[2], 'ZYX');
        L = local.compose(pos.fromArray(n.t), quat.setFromEuler(euler), scl.fromArray(n.s));
      }
      if (n.p < 0) world[i].copy(L);
      else world[i].multiplyMatrices(world[n.p], L);
    }
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
      (atmosphere.material as THREE.Material).dispose();
    },
  };
}
