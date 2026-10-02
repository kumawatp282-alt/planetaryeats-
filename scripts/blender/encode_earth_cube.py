"""Turn the PNGs from bake_earth_cube.py into the files the site loads (public/globe_cube).

    python3 scripts/blender/encode_earth_cube.py /tmp/earth_new/cube public/globe_cube
"""
import os, sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
FACES = ["px", "nx", "py", "ny", "pz", "nz"]
for f in FACES:
    albedo = Image.open(f"{src}/albedo_{f}.png").convert("RGB")
    albedo.save(f"{dst}/albedo_{f}.jpg", quality=92, optimize=True, subsampling=0)
    albedo.resize((1024, 1024), Image.LANCZOS).save(f"{dst}/albedo_{f}_s.jpg", quality=90, optimize=True, subsampling=0)
    rough = Image.open(f"{src}/rough_{f}.png").convert("RGB").split()[0]
    rough.save(f"{dst}/rough_{f}.png", optimize=True)
    Image.open(f"{src}/nbump_{f}.png").convert("RGB").save(f"{dst}/nbump_{f}.jpg", quality=93, optimize=True, subsampling=0)
    print("encoded", f)
