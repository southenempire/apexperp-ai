# ApexPerp brand

Everything you need to use the ApexPerp name, logo and look, in one place. The files themselves live in [`public/brand/`](public/brand) because the app serves them from there.

**Name:** ApexPerp
**Tagline:** Get trimmed, not liquidated.
**One line:** A liquidation guard for dreamDEX perps on Somnia.

## Logo

| File | Use it for |
| :--- | :--- |
| [`public/brand/mark.svg`](public/brand/mark.svg) | The mark alone: app icon, avatar, favicon |
| [`public/brand/mark-512.png`](public/brand/mark-512.png) | The mark as a 512 px PNG, for places that don't take SVG |
| [`public/brand/logo-dark.svg`](public/brand/logo-dark.svg) | Mark plus wordmark on a **dark** background |
| [`public/brand/logo-light.svg`](public/brand/logo-light.svg) | Mark plus wordmark on a **light** background |
| [`public/brand/og-image.png`](public/brand/og-image.png) | 1200 × 630 share card for X and link previews (`og-image.svg` is the source) |

The mark is a falling price line that stops just above a solid floor: the line a position should never cross. The wordmark is custom block lettering drawn as shapes, so it looks the same everywhere without a font.

**Rules**
- Keep the mark yellow on black. Don't recolour it, add gradients, glows or shadows, or round its corners.
- Leave clear space around it equal to the height of the floor bar.
- It stays readable down to 16 px. Below that, drop the wordmark and use the mark alone.
- Use `logo-dark.svg` on dark backgrounds and `logo-light.svg` on light ones. Never put the light logo on a dark ground.

To rebuild every file from the one set of shapes, run `npm run brand` (it also rewrites `src/components/brandPaths.ts`, which the app's logo component reads).

## Colour

Dark is the default. Light applies when chosen, or when the system prefers it and nothing is chosen.

| Role | Dark | Light |
| :--- | :--- | :--- |
| Background | `#0A0A09` | `#F0EDE3` |
| Panel | `#11110F` | `#FAF8F1` |
| Panel, raised | `#1A1A17` | `#E4E0D3` |
| Border | `#34332E` | `#BEB9AA` |
| Text | `#F2EFE6` | `#11110F` |
| Muted text | `#969285` | `#605C52` |
| **Accent (safety yellow)** | `#FFD400` | `#FFD400` |
| Accent as text or a focus ring | `#FFD400` | `#856000` |
| Safe | `#60DC78` | `#14803A` |
| Warning | `#FFD400` | `#A67000` |
| Danger | `#FF4533` | `#C82616` |

Yellow is for the one thing to do on a screen, never for body text on a light background (it's unreadable there, which is why the light theme uses a darker amber for text). Red only ever means danger.

The tokens live in [`src/index.css`](src/index.css).

## Type

| Use | Font |
| :--- | :--- |
| Headings, buttons, labels | **Archivo Narrow**, bold, uppercase |
| Body text | **Archivo** |
| Numbers, prices, addresses, code | **IBM Plex Mono**, tabular figures |

All three are on Google Fonts.

## Look and feel

- **Circuit breaker, not fintech.** Hard edges and visible panel lines. Square corners everywhere; only status lamps are round.
- **Hazard stripes** (yellow and black diagonals) mark a boundary or a danger zone: under the nav, and in the liquidation segments of the health bar.
- **The health bar is a row of LED segments**, lit in green, yellow or red by how close an account is to liquidation, with the liquidation zone always striped.
- No stock photos, no 3D renders, no gradient blobs.

## Voice

Plain and direct, like a trader talking to a trader. Short sentences. Say what happened and what to do.

- Yes: "You're one bad candle from liquidation. Close it down."
- No: "Leverage your positions with institutional-grade risk infrastructure."
- Don't promise returns, volume or a token. Every number we show is read from the chain, and says where it came from.

## Naming

Write **ApexPerp** (one word, capital A and P). Refer to the exchange as **dreamDEX**, and tag **@DreamDEXSomnia** in posts. The network is **Somnia Tokyo testnet** (the Hideki chain).
