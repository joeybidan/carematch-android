"""Regenerate Android/web branding assets: python scripts/generate-branding.py.

Requires Python 3 and Pillow (python -m pip install Pillow).
Source images live in branding/; no Android Studio asset wizard is required.
"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / 'android/app/src/main/res'
WEB = ROOT / 'public/branding'
BACKGROUND = '#030a14'
WEB.mkdir(parents=True, exist_ok=True)

source = Image.open(ROOT / 'branding/carematch-icon.webp').convert('RGBA')
mark = source.crop(source.getbbox())

def foreground(size, fraction):
    canvas = Image.new('RGBA', (size, size))
    fitted = ImageOps.contain(mark, (round(size * fraction), round(size * fraction)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
    return canvas

def launcher(size):
    canvas = Image.new('RGBA', (size, size), BACKGROUND)
    canvas.alpha_composite(foreground(size, 0.72))
    return canvas

for density, scale in [('mdpi', 1), ('hdpi', 1.5), ('xhdpi', 2), ('xxhdpi', 3), ('xxxhdpi', 4)]:
    directory = RES / f'mipmap-{density}'
    directory.mkdir(parents=True, exist_ok=True)
    size = round(48 * scale)
    launcher(size).save(directory / 'ic_launcher.png', optimize=True)
    launcher(size).save(directory / 'ic_launcher_round.png', optimize=True)
    foreground(round(108 * scale), 0.56).save(directory / 'ic_launcher_foreground.png', optimize=True)

launcher(512).save(WEB / 'carematch-icon.png', optimize=True)
logo = Image.open(ROOT / 'branding/joey-bidan-studios.webp').convert('RGB')
logo.thumbnail((960, 960), Image.Resampling.LANCZOS)
logo.save(WEB / 'joey-bidan-studios.webp', quality=88, method=6)
print('Generated launcher resources for five densities, web icon and studio logo.')
