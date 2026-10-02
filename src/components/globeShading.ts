// Live shading for the homepage globe — reproduces the user's Blender EEVEE
// scene (Untitled23.blend) instead of showing a frozen, pre-lit image of it.
//
// Why this exists: the earlier versions baked Blender's lighting INTO the
// texture, which is only right for the one orientation it was baked at. As
// soon as you spun the globe, the highlight, the shadowed side and the pole
// (Antarctica looked dull gray) travelled with the land instead of staying
// where Blender's lights are. Here the unlit color ("albedo") is separate
// from the lighting, and the lighting is evaluated live against the same
// fixed lights/camera as in Blender, so a rotating globe behaves like it does
// in the .blend file.
//
// Everything below was measured from the real scene, not tuned by eye:
//  * albedo / roughness / cloud alpha: rendered from the globe's center as six
//    90-degree "cube faces" (public/globe_cube/*), so there is no UV seam and
//    no pole pinching at all.
//  * sun: strength 3 W/m2, direction from the .blend (diffuse = 3/pi * N.L).
//  * fill light: the real 4x4 square area light (120 W) integrated over a 4x4
//    sample grid, scale fitted against an EEVEE render with only that light on.
//  * world light: the scene's 0.55 warm (1.0, 0.95, 0.86) uniform ambient.
//  * Blender's Principled shader also dims diffuse by what the specular layer
//    reflects (Fresnel) — measured against view angle for ocean (glossy) and
//    land (rough) and reproduced as Fd().
//  * specular (the sun glint + sheen): looked up from a table built from EEVEE
//    renders of the same scene at three roughness levels, indexed by surface
//    normal (octahedral map), because for a sphere under fixed lights/camera the
//    highlight is purely a function of the normal.
// Validated against EEVEE renders of the same camera: see the commit message.
import * as THREE from 'three';

const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
// Each cube face was rendered with a field of view slightly wider than 90 degrees
// so bilinear filtering at face edges samples real neighbouring data.
const CUBE_PAD = 1.02;

export interface GlobeAssets {
  albedo: THREE.DataArrayTexture;
  rough: THREE.DataArrayTexture;
  cloudAlpha: THREE.DataArrayTexture;
  specLut: THREE.DataArrayTexture;
  // Fine surface relief (the scene's two Bump nodes, incl. the real relief of
  // the mesh) as cube faces. Optional: it's the heaviest asset, so it loads
  // after everything else and the globe shows without it until it arrives.
  normals: Promise<THREE.DataArrayTexture>;
}

async function decodeBitmap(url: string): Promise<ImageData> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const data = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close?.();
  return data;
}

