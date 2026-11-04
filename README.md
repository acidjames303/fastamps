# FASTAMPS — Organic Soft Glow

The wordmark is solid. The glow that looked stuck / childlike was a **tight, high-opacity rim** hugging the letter edges — that reads as a stamped outline, not light.

This repo shows soft, organic alternatives using brand blue **`#0066FF`** and a flat logo (no baked-in glow).

## Open the studio

```bash
# from repo root
python3 -m http.server 4173
# then open http://localhost:4173/public/glow-studio.html
```

## Pick a glow

| Method | When to use | Class |
| --- | --- | --- |
| **E · Two-pass neon** (recommended) | Header, login, hero | `.fa-glow-twopass` |
| **B · Layered bloom** | Quick one-liner filter | `.fa-glow-layered` |
| **C · Ambient haze** | Large hero / atmospheric | `.fa-glow-ambient` |
| **D · SVG gaussian** | Softest edge scatter | `.fa-glow-svg` + SVG filter defs |
| **F · Breathing** | Splash / login presence | `.fa-glow-breath` |

Reusable CSS: [`public/fastamps-glow.css`](public/fastamps-glow.css)

## Why the old glow felt wrong

1. Short blur radius (a few pixels)
2. High opacity right at the glyph edge
3. Contour-hugging halo that looks like a second stroke
4. Often a bright cyan rim instead of soft brand-blue light

## The fix in one sentence

Put **diffused light behind** a **sharp logo**: long falloff, low edge opacity, brand-blue haze that spills into the navy background.
