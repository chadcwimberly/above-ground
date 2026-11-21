"""Build Above Ground's logo assets from the sandstone worry-stone image.

Usage: python3 scripts/make-logo.py assets/logo-source.png .   (then `npm run assets`)
Writes assets/ (inputs for `npm run assets`) and public/ web icons.
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.morphology import convex_hull_image

src, repo = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float64) / 255
H, W, _ = im.shape
yy, xx = np.mgrid[0:H, 0:W] / max(H, W)

# 1. Model the cream backdrop as a smooth quadratic field fitted to the outer ring.
ring = np.zeros((H, W), bool)
m = int(0.06 * H)
ring[:m, :] = ring[-m:, :] = ring[:, :m] = ring[:, -m:] = True
A = np.stack([np.ones_like(xx), xx, yy, xx * yy, xx**2, yy**2], -1)
bg = np.zeros_like(im)
for c in range(3):
    coef, *_ = np.linalg.lstsq(A[ring], im[..., c][ring], rcond=None)
    bg[..., c] = A @ coef
BG_RGB = tuple(int(round(v * 255)) for v in np.median(im[ring], axis=0))

# 2. Stone mask: the stone is far more saturated than the backdrop or its shadow (>0.6 vs <0.57),
#    and the pebble is convex, so take the convex hull of the saturated pixels.
mx, mn = im.max(-1), im.min(-1)
sat = (mx - mn) / np.maximum(mx, 1e-6)
seed = ndimage.binary_opening(sat > 0.62, iterations=2)
lab, n = ndimage.label(seed)
sizes = ndimage.sum(seed, lab, range(1, n + 1))
seed = lab == (1 + int(np.argmax(sizes)))
stone = convex_hull_image(seed)
stone = ndimage.binary_erosion(stone, iterations=1)
# Soft edge: 1.2px feather.
dist_in = ndimage.distance_transform_edt(stone)
dist_out = ndimage.distance_transform_edt(~stone)
soft = np.clip(0.5 + (dist_in - dist_out) / 2.4, 0, 1)

# 3. Shadow: how much darker than the backdrop each outside pixel is.
ratio = np.clip(im / np.maximum(bg, 1e-6), 0, 1).mean(-1)
shadow = np.clip(1 - ratio, 0, 1)
shadow = np.where(shadow < 0.012, 0, shadow)  # drop paper noise
shadow = ndimage.gaussian_filter(shadow, 1.0)
SHADOW_RGB = np.array([0.10, 0.06, 0.03])  # near-black warm tone: reads as shadow on light and dark backdrops

alpha = np.maximum(soft, shadow * (1 - soft))
a_safe = np.maximum(alpha, 1e-6)[..., None]
# Unmix the stone's own colour at the feathered edge.
stone_rgb = np.clip((im - (1 - soft[..., None]) * bg) / np.maximum(soft[..., None], 1e-6), 0, 1)
stone_rgb = np.where(soft[..., None] > 0.02, stone_rgb, 0)
rgb = (soft[..., None] * stone_rgb + (shadow * (1 - soft))[..., None] * SHADOW_RGB) / a_safe
cut = Image.fromarray((np.dstack([np.clip(rgb, 0, 1), alpha]) * 255).round().astype(np.uint8), "RGBA")
# Stone only, no shadow (for favicons, where a shadow just blurs the edge at 16-32px).
flat = Image.fromarray((np.dstack([stone_rgb, soft]) * 255).round().astype(np.uint8), "RGBA")

# Tight boxes (stone only, and stone + visible shadow).
ys, xs = np.where(soft > 0.5)
stone_box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
ys2, xs2 = np.where(alpha > 0.03)
full_box = (xs2.min(), ys2.min(), xs2.max() + 1, ys2.max() + 1)
print("backdrop", "#%02x%02x%02x" % BG_RGB, "stone box", stone_box, "with shadow", full_box)


def place(canvas, stone_frac, bg=None, shadow=True):
    """Put the cut-out on a square canvas so the stone is stone_frac of the width, stone centred."""
    out = Image.new("RGBA", (canvas, canvas), (*bg, 255) if bg else (0, 0, 0, 0))
    sw = stone_box[2] - stone_box[0]
    s = canvas * stone_frac / sw
    crop = (cut if shadow else flat).crop(full_box)
    crop = crop.resize((round(crop.width * s), round(crop.height * s)), Image.LANCZOS)
    cx = (stone_box[0] + stone_box[2]) / 2 - full_box[0]
    cy = (stone_box[1] + stone_box[3]) / 2 - full_box[1]
    out.alpha_composite(crop, (round(canvas / 2 - cx * s), round(canvas / 2 - cy * s)))
    return out


def square_original(size):
    return Image.open(src).convert("RGBA").resize((size, size), Image.LANCZOS)


CREAM = BG_RGB
TAN = (0xD8, 0xC6, 0xB2)  # the app's theme / splash colour
assets, public = os.path.join(repo, "assets"), os.path.join(repo, "public")

# Native inputs for @capacitor/assets.
place(1024, 0.72, CREAM).save(os.path.join(assets, "icon-only.png"))
place(1024, 0.76).save(os.path.join(assets, "icon-foreground.png"))  # the adaptive icon XML insets this layer 16.7%, so this canvas is the visible area
Image.new("RGBA", (1024, 1024), (*CREAM, 255)).save(os.path.join(assets, "icon-background.png"))
for name in ("splash.png", "splash-dark.png"):
    place(2732, 0.30, TAN).save(os.path.join(assets, name))

# Web icons.
place(512, 0.72, CREAM).convert("RGB").save(os.path.join(public, "icon-512.png"), optimize=True)
place(192, 0.72, CREAM).convert("RGB").save(os.path.join(public, "icon-192.png"), optimize=True)
place(512, 0.64, CREAM).convert("RGB").save(os.path.join(public, "icon-maskable-512.png"), optimize=True)
place(180, 0.74, CREAM).convert("RGB").save(os.path.join(public, "apple-touch-icon.png"), optimize=True)
# Favicons: transparent, stone fills the frame so it reads at tab size.
fav = place(256, 0.98, shadow=False)
fav.resize((32, 32), Image.LANCZOS).save(os.path.join(public, "favicon-32.png"), optimize=True)
fav.save(os.path.join(public, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

