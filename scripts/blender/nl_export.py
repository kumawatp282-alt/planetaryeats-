"""Export the globe's wildlife (the NL_* objects) from the Blender scene for the website.

Run (writes public/globe_life/nl_data.json + nl_meshes.glb, and self-checks that the
math the site uses reproduces Blender's own world matrices - look for "MAX MATRIX ERROR"
being ~1e-6):

    /Applications/Blender.app/Contents/MacOS/Blender --background ~/Downloads/Untitled23.blend \
        --python scripts/blender/nl_export.py

See src/components/globeLife.ts for how the site plays it back.
"""
import bpy, json, re, math, os, sys
from mathutils import Matrix, Euler, Vector
OUT = os.environ.get("GLOBE_LIFE_OUT", "/Users/prashant/Downloads/planetary-eats/app-build/public/globe_life")
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
atm = bpy.data.objects['NL_Atmosphere']
objs = [o for o in bpy.data.objects if o.name.startswith('NL_') and o != atm]
byname = {o.name: o for o in objs}

# ---- order parent-first
order = []
seen = set()
def visit(o):
    if o.name in seen: return
    if o.parent and o.parent.name in byname: visit(o.parent)
    seen.add(o.name); order.append(o)
for o in sorted(objs, key=lambda o: o.name): visit(o)
index = {o.name: i for i, o in enumerate(order)}

# ---- unique meshes actually used (stable order)
mesh_names = []
for o in order:
    if o.type == 'MESH' and o.data.name not in mesh_names: mesh_names.append(o.data.name)
mesh_index = {n: i for i, n in enumerate(mesh_names)}

# ---- driver parsing:  value = r*frame + c + a*sin(w*frame + p)
num = r'[-+]?\d*\.?\d+(?:e[-+]?\d+)?'
def parse(expr):
    e = expr.replace(' ', '')
    m = re.fullmatch(rf'frame\*({num})', e)
    if m: return dict(r=float(m[1]), c=0.0, a=0.0, w=0.0, p=0.0)
    m = re.fullmatch(rf'({num})\*sin\(frame\*({num})\+({num})\)', e)
    if m: return dict(r=0.0, c=0.0, a=float(m[1]), w=float(m[2]), p=float(m[3]))
    m = re.fullmatch(rf'(-?)\(({num})\+({num})\*sin\(frame\*({num})\+({num})\)\)', e)
    if m:
        s = -1.0 if m[1] == '-' else 1.0
        return dict(r=0.0, c=s*float(m[2]), a=s*float(m[3]), w=float(m[4]), p=float(m[5]))
    raise ValueError("unparsed driver: " + expr)
def drv_eval(d, f): return d['r']*f + d['c'] + d['a']*math.sin(d['w']*f + d['p'])

nodes = []
for o in order:
    drivers = []
    if o.animation_data:
        for f in o.animation_data.drivers:
            assert f.data_path == 'rotation_euler', f.data_path
            d = parse(f.driver.expression); d['i'] = f.array_index
            drivers.append(d)
    nodes.append(dict(
        n=o.name,
        p=index[o.parent.name] if (o.parent and o.parent.name in index) else -1,
        t=[round(x, 6) for x in o.location],
        e=[round(x, 6) for x in o.rotation_euler],
        s=[round(x, 6) for x in o.scale],
        m=mesh_index[o.data.name] if o.type == 'MESH' else -1,
        d=drivers))

# ---- materials
def principled(m):
    bs = [x for x in m.node_tree.nodes if x.type == 'BSDF_PRINCIPLED'][0]
    c = bs.inputs['Base Color'].default_value
    return dict(c=[round(c[0], 5), round(c[1], 5), round(c[2], 5)], r=round(bs.inputs['Roughness'].default_value, 4))
mats = {}
for n in mesh_names:
    for m in bpy.data.meshes[n].materials:
        if m and m.name not in mats: mats[m.name] = principled(m)

# ---- atmosphere
nt = bpy.data.materials['NL_atmosphere'].node_tree
em = nt.nodes['Emission']; fr = nt.nodes['Fresnel']
pw = nt.nodes['Math'].inputs[1].default_value; mu = nt.nodes['Math.001'].inputs[1].default_value
atmosphere = dict(scale=round(atm.scale[0], 6), color=[round(x, 5) for x in em.inputs['Color'].default_value[:3]], strength=em.inputs['Strength'].default_value,
                  ior=fr.inputs['IOR'].default_value, power=pw, mult=mu)

# mix shader input order check
mix = nt.nodes['Mix Shader']
print("MIX in1 from", mix.inputs[1].links[0].from_node.name, "in2 from", mix.inputs[2].links[0].from_node.name)

# ---- cloud animation
ca = bpy.data.objects['Clouds'].animation_data.action
kf = []
for layer in ca.layers:
    for strip in layer.strips:
        for cb in strip.channelbags:
            for fc in cb.fcurves:
                if fc.data_path == 'rotation_euler' and fc.array_index == 2:
                    kf = [(k.co[0], k.co[1], k.interpolation, tuple(k.handle_left), tuple(k.handle_right), k.handle_left_type, k.handle_right_type) for k in fc.keyframe_points]
print("CLOUD KEYS", kf)

data = dict(fps=sc.render.fps, nodes=nodes, meshes=mesh_names, materials=mats, atmosphere=atmosphere)
json.dump(data, open(os.path.join(OUT, 'nl_data.json'), 'w'), separators=(',', ':'))
print("nodes", len(nodes), "meshes", len(mesh_names), "materials", len(mats), "json bytes", os.path.getsize(os.path.join(OUT, 'nl_data.json')))

# ---- numeric self-check: Python mirror vs Blender's own evaluation at several frames
def local(n, f):
    e = list(n['e'])
    for d in n['d']: e[d['i']] = drv_eval(d, f)
    return Matrix.LocRotScale(Vector(n['t']), Euler(e, 'XYZ'), Vector(n['s']))
def worlds(f):
    W = [None]*len(nodes)
    for i, n in enumerate(nodes):
        L = local(n, f)
        W[i] = (W[n['p']] @ L) if n['p'] >= 0 else L
    return W
worst = 0.0
for f in (1, 77, 307, 650, 901):
    sc.frame_set(f)
    W = worlds(f)
    for i, n in enumerate(nodes):
        ref = order[i].matrix_world
        # NL_Life's parent chain (GlobeRoot/SpinRoot) is identity
        err = max(abs(W[i][r][c] - ref[r][c]) for r in range(4) for c in range(4))
        worst = max(worst, err)
print("MAX MATRIX ERROR vs Blender over 5 frames:", worst)

# ---- unique-mesh GLB (identity transforms), exported in glTF Y-up
tmp_col = bpy.data.collections.new("TMP_NL_EXPORT"); sc.collection.children.link(tmp_col)
tmp_objs = []
for n in mesh_names:
    o = bpy.data.objects.new(n, bpy.data.meshes[n]); tmp_col.objects.link(o); tmp_objs.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in tmp_objs: o.select_set(True)
bpy.context.view_layer.objects.active = tmp_objs[0]
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'nl_meshes.glb'), export_format='GLB', use_selection=True,
                          export_apply=False, export_materials='EXPORT', export_cameras=False, export_lights=False, export_animations=False,
                          export_texcoords=False, export_normals=True, export_yup=True)
print("GLB bytes", os.path.getsize(os.path.join(OUT, 'nl_meshes.glb')))