async function loadFaceArray(
  prefix: string,
  ext: string,
  channels: 4 | 1,
  anisotropy: number,
  srgb: boolean,
  suffix = ''
): Promise<THREE.DataArrayTexture> {
  const faces = await Promise.all(FACES.map((f) => decodeBitmap(`/globe_cube/${prefix}_${f}${suffix}.${ext}`)));
  const w = faces[0].width;
  const h = faces[0].height;
  const layer = w * h * channels;
  const data = new Uint8Array(layer * FACES.length);
  faces.forEach((img, i) => {
    if (channels === 4) {
      data.set(img.data, i * layer);
    } else {
      const src = img.data;
      const dst = i * layer;
      for (let p = 0, q = 0; p < src.length; p += 4, q++) data[dst + q] = src[p];
    }
  });
  const tex = new THREE.DataArrayTexture(data, w, h, FACES.length);
  tex.format = channels === 4 ? THREE.RGBAFormat : THREE.RedFormat;
  tex.type = THREE.UnsignedByteType;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = anisotropy;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

async function loadSpecLut(): Promise<THREE.DataArrayTexture> {
  const buf = await (await fetch('/globe_cube/spec_lut.f16')).arrayBuffer();
  const data = new Uint16Array(buf); // raw IEEE half-float bits, 3 layers x 256 x 256 x RGBA
  const tex = new THREE.DataArrayTexture(data, 256, 256, 3);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.HalfFloatType;
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// One sun shadow map is shared by every material. GlobeExplorer fills it in each
// frame; with no map (unsupported device) nothing is darkened and everything
// is just unshadowed, as before.
export const shadowUniforms = {
  uShadowMap: { value: null as THREE.Texture | null },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowTexel: { value: new THREE.Vector2(1 / 2048, 1 / 2048) },
  uShadowDepthRange: { value: 6 },
};

let assetsCache: Promise<GlobeAssets> | null = null;

// Decoding the six-face textures is the expensive part; do it once per page
// and share the result if the globe re-mounts (e.g. on a window resize).
export function loadGlobeAssets(anisotropy: number): Promise<GlobeAssets> {
  if (!assetsCache) {
    assetsCache = loadGlobeAssetsUncached(anisotropy).catch((err) => {
      assetsCache = null;
      throw err;
    });
  }
  return assetsCache;
}

async function loadGlobeAssetsUncached(anisotropy: number): Promise<GlobeAssets> {
  // Phones / low-memory devices get the smaller face sets (1024 px albedo,
  // 512 px cloud alpha): six 1536 px RGBA faces plus mipmaps is ~100 MB of GPU
  // memory, which is too much for some mobile browsers.
  const nav = navigator as Navigator & { deviceMemory?: number };
  const small =
    Math.min(window.screen?.width ?? 1024, window.screen?.height ?? 1024) < 700 ||
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 4);
  const suffix = small ? '_s' : '';
  const [albedo, rough, cloudAlpha, specLut] = await Promise.all([
    loadFaceArray('albedo', 'jpg', 4, anisotropy, true, suffix),
    loadFaceArray('rough', 'png', 1, 1, false),
    loadFaceArray('cloudalpha', 'jpg', 1, anisotropy, false, suffix),
    loadSpecLut(),
  ]);
  const normals = loadFaceArray('nbump', 'jpg', 4, anisotropy, false);
  normals.catch(() => undefined);
  return { albedo, rough, cloudAlpha, specLut, normals };
}

// ---------------------------------------------------------------------------
// Shader source
// ---------------------------------------------------------------------------
// All lighting math is done in Blender's own world axes (Z up, camera on -Y), so
// the constants below are copied straight out of the .blend. toB() converts from
// the glTF/three axes the meshes were exported in: g = (bx, bz, -by).
const COMMON_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vObjDirB;
  varying vec3 vMX;
  varying vec3 vMY;
  varying vec3 vMZ;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vMX = modelMatrix[0].xyz;
    vMY = modelMatrix[1].xyz;
    vMZ = modelMatrix[2].xyz;
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vObjDirB = vec3(position.x, -position.z, position.y);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const COMMON_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler2DArray;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vObjDirB;
  varying vec3 vMX;
  varying vec3 vMY;
  varying vec3 vMZ;

  uniform sampler2DArray uSpecLut;
  uniform float uInvScale;     // 1 / scene scale, so distances match Blender's units

  // Sun shadow map (see GlobeExplorer): depth of the trees and the wildlife as
  // seen from the sun. Only the Earth surface receives it (uShadowOn).
  uniform sampler2D uShadowMap;
  uniform mat4 uShadowMatrix;       // world -> sun clip space
  uniform vec2 uShadowTexel;        // 1 / map size
  uniform float uShadowDepthRange;  // far - near, in world units
  uniform float uShadowOn;

  const float PI = 3.14159265358979;
  const float CUBE_PAD = ${CUBE_PAD.toFixed(2)};

  // Blender world <- three/glTF world
  vec3 toB(vec3 g) { return vec3(g.x, -g.z, g.y); }

  // GlobeSun: strength 3, light arrives FROM this direction (Blender axes).
  const vec3 LS = vec3(0.599087, -0.519564, 0.609219);
  const float SUN_K = 3.0 / PI;
  // GlobeFill: 4 x 4 square area light, 120 W, centred here; LX/LY span the
  // square, LZ is the direction it is facing away from (emits toward -LZ).
  const vec3 LC = vec3(-3.0, -3.0, 1.5);
  const vec3 LX = vec3(0.696707, -0.717356, 0.0);
  const vec3 LY = vec3(0.259940, 0.252457, 0.932039);
  const vec3 LZ = vec3(-0.668604, -0.649358, 0.362358);
  const float FILL_K = 0.737;
  // World lighting: 0.55 x warm white.
  const vec3 WORLD = vec3(0.55, 0.5225, 0.473);
  // The scene camera (Blender axes).
  const float ROUGH_OCEAN = 0.138;
  const float ROUGH_LAND = 0.72;

  float fillIrradiance(vec3 p, vec3 n) {
    float acc = 0.0;
    for (int i = 0; i < 4; i++) {
      for (int j = 0; j < 4; j++) {
        vec3 q = LC + 4.0 * ((float(i) + 0.5) / 4.0 - 0.5) * LX + 4.0 * ((float(j) + 0.5) / 4.0 - 0.5) * LY;
        vec3 d = q - p;
        float d2 = dot(d, d);
        vec3 l = d * inversesqrt(d2);
        acc += max(dot(n, l), 0.0) * max(dot(l, LZ), 0.0) / d2;
      }
    }
    return acc; // (sum / 16 samples) * 16 m2 area
  }

  vec2 octEncode(vec3 n) {
    n /= (abs(n.x) + abs(n.y) + abs(n.z));
    vec2 e = n.xy;
    if (n.z < 0.0) {
      e = (1.0 - abs(e.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
    }
    return e * 0.5 + 0.5;
  }

  // Specular (sun glint + fill sheen + world Fresnel) for this normal, at the
  // given roughness, interpolated between the three measured tables.
  vec3 specular(vec3 nB, float rough) {
    vec2 uv = octEncode(nB);
    float rr = clamp(rough, ROUGH_OCEAN, ROUGH_LAND);
    vec3 a = texture(uSpecLut, vec3(uv, 0.0)).rgb;
    vec3 b = texture(uSpecLut, vec3(uv, 1.0)).rgb;
    vec3 c = texture(uSpecLut, vec3(uv, 2.0)).rgb;
    float t1 = clamp((rr - ROUGH_OCEAN) / (0.43 - ROUGH_OCEAN), 0.0, 1.0);
    float t2 = clamp((rr - 0.43) / (ROUGH_LAND - 0.43), 0.0, 1.0);
    return rr < 0.43 ? mix(a, b, t1) : mix(b, c, t2);
  }

  // Fraction of the sun that reaches pW (1 = fully lit): percentage-closer
  // filtering over a small kernel, with a bias that scales with how obliquely the
  // sun grazes the surface.
  float sunVisibility(vec3 pW, vec3 nW) {
    vec3 lW = vec3(LS.x, LS.z, -LS.y);                       // sun direction in world axes
    float nl = clamp(dot(nW, lW), 0.0, 1.0);
    vec4 sp = uShadowMatrix * vec4(pW + nW * 0.004, 1.0);
    vec3 sc = sp.xyz / sp.w * 0.5 + 0.5;
    if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0) return 1.0;
    float bias = (0.004 + 0.012 * (1.0 - nl)) / uShadowDepthRange;
    float lit = 0.0;
    for (int i = -2; i <= 2; i++) {
      for (int j = -2; j <= 2; j++) {
        float d = texture2D(uShadowMap, sc.xy + vec2(float(i), float(j)) * uShadowTexel).r;
        lit += (sc.z - bias <= d) ? 1.0 : 0.0;
      }
    }
    return lit / 25.0;
  }

  // Principled BSDF as set up in the scene: diffuse lit by sun + fill + world,
  // dimmed by what the specular layer reflects, plus the specular term.
  vec3 shade(vec3 albedo, float rough, vec3 pW, vec3 nW) {
    vec3 pB = toB(pW) * uInvScale;
    vec3 nB = normalize(toB(nW));
    vec3 vB = normalize(toB(cameraPosition) * uInvScale - pB);
    float nv = clamp(dot(nB, vB), 0.0, 1.0);
    float t = clamp((rough - ROUGH_OCEAN) / (ROUGH_LAND - ROUGH_OCEAN), 0.0, 1.0);
    float Fo = 0.034 + 0.966 * pow(1.0 - nv, 5.0);
    float Fl = 0.059 + 0.058 * (1.0 - nv) * (1.0 - nv);
    float A = 1.0 - mix(Fo, Fl, t);
    float sun = SUN_K * max(dot(nB, LS), 0.0);
    if (uShadowOn > 0.5) sun *= sunVisibility(pW, nW);
    float fill = FILL_K * fillIrradiance(pB, nB);
    float ao = mix(0.97, 0.90, t);
    vec3 diffuse = A * (vec3(sun + fill) + ao * WORLD);
    return albedo * diffuse + specular(nB, rough);
  }

  // Which cube face a direction falls on, and where on it. Gradients are
  // derived from the (continuous) direction so mip selection has no seam.
  void cubeLookup(vec3 d, out float layer, out vec2 uv, out vec2 dUVdx, out vec2 dUVdy) {
    vec3 a = abs(d);
    vec3 f; vec3 r; vec3 u;
    if (a.x >= a.y && a.x >= a.z) {
      if (d.x > 0.0) { f = vec3(1.0, 0.0, 0.0);  r = vec3(0.0, -1.0, 0.0); u = vec3(0.0, 0.0, 1.0); layer = 0.0; }
      else           { f = vec3(-1.0, 0.0, 0.0); r = vec3(0.0, 1.0, 0.0);  u = vec3(0.0, 0.0, 1.0); layer = 1.0; }
    } else if (a.y >= a.z) {
      if (d.y > 0.0) { f = vec3(0.0, 1.0, 0.0);  r = vec3(1.0, 0.0, 0.0);  u = vec3(0.0, 0.0, 1.0); layer = 2.0; }
      else           { f = vec3(0.0, -1.0, 0.0); r = vec3(-1.0, 0.0, 0.0); u = vec3(0.0, 0.0, 1.0); layer = 3.0; }
    } else {
      if (d.z > 0.0) { f = vec3(0.0, 0.0, 1.0);  r = vec3(-1.0, 0.0, 0.0); u = vec3(0.0, 1.0, 0.0); layer = 4.0; }
      else           { f = vec3(0.0, 0.0, -1.0); r = vec3(1.0, 0.0, 0.0);  u = vec3(0.0, 1.0, 0.0); layer = 5.0; }
    }
    float w = dot(d, f);
    vec2 s = vec2(dot(d, r), dot(d, u));
    // Image row 0 is the TOP of the render (= +up), so v runs downward.
    uv = vec2(0.5 + 0.5 * s.x / w / CUBE_PAD, 0.5 - 0.5 * s.y / w / CUBE_PAD);
    vec3 dx = dFdx(d);
    vec3 dy = dFdy(d);
    vec2 sdx = vec2(dot(dx, r), dot(dx, u));
    vec2 sdy = vec2(dot(dy, r), dot(dy, u));
    float k = 0.5 / CUBE_PAD;
    dUVdx = k * vec2(sdx.x / w - s.x * dot(dx, f) / (w * w), -(sdx.y / w - s.y * dot(dx, f) / (w * w)));
    dUVdy = k * vec2(sdy.x / w - s.x * dot(dy, f) / (w * w), -(sdy.y / w - s.y * dot(dy, f) / (w * w)));
  }
`;

const EARTH_FRAG = /* glsl */ `
  ${COMMON_FRAG}
  uniform sampler2DArray uAlbedo;
  uniform sampler2DArray uRough;
  uniform sampler2DArray uNormals;
  uniform float uBump;   // 1 once the relief-normal faces have loaded
  void main() {
    vec3 d = normalize(vObjDirB);
    float layer; vec2 uv; vec2 dx; vec2 dy;
    cubeLookup(d, layer, uv, dx, dy);
    vec3 albedo = textureGrad(uAlbedo, vec3(uv, layer), dx, dy).rgb;
    float rough = textureGrad(uRough, vec3(uv, layer), dx, dy).r;
    vec3 nW = normalize(vWorldNormal);
    if (uBump > 0.5) {
      // Rendered from inside the globe, where Blender flips the shading normal
      // to face the viewer — so negate to get the outward one. It is in
      // Blender's axes; convert to the mesh's (g = (bx, bz, -by)) and rotate
      // into the world with the mesh's current orientation.
      vec3 nin = textureGrad(uNormals, vec3(uv, layer), dx, dy).rgb * 2.0 - 1.0;
      vec3 nb = -normalize(nin);
      vec3 g = vec3(nb.x, nb.z, -nb.y);
      nW = normalize(vMX * g.x + vMY * g.y + vMZ * g.z);
    }
    vec3 col = shade(albedo, rough, vWorldPos, nW);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const TREE_FRAG = /* glsl */ `
  ${COMMON_FRAG}
  uniform vec3 uAlbedoLinear;
  void main() {
    vec3 col = shade(uAlbedoLinear, 0.85, vWorldPos, normalize(vWorldNormal));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// CloudMat: white, roughness 1, emission 0.15, alpha from procedural noise
// (rendered to the alpha cube; the ramp tops out at 0.55).
const CLOUD_FRAG = /* glsl */ `
  ${COMMON_FRAG}
  uniform sampler2DArray uCloudAlpha;
  uniform float uCloudRot;   // radians about Blender Z: (angle the pattern was captured at) - (angle now)
  void main() {
    vec3 d = normalize(vObjDirB);
    // The scene animates the Clouds object's Z rotation, which carries its
    // object-space noise pattern around the globe. The cube holds the pattern
    // as captured at its final angle, so drifting it is a rotated lookup.
    float cs = cos(uCloudRot);
    float sn = sin(uCloudRot);
    d = vec3(cs * d.x - sn * d.y, sn * d.x + cs * d.y, d.z);
    float layer; vec2 uv; vec2 dx; vec2 dy;
    cubeLookup(d, layer, uv, dx, dy);
    float a = 0.55 * textureGrad(uCloudAlpha, vec3(uv, layer), dx, dy).r;
    // The cloud shell is a sphere slightly larger than the globe, so beyond the
    // globe's edge you see it edge-on as wispy arcs floating in space. Fine on
    // Blender's cream backdrop, but against black it reads as a fuzzy, dirty
    // outline. Keep every cloud over the globe (including those right at its
    // rim) and fade out only what hangs past the silhouette.
    vec3 camB = toB(cameraPosition) * uInvScale;
    vec3 rayB = normalize(toB(vWorldPos) * uInvScale - camB);
    float closest = length(camB + rayB * dot(-camB, rayB));   // ray's nearest approach to the center
    a *= 1.0 - smoothstep(1.005, 1.03, closest);
    vec3 n = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 col = shade(vec3(1.0), 1.0, vWorldPos, n) + vec3(0.15);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

export function makeEarthMaterial(assets: GlobeAssets, invScale: number): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    vertexShader: COMMON_VERT,
    fragmentShader: EARTH_FRAG,
    uniforms: {
      uAlbedo: { value: assets.albedo },
      uRough: { value: assets.rough },
      uSpecLut: { value: assets.specLut },
      uInvScale: { value: invScale },
      // Placeholder until the real faces arrive (never sampled while uBump = 0).
      uNormals: { value: assets.albedo },
      uBump: { value: 0 },
      ...shadowUniforms,
      uShadowOn: { value: 1 }, // the Earth surface is what trees and animals cast shadows onto
    },
  });
  assets.normals
    .then((tex) => {
      material.uniforms.uNormals.value = tex;
      material.uniforms.uBump.value = 1;
    })
    .catch(() => undefined);
  return material;
}

export function makeTreeMaterial(
  assets: GlobeAssets,
  invScale: number,
  linearRGB: [number, number, number]
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: COMMON_VERT,
    fragmentShader: TREE_FRAG,
    uniforms: {
      uAlbedoLinear: { value: new THREE.Vector3(...linearRGB) },
      uSpecLut: { value: assets.specLut },
      uInvScale: { value: invScale },
      ...shadowUniforms,
      uShadowOn: { value: 1 }, // trees shade each other and themselves, as in Blender
    },
  });
}

