"""Reference renders of the scene (EEVEE, transparent background, 1200 px, GlobeRoot posed) for
comparing the website against Blender pixel by pixel. Output: /tmp/globe_ref/ref_<name>.png.
The site side: open the page with ?globedebug=1, pin pose/frame via window.__globe
(state.override quaternion, state.frame), set camera fov 39.5978 and size 1200, then
renderer toDataURL.
"""
import bpy, math, time, sys
sc = bpy.context.scene
bpy.data.objects['GlobeWeb'].hide_render = True
sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x = 1200; sc.render.resolution_y = 1200; sc.render.resolution_percentage = 100
sc.render.film_transparent = True
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'; sc.render.image_settings.color_depth = '16'
root = bpy.data.objects['GlobeRoot']
CONFIGS = [  # name, frame, rx_deg, rz_deg
  ("rest_f307", 307, 0, 0),
  ("rest_f1",   1,   0, 0),
  ("asia_f100", 100, -20, 100),
  ("south_f307",307, -80, 0),
  ("north_f150",150, 70, 30),
]
for name, frame, rx, rz in CONFIGS:
    root.rotation_euler = (math.radians(rx), 0, math.radians(rz))
    sc.frame_set(frame)
    sc.render.filepath = f"/tmp/globe_ref/ref_{name}.png"
    t = time.time(); bpy.ops.render.render(write_still=True); print("RENDERED", name, round(time.time()-t,1), flush=True)
print("ALLDONE", flush=True)
