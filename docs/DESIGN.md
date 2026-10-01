# Tideholm — Design System

> Tideholm is an asynchronous hex-island trading game. It should feel like a
> premium tabletop game you keep in your pocket: chunky, tactile, friendly.

## v1 draft → critique → v2

The first pass was: teal ocean, cream background, coral accents, navy text,
Fredoka + Nunito. Reviewing it honestly:

| v1 choice | Problem | v2 fix |
| --- | --- | --- |
| Cream canvas + coral accent | The default "cozy app" look; reads as a recipe app, not a game. | Cool **Seaglass** canvas so warm game pieces pop off it; **Hibiscus** pink-red instead of coral. |
| Navy text | Generic corporate. | **Inkberry**, a deep plum-ink that also outlines every piece, giving the board an illustrated, inked look. |
| Fredoka + Nunito | The most common "friendly" pair; Nunito's rounded forms hurt legibility at small sizes in dense trade UI. | **Lilita One** (chunky poster display, great tabular-feeling numerals on tokens) + **Atkinson Hyperlegible** (built for low vision, distinct I/l/1 and 6/8/9; ideal for counts). |
| Soft blurry drop shadows | Flat-UI-with-shadows; no physicality. | **Cardboard lip**: solid offset bottom edge in a darker tint. Pressing collapses the lip. Pieces cast one short, hard contact shadow. |
| Player colors red/blue/orange/white | Red/orange are indistinguishable for deuteranopes. | Okabe–Ito-derived set **plus** a crest shape and roof pattern on every piece. |
| Generic line icons | Off-the-shelf feel. | Duotone 24-grid glyphs: 2.5px Inkberry stroke, one flat fill, rounded joins. Same ink as the board. |

## Palette (6 named colors)

| Name | Hex (light) | Dark-mode role | Use |
| --- | --- | --- | --- |
| **Inkberry** | `#2A1F3D` | Canvas `#17111F`, surface `#241B33` | Text, outlines on all pieces/tiles/cards |
| **Lagoon** | `#1BA3A0` | `#2BC2BE` | Ocean, secondary buttons, links, focus rings |
| **Marigold** | `#FFB627` | `#FFC24D` | Primary action, "Your turn", dice pips, glow on valid spots |
| **Hibiscus** | `#EF476F` | `#FF6B8E` | Raider, 6/8 tokens, errors, destructive actions |
| **Seaglass** | `#E6F2EE` | (text on dark) | Light-mode canvas; token disc face |
| **Fern** | `#4F9D52` | `#6CC070` | Ready / accepted / success |

Board-only terrain tints (derived, never used in chrome): Grove `#2F7D4F`,
Claypit `#C66A3D`, Meadow `#93CF5F`, Fields `#EAC14B`, Crags `#7F889B`,
Dunes `#E7D3A1`. Each has a lighter top-left and darker bottom-right gradient
stop and a faint procedural stroke texture (rows, ripples, speckles).

### Player colors (color-blind safe + shape + pattern)

| Seat | Name | Hex | Crest | Roof pattern |
| --- | --- | --- | --- | --- |
| 1 | Ember | `#D55E00` | ● circle | solid |
| 2 | Tide | `#0072B2` | ▲ triangle | stripes |
| 3 | Orchid | `#CC79A7` | ■ square | dots |
| 4 | Chalk | `#F2EFE6` | ◆ diamond | checks |

Every piece also carries an Inkberry outline so it reads on any terrain.

## Type

| Role | Face | Size / line | Notes |
| --- | --- | --- | --- |
| Display (title, win screen) | Lilita One | 40/44 | tracking +0.5 |
| Heading | Lilita One | 24/28 | |
| Numbers (tokens, counts, VP) | Lilita One | 14–28 | always on a disc or chip |
| Body / UI | Atkinson Hyperlegible Regular | 16/22 | |
| Labels / buttons | Atkinson Hyperlegible Bold | 15/20 | sentence case |
| Caption | Atkinson Hyperlegible Regular | 13/18 | never smaller |

All text uses `allowFontScaling`; layouts are built to wrap, and the action
bar collapses labels into icons above 1.3× font scale.

## Spacing, radii, depth

- **Spacing** (4-pt): `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 48`.
- **Radii**: `chip 10 · card 18 · sheet 28 · pill 999`; hex tiles use 6px
  rounded corners.
- **Depth**:
  - *Lip*: buttons/cards have a 4px solid bottom edge in a 25%-darker tint.
    Pressed → lip 1px, content translates down 3px (with a light haptic).
  - *Contact shadow*: pieces and token discs cast a short, hard ellipse at
    20% Inkberry.
  - *Ambient*: only sheets/modals get one soft shadow (y 12, blur 24, 18%).
- **Iconography**: duotone, 24 grid, 2.5px rounded Inkberry stroke, single
  flat fill. Resource glyphs: Timber (stacked logs), Clay (stamped brick),
  Fleece (cloud-sheep), Grain (tied sheaf), Stone (faceted chunk).

## Motion

| Moment | Motion | Reduced motion |
| --- | --- | --- |
| Dice | 700ms tumble (rotate + squash), settle with spring | instant faces |
| Production | Card glyphs fly from tile to the hand fan along a bezier, staggered 60ms | counts tick up |
| Placement | Piece drops from −24px with overshoot spring + contact shadow grows | fade in |
| Valid spots | Marigold glow pulses 1.2s | static ring |
| Ocean | 8s gentle wave drift on the border | static |
| Win | Confetti in player colors + crest stamp | static banner |

Haptics: light on press, medium on placement, success notification on win.
Sound is opt-in (off by default).

## Names (original vocabulary)

| Concept | Tideholm name |
| --- | --- |
| Game | Tideholm |
| Resources | Timber, Clay, Fleece, Grain, Stone |
| Terrains | Grove, Claypit, Meadow, Fields, Crags, Dunes (desert) |
| Road / settlement / city | Trail / Outpost / Town |
| Robber | Raider |
| Development cards | Fortune cards |
| Knight / Road building / Year of plenty / Monopoly / VP | Warden / Trailblazer / Windfall / Embargo / Relic |
| Longest road / Largest army | Longest Trail / Grand Watch |
| Ports | Harbors |
