#!/usr/bin/env python3
"""Generate Boom app icons — cartoon comic-book explosion (no text)."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "images"

BLACK = (18, 12, 28)
BG_TOP = (45, 55, 140)
BG_BOTTOM = (22, 28, 78)
SKY_STAR = (255, 255, 255)
RED = (255, 55, 35)
ORANGE = (255, 130, 0)
AMBER = (255, 210, 0)
YELLOW = (255, 245, 80)
WHITE = (255, 255, 255)
PUFF = (240, 245, 255)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def lerp_color(c1: tuple[int, ...], c2: tuple[int, ...], t: float) -> tuple[int, int, int]:
    return tuple(int(lerp(c1[i], c2[i], t)) for i in range(3))  # type: ignore[return-value]


def radial_background(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size))
    px = img.load()
    cx = cy = size / 2
    max_r = size * 0.75
    for y in range(size):
        for x in range(size):
            d = min(math.hypot(x - cx, y - cy) / max_r, 1.0)
            px[x, y] = (*lerp_color(BG_TOP, BG_BOTTOM, d), 255)

    draw = ImageDraw.Draw(img)
    for fx, fy in [(0.12, 0.18), (0.82, 0.14), (0.88, 0.72), (0.15, 0.78), (0.5, 0.08), (0.72, 0.45)]:
        sx, sy = fx * size, fy * size
        r = max(2, size // 180)
        draw.ellipse((sx - r, sy - r, sx + r, sy + r), fill=(*SKY_STAR, 180))
    return img


def cartoon_star_points(
    cx: float,
    cy: float,
    inner_r: float,
    outer_r: float,
    spikes: int,
    wobble: float,
    rotation: float = 0.0,
) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    steps = spikes * 2
    for i in range(steps):
        angle = (2 * math.pi * i / steps) - math.pi / 2 + rotation
        is_outer = i % 2 == 0
        r = outer_r if is_outer else inner_r
        if is_outer:
            r *= 1 + wobble * math.sin(i * 1.73 + 0.4)
            r *= 1 + wobble * 0.35 * math.cos(i * 2.9)
        else:
            r *= 1 + wobble * 0.2 * math.sin(i * 3.1)
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    return points


def draw_outlined_polygon(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[float, float]],
    fill: tuple[int, int, int],
    stroke: int,
) -> None:
    stroke = max(2, stroke)
    for i in range(len(points)):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % len(points)]
        draw.line((x1, y1, x2, y2), fill=BLACK, width=stroke)
    draw.polygon(points, fill=fill, outline=BLACK)


def draw_outlined_ellipse(
    draw: ImageDraw.ImageDraw,
    bbox: tuple[float, float, float, float],
    fill: tuple[int, int, int],
    stroke: int,
) -> None:
    draw.ellipse(bbox, fill=fill, outline=BLACK, width=max(2, stroke))


def draw_cartoon_puff(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    scale: float,
    stroke: int,
) -> None:
    s = scale
    for ox, oy, r in [(0, 0, 42), (-38, 8, 30), (36, 10, 28), (-18, -28, 24), (22, -24, 22)]:
        rr = r * s
        x, y = cx + ox * s, cy + oy * s
        draw.ellipse((x - rr, y - rr, x + rr, y + rr), fill=PUFF, outline=BLACK, width=stroke)


def draw_cartoon_dot(
    draw: ImageDraw.ImageDraw,
    x: float,
    y: float,
    r: float,
    fill: tuple[int, int, int],
    stroke: int,
) -> None:
    draw.ellipse((x - r, y - r, x + r, y + r), fill=fill, outline=BLACK, width=stroke)


def draw_halftone(draw: ImageDraw.ImageDraw, cx: float, cy: float, radius: float, scale: float) -> None:
    step = 22 * scale
    dot_r = max(2, int(4 * scale))
    for gy in range(int(cy - radius), int(cy + radius), int(step)):
        for gx in range(int(cx - radius), int(cx + radius), int(step)):
            if math.hypot(gx - cx, gy - cy) < radius * 0.85:
                draw.ellipse(
                    (gx - dot_r, gy - dot_r, gx + dot_r, gy + dot_r),
                    fill=(255, 200, 60, 120),
                )


def draw_center_flash(draw: ImageDraw.ImageDraw, cx: float, cy: float, s: float, stroke: int) -> None:
    """Яркое ядро вместо текста — многослойная вспышка."""
    draw_outlined_ellipse(draw, (cx - 78 * s, cy - 78 * s, cx + 78 * s, cy + 78 * s), YELLOW, stroke)
    draw_outlined_ellipse(draw, (cx - 52 * s, cy - 52 * s, cx + 52 * s, cy + 52 * s), AMBER, max(3, stroke - 4))
    draw_outlined_ellipse(draw, (cx - 34 * s, cy - 34 * s, cx + 34 * s, cy + 34 * s), WHITE, max(3, int(12 * s)))

    # Маленькая 4-лучевая звезда в центре
    star_r = 18 * s
    star = []
    for i in range(8):
        angle = (2 * math.pi * i / 8) - math.pi / 2
        r = star_r if i % 2 == 0 else star_r * 0.38
        star.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    draw_outlined_polygon(draw, star, WHITE, max(3, int(8 * s)))


def draw_drop_shadow(size: int, cx: float, cy: float, scale: float) -> Image.Image:
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    s = scale
    shadow_pts = cartoon_star_points(cx + 18 * s, cy + 22 * s, 90 * s, 230 * s, 10, 0.18)
    draw.polygon(shadow_pts, fill=(0, 0, 0, 100))
    return layer.filter(ImageFilter.GaussianBlur(radius=max(3, int(14 * scale))))


def draw_explosion(size: int, cx: float, cy: float, scale: float = 1.0) -> Image.Image:
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    s = scale
    stroke = int(16 * s)

    shadow = draw_drop_shadow(size, cx, cy, s)
    layer = Image.alpha_composite(layer, shadow)
    draw = ImageDraw.Draw(layer)

    for px, py in [(-195, -120), (210, -95), (-175, 155), (185, 140), (-230, 30), (225, 15)]:
        draw_cartoon_puff(draw, cx + px * s, cy + py * s, 0.55 * s, max(3, int(8 * s)))

    halftone_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    halftone_draw = ImageDraw.Draw(halftone_layer)
    draw_halftone(halftone_draw, cx, cy, 155 * s, s)
    layer = Image.alpha_composite(layer, halftone_layer)
    draw = ImageDraw.Draw(layer)

    outer = cartoon_star_points(cx, cy, 92 * s, 270 * s, 9, wobble=0.3, rotation=0.1)
    draw_outlined_polygon(draw, outer, RED, stroke)

    mid = cartoon_star_points(cx, cy, 68 * s, 210 * s, 9, wobble=0.24, rotation=-0.06)
    draw_outlined_polygon(draw, mid, ORANGE, stroke)

    inner = cartoon_star_points(cx, cy, 44 * s, 150 * s, 8, wobble=0.18, rotation=0.04)
    draw_outlined_polygon(draw, inner, AMBER, stroke)

    draw_center_flash(draw, cx, cy, s, stroke)

    sparks = [
        (0.58, -1.02, 14, RED), (1.0, -0.2, 11, ORANGE), (0.72, 0.88, 12, AMBER),
        (-0.2, 1.05, 13, YELLOW), (-0.88, 0.55, 11, RED), (-1.0, -0.35, 10, ORANGE),
        (-0.45, -0.92, 9, WHITE), (0.28, -0.75, 8, WHITE), (0.92, 0.55, 9, YELLOW),
    ]
    for sx, sy, sr, color in sparks:
        draw_cartoon_dot(draw, cx + sx * 205 * s, cy + sy * 205 * s, sr * s, color, max(3, int(7 * s)))

    for angle_deg, length, width in [
        (-28, 315, 10), (18, 295, 9), (108, 275, 9), (198, 305, 10), (288, 280, 9),
    ]:
        rad = math.radians(angle_deg)
        x1 = cx + math.cos(rad) * 135 * s
        y1 = cy + math.sin(rad) * 135 * s
        x2 = cx + math.cos(rad) * length * s
        y2 = cy + math.sin(rad) * length * s
        draw.line((x1, y1, x2, y2), fill=BLACK, width=max(3, int(width * s)))

    return layer


def draw_monochrome_burst(size: int, cx: float, cy: float, scale: float = 1.0) -> Image.Image:
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    s = scale

    outer = cartoon_star_points(cx, cy, 92 * s, 270 * s, 9, wobble=0.3)
    draw.polygon(outer, fill=BLACK)

    inner = cartoon_star_points(cx, cy, 44 * s, 150 * s, 8, wobble=0.18)
    draw.polygon(inner, fill=BLACK)

    draw.ellipse((cx - 78 * s, cy - 78 * s, cx + 78 * s, cy + 78 * s), fill=BLACK)
    return layer


def compose_icon(size: int, with_background: bool = True) -> Image.Image:
    cx = cy = size / 2
    scale = size / 1024

    base = radial_background(size) if with_background else Image.new("RGBA", (size, size), (0, 0, 0, 0))

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    for radius, alpha in [(240, 45), (170, 65), (115, 85)]:
        r = radius * scale
        glow_draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 140, 0, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(2, int(20 * scale))))

    burst = draw_explosion(size, cx, cy, scale)
    result = Image.alpha_composite(base, glow)
    return Image.alpha_composite(result, burst)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    compose_icon(1024, with_background=True).convert("RGB").save(OUT / "icon.png", optimize=True)
    compose_icon(1024, with_background=False).save(OUT / "android-icon-foreground.png", optimize=True)

    cx = cy = 512
    draw_monochrome_burst(1024, cx, cy, 1.0).save(OUT / "android-icon-monochrome.png", optimize=True)
    compose_icon(512, with_background=False).save(OUT / "splash-icon.png", optimize=True)
    compose_icon(48, with_background=True).convert("RGB").save(OUT / "favicon.png", optimize=True)

    print("Generated cartoon Boom icons in", OUT)


if __name__ == "__main__":
    main()