export function makeCloudMaterial(assets: GlobeAssets, invScale: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: COMMON_VERT,
    fragmentShader: CLOUD_FRAG,
    uniforms: {
      uCloudAlpha: { value: assets.cloudAlpha },
      uCloudRot: { value: 0 },
      uSpecLut: { value: assets.specLut },
      uInvScale: { value: invScale },
      ...shadowUniforms,
      uShadowOn: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------------------
// Wildlife (birds, whales) and the atmosphere shell
// ---------------------------------------------------------------------------
// Every animal is a plain Principled material in the scene (base color +
// roughness), so it is lit with the same live sun / fill / world as the Earth.
// They are drawn as instanced meshes — see globeLife.ts.
const LIFE_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vObjDirB;
  varying vec3 vMX;
  varying vec3 vMY;
  varying vec3 vMZ;
  void main() {
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = modelMatrix * instanceMatrix;
    #endif
    vec4 wp = m * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(m) * normal);
    vObjDirB = vec3(0.0);
    vMX = vec3(0.0);
    vMY = vec3(0.0);
    vMZ = vec3(0.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const LIFE_FRAG = /* glsl */ `
  ${COMMON_FRAG}
  uniform vec3 uAlbedoLinear;
  uniform float uRough;
  void main() {
    // Thin wing meshes are seen from both sides; like Blender, shade the face
    // that is turned toward the viewer.
    vec3 n = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 col = shade(uAlbedoLinear, uRough, vWorldPos, n);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function makeLifeMaterial(
  assets: GlobeAssets,
  invScale: number,
  linearRGB: [number, number, number],
  roughness: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: LIFE_VERT,
    fragmentShader: LIFE_FRAG,
    uniforms: {
      uAlbedoLinear: { value: new THREE.Vector3(...linearRGB) },
      uRough: { value: roughness },
      uSpecLut: { value: assets.specLut },
      uInvScale: { value: invScale },
      ...shadowUniforms,
      uShadowOn: { value: 0 },
    },
    side: THREE.DoubleSide,
  });
}

// NL_atmosphere: a shell 6.17% larger than the globe, Emission (0.25, 0.55, 1.0)
// x 2.5 mixed with Transparent by  clamp(Fresnel(IOR 1.9)^2.4 x 1.2)  — so it is
// invisible face-on and a pale cyan glow toward the edge. Back faces culled.
const ATMOSPHERE_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const ATMOSPHERE_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  uniform vec3 uEmission;   // color x strength, linear
  uniform float uIor;
  uniform float uPower;
  uniform float uMult;

  // Blender's dielectric Fresnel (unpolarised), as used by the Fresnel node.
  float fresnelDielectric(float cosi, float eta) {
    float c = abs(cosi);
    float g = eta * eta - 1.0 + c * c;
    if (g <= 0.0) return 1.0;
    g = sqrt(g);
    float A = (g - c) / (g + c);
    float B = (c * (g + c) - 1.0) / (c * (g - c) + 1.0);
    return 0.5 * A * A * (1.0 + B * B);
  }

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 v = normalize(cameraPosition - vWorldPos);
    float f = clamp(pow(fresnelDielectric(dot(n, v), uIor), uPower) * uMult, 0.0, 1.0);
    gl_FragColor = vec4(uEmission, f);
    #include <colorspace_fragment>
  }
`;

export function makeAtmosphereMaterial(a: {
  color: number[];
  strength: number;
  ior: number;
  power: number;
  mult: number;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: ATMOSPHERE_VERT,
    fragmentShader: ATMOSPHERE_FRAG,
    uniforms: {
      uEmission: { value: new THREE.Vector3(a.color[0] * a.strength, a.color[1] * a.strength, a.color[2] * a.strength) },
      uIor: { value: a.ior },
      uPower: { value: a.power },
      uMult: { value: a.mult },
    },
    transparent: true,
    depthWrite: false,
  });
}
