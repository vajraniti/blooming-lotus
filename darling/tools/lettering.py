"""Builds the IDEA wordmark: Cormorant Garamond Bold capitals dressed with
hand-placed thorns, a swash arc and a teardrop, in the spirit of neo-gothic
'stylized serif' lettering. Output: a single-path-per-part SVG."""
import math, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT = sys.argv[1]; OUT = sys.argv[2]
f = TTFont(FONT); gs = f.getGlyphSet(); cmap = f.getBestCmap()
B = 1000  # baseline y in svg units
CAP = 625

def glyph(ch, x):
    pen = SVGPathPen(gs)
    tp = TransformPen(pen, (1, 0, 0, -1, x, B))
    gs[cmap[ord(ch)]].draw(tp)
    return pen.getCommands(), gs[cmap[ord(ch)]].width

def v(a): return (math.cos(a), math.sin(a))
def add(p, q, s=1): return (p[0] + q[0] * s, p[1] + q[1] * s)

def qbez(p0, p1, p2, t):
    u = 1 - t
    return (u*u*p0[0] + 2*u*t*p1[0] + t*t*p2[0], u*u*p0[1] + 2*u*t*p1[1] + t*t*p2[1])

def cbez(p0, p1, p2, p3, t):
    u = 1 - t
    return tuple(u**3*p0[i] + 3*u*u*t*p1[i] + 3*u*t*t*p2[i] + t**3*p3[i] for i in range(2))

def stroke(center, width, n=48):
    """Outline of a variable-width stroke along center(t), width(t) full width."""
    pts = [center(i / n) for i in range(n + 1)]
    left, right = [], []
    for i, p in enumerate(pts):
        a = pts[max(i - 1, 0)]; b = pts[min(i + 1, n)]
        dx, dy = b[0] - a[0], b[1] - a[1]; d = math.hypot(dx, dy) or 1
        nx, ny = -dy / d, dx / d
        w = width(i / n) / 2
        left.append((p[0] + nx * w, p[1] + ny * w)); right.append((p[0] - nx * w, p[1] - ny * w))
    poly = left + right[::-1]
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in poly) + ' Z'

def thorn(p, angle_deg, length, base, bend_deg=0, power=1.6):
    a = math.radians(angle_deg); b = math.radians(angle_deg + bend_deg)
    c1 = add(p, v(a), length * 0.55); c2 = add(p, v(b), length)
    c1 = add(c1, (0, 0)); 
    return stroke(lambda t: qbez(p, c1, c2, t), lambda t: base * (1 - t) ** power)

def swash(p0, p1, p2, p3, wmax, tip=0.0):
    return stroke(lambda t: cbez(p0, p1, p2, p3, t), lambda t: wmax * math.sin(math.pi * t) ** 0.9 + tip, n=120)

def tear(cx, cy, h, r):
    ty = cy - h / 2; by = cy + h / 2 - r
    return (f'M{cx:.1f} {ty:.1f} C{cx + r*0.15:.1f} {cy - h*0.12:.1f} {cx + r:.1f} {by - r*1.3:.1f} {cx + r:.1f} {by:.1f} '
            f'A{r:.1f} {r:.1f} 0 0 1 {cx - r:.1f} {by:.1f} '
            f'C{cx - r:.1f} {by - r*1.3:.1f} {cx - r*0.15:.1f} {cy - h*0.12:.1f} {cx:.1f} {ty:.1f} Z')

def star(cx, cy, r, k=0.18):
    pts = []
    for i in range(8):
        a = math.pi / 4 * i - math.pi / 2
        rr = r if i % 2 == 0 else r * k
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + ' Z'

parts = []
x = 0; track = 34
pos = {}
for ch in 'IDEA':
    d, w = glyph(ch, x); pos[ch] = x; parts.append(d); x += w + track
total = x - track
T = B - CAP  # cap top y
xI, xD, xE, xA = pos['I'], pos['D'], pos['E'], pos['A']

orn = []
def profile(wmax, lean=0.7, tip=1.2):
    # Calligraphic swell: heavy early, hairline at both ends.
    return lambda t: wmax * math.sin(math.pi * t ** lean) ** 1.1 + tip
# Great swash: born from the I's head, vaults over D and E, dies into the A's needle.
orn.append(stroke(lambda t: cbez((xI + 236, T + 6), (xI - 120, T - 300), (xE + 160, T - 480), (xA + 352, T - 70), t), profile(20), n=160))
# Teardrop hanging in the D's counter.
orn.append(tear(xD + 338, B - 300, 290, 60))
# I: blades flaring out of both serifs, tips turning away from the letter.
orn.append(thorn((xI + 50, T + 14), 182, 260, 26, 48))
orn.append(thorn((xI + 50, B - 12), 178, 260, 26, -48))
# D: a rose thorn on the bowl.
orn.append(thorn((xD + 650, B - 300), -18, 92, 30, -30))
# E: the middle arm grows a needle.
orn.append(thorn((xE + 405, B - 318), 2, 200, 20, -16))
# A: apex needle through the swash; the right foot sweeps out into a tail.
orn.append(thorn((xA + 358, T + 40), -90, 330, 28, 0, 2.4))
orn.append(thorn((xA + 702, B - 8), 6, 340, 30, 52))
# Stars.
orn.append(star(xA + 358, T - 320, 38))
orn.append(star(xI - 230, B + 150, 22))
orn.append(star(xE + 250, T - 480, 16))

pad = 260
vb = (-pad, T - 420, total + 2 * pad, CAP + 420 + 300)
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[0]} {vb[1]} {vb[2]} {vb[3]}" role="img" aria-label="IDEA">'
       f'<path fill="currentColor" d="{" ".join(parts)}"/>'
       f'<path fill="currentColor" d="{" ".join(orn)}"/></svg>')
open(OUT, 'w').write(svg)
print('viewBox', vb, 'bytes', len(svg))
