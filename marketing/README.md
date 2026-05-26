# Marketing assets

Source SVGs for the Chrome Web Store and AMO listing imagery.

| File                     | Size       | Where it's used                                                                   |
| ------------------------ | ---------- | --------------------------------------------------------------------------------- |
| `promo-tile-small.svg`   | 440 × 280  | Chrome Web Store "small promo tile" (shown in search results and recommendations) |
| `promo-tile-marquee.svg` | 1400 × 560 | Chrome Web Store "marquee promo tile" (hero placement on featured pages)          |

The store wants PNGs at the exact pixel sizes. Render with `rsvg-convert`:

```bash
# Install rsvg-convert on macOS:
brew install librsvg

# Render at the target size (matches the viewBox 1:1, no scaling):
rsvg-convert -w 440  -h 280 marketing/promo-tile-small.svg   -o promo-tile-small.png
rsvg-convert -w 1400 -h 560 marketing/promo-tile-marquee.svg -o promo-tile-marquee.png
```

Inkscape, ImageMagick (`convert`), or any browser's "save as PNG" works too — the SVGs are dependency-free and reference only fonts that ship on every common OS (Helvetica/Arial fallback).

## Style guide

- **Background**: `#0f1115` (matches the popup's dark mode token)
- **Primary text** (brand): `#f3f4f6`
- **Secondary text** (tagline): `#9ca3af`
- **Accent**: `#3b82f6` (cobalt blue — same as the extension's UI accent)
- **Logo**: shared with `src/icons/logo.svg` (inlined here so the marketing assets are self-contained)

If you change the extension's accent colour, update the marketing tiles in the same commit so listings stay in sync.
