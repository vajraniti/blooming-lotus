"""Photo prep for the site, the way assets/img/ was made.

  python3 prep_photos.py gray      <in> <out.jpg> [--contrast 1.08] [--size 1200]
  python3 prep_photos.py selective <in> <out.jpg>
  python3 prep_photos.py poster    <in> <out.png> [--px 256]

gray       grayscale with a little extra contrast; the CSS filter on .relic adds the rest.
selective  grayscale except saturated magenta/crimson, which keeps its colour
           (hue > .88 or < .02, saturation > .55, value > .35).
poster     square, three tones (0 / 128 / 255): the source for the ECB demo, where
           large flat areas make the repeated blocks visible. Also prints how many
           8-byte blocks are unique; ECB shows the picture only when that number is low.

Needs Pillow.
"""
import argparse
import colorsys

from PIL import Image, ImageEnhance

JPEG = dict(quality=84, optimize=True, progressive=True)


def gray(src, dst, contrast=1.08, size=None):
    im = Image.open(src).convert('L')
    im = ImageEnhance.Contrast(im).enhance(contrast)
    if size:
        im.thumbnail((size, size), Image.LANCZOS)
    im.save(dst, **JPEG)
    print(dst, im.size)


def selective(src, dst):
    im = Image.open(src).convert('RGB')
    px = im.load()
    w, h = im.size
    out = Image.new('RGB', im.size)
    po = out.load()
    kept = 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if ss > 0.55 and vv > 0.35 and (hh > 0.88 or hh < 0.02):
                po[x, y] = (r, g, b)
                kept += 1
            else:
                lum = int(0.299 * r + 0.587 * g + 0.114 * b)
                po[x, y] = (lum, lum, lum)
    out.save(dst, **JPEG)
    print(dst, im.size, f'kept colour in {kept} px')


def poster(src, dst, px=256):
    a = Image.open(src).convert('L').resize((px, px), Image.LANCZOS)
    a = a.point(lambda v: 0 if v < 70 else (255 if v > 170 else 128))
    a.save(dst)
    data = a.tobytes()
    blocks = [data[i:i + 8] for i in range(0, len(data), 8)]
    print(dst, a.size, f'unique blocks {len(set(blocks))} of {len(blocks)}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    g = sub.add_parser('gray')
    g.add_argument('src'); g.add_argument('dst')
    g.add_argument('--contrast', type=float, default=1.08)
    g.add_argument('--size', type=int)
    s = sub.add_parser('selective')
    s.add_argument('src'); s.add_argument('dst')
    p = sub.add_parser('poster')
    p.add_argument('src'); p.add_argument('dst')
    p.add_argument('--px', type=int, default=256)
    a = ap.parse_args()
    if a.cmd == 'gray':
        gray(a.src, a.dst, a.contrast, a.size)
    elif a.cmd == 'selective':
        selective(a.src, a.dst)
    else:
        poster(a.src, a.dst, a.px)


if __name__ == '__main__':
    main()
