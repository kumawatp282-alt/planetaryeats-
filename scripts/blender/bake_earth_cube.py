"""Bake the Earth's surface into the six-face cube textures the website samples by direction.

For each cube face a camera sits at the globe's centre looking outward (90 degrees plus a 2% pad so
bilinear filtering at face edges sees real neighbours) and renders the Earth material with its
Principled shader swapped for an Emission of one input:

    albedo   <- Base Color (what feeds Principled)           sRGB 8-bit        1536 px
    rough    <- Roughness                                    raw 8-bit            512 px
    nbump    <- the shading normal after both Bump nodes     raw, n*0.5+0.5      1024 px
                (seen from inside, Blender flips it toward the viewer; the site negates it back)

Face conventions (forward, right, up) match cubeLookup() in src/components/globeShading.ts.

    BAKE_OUT=/tmp/earth_new/cube /Applications/Blender.app/Contents/MacOS/Blender --background \
        ~/Downloads/Untitled23.blend --python scripts/blender/bake_earth_cube.py

Writes <kind>_<face>.png. scripts/blender/encode_earth_cube.py turns them into the site's files.
"""
import bpy, math, os
from mathutils import Matrix, Vector

OUT = os.environ.get("BAKE_OUT", "/tmp/earth_new/cube")
os.makedirs(OUT, exist_ok=True)
PAD = 1.02
FACES = {  # name: (forward, right, up)
    'px': ((1, 0, 0), (0, -1, 0), (0, 0, 1)),
    'nx': ((-1, 0, 0), (0, 1, 0), (0, 0, 1)),
    'py': ((0, 1, 0), (1, 0, 0), (0, 0, 1)),
    'ny': ((0, -1, 0), (-1, 0, 0), (0, 0, 1)),
    'pz': ((0, 0, 1), (-1, 0, 0), (0, 1, 0)),
    'nz': ((0, 0, -1), (1, 0, 0), (0, 1, 0)),
}
KINDS = [  # kind, resolution, source node, source socket, view transform
    ('albedo', 1536, 'Brightness/Contrast', 'Color', 'Standard'),
    ('rough', 512, 'Mix (Legacy).002', 'Color', 'Raw'),
    ('nbump', 1024, 'Bump.001', 'Normal', 'Raw'),
]

sc = bpy.context.scene
for o in bpy.data.objects:
    o.hide_render = (o.name != 'Earth')
sc.render.engine = 'BLENDER_EEVEE'
try:
    sc.eevee.taa_render_samples = 16
except Exception:
    pass
sc.render.film_transparent = False
sc.render.dither_intensity = 0.0
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'
sc.render.image_settings.color_depth = '8'
sc.view_settings.look = 'None'
sc.view_settings.exposure = 0.0
sc.view_settings.gamma = 1.0
sc.frame_set(1)

earth = bpy.data.objects['Earth']
src_mat = bpy.data.materials['EarthMat']


def emission_material(kind, node_name, socket_name):
    m = src_mat.copy()
    m.name = f"BAKE_{kind}"
    m.use_backface_culling = False
    nt = m.node_tree
    out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    for l in list(out.inputs['Surface'].links):
        nt.links.remove(l)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 1.0
    src = nt.nodes[node_name].outputs[socket_name]
    if kind == 'nbump':
        vm = nt.nodes.new('ShaderNodeVectorMath')
        vm.operation = 'MULTIPLY_ADD'
        vm.inputs[1].default_value = (0.5, 0.5, 0.5)
        vm.inputs[2].default_value = (0.5, 0.5, 0.5)
        nt.links.new(src, vm.inputs[0])
        nt.links.new(vm.outputs['Vector'], em.inputs['Color'])
    else:
        nt.links.new(src, em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m


cam_data = bpy.data.cameras.new("BakeCam")
cam_data.lens_unit = 'FOV'
cam_data.angle = 2 * math.atan(PAD)
cam_data.clip_start = 0.01
cam_data.clip_end = 10
cam = bpy.data.objects.new("BakeCam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam

for kind, res, node, sock, view in KINDS:
    sc.view_settings.view_transform = view
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    earth.data.materials.clear()
    earth.data.materials.append(emission_material(kind, node, sock))
    for name, (f, r, u) in FACES.items():
        R = Matrix(((r[0], u[0], -f[0]), (r[1], u[1], -f[1]), (r[2], u[2], -f[2])))  # camera X=right, Y=up, Z=-forward
        cam.matrix_world = R.to_4x4()
        sc.render.filepath = os.path.join(OUT, f"{kind}_{name}.png")
        bpy.ops.render.render(write_still=True)
        print("BAKED", kind, name, flush=True)
print("DONE", flush=True)
