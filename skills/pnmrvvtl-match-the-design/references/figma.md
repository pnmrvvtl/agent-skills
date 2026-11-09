# Figma extraction

## Token setup, to give the user verbatim

> Figma → avatar → **Settings** → **Security** → **Personal access tokens** → **Generate new
> token**. Read access to file content is enough (`files:read`). It is shown once and starts
> with `figd_`. Put it in `~/.claude/settings.json` under `env` as `FIGMA_TOKEN`, or set it as a
> system environment variable — **not** in the repo's `.claude/settings.json`, which gets
> committed. Do not paste the token into chat; it grants read access to every file you can see.
> To limit the blast radius, give it a short expiry, or create it from an account that only has
> access to the one project.

## Parsing the link

```
https://www.figma.com/design/<FILE_KEY>/<name>?node-id=1234-5678
```

File key is `<FILE_KEY>`. The node id in the URL uses a dash; the API wants a colon —
`1234-5678` becomes `1234:5678`. `figma.com/file/...` is the older form of the same URL.

## Endpoints

| Purpose | Call |
|---|---|
| Validate token | `GET /v1/me` |
| Node subtree | `GET /v1/files/:key/nodes?ids=1234:5678` |
| Whole file, depth-limited | `GET /v1/files/:key?depth=3` |
| Render a node to PNG | `GET /v1/images/:key?ids=1234:5678&format=png&scale=2` |
| Local variables / tokens | `GET /v1/files/:key/variables/local` |

Auth header is `X-Figma-Token: $FIGMA_TOKEN`.

`variables/local` may be plan-gated. On 403, fall back to raw values and record that token names
were unavailable.

Always scope to a node id. Fetching a whole file unscoped can be enormous and mostly irrelevant.

## Fetch to disk, distil with a script

Never let the raw response reach the context window.

```bash
curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/$KEY/nodes?ids=$NODE" -o "$SCRATCH/figma-raw.json"
```

Then walk the tree in a script and emit only the spec. Read the script's output, not the dump.

## Fields worth pulling per node

**Geometry**
- `absoluteBoundingBox` — x, y, width, height
- `absoluteRenderBounds` — includes shadow spread; the difference from the bounding box tells
  you how much the shadow bleeds
- `constraints`, `layoutAlign`, `layoutGrow` for responsive intent

**Shape**
- `cornerRadius`, or `rectangleCornerRadii` when the four corners differ
- `strokes[]`, `strokeWeight`, `strokeAlign` (`INSIDE` / `OUTSIDE` / `CENTER` — this changes the
  rendered box size and is a classic source of a 1px delta)

**Paint**
- `fills[]` — each with `type`, `color` (r/g/b/a as 0..1 floats), its own `opacity`, and for
  gradients `gradientStops` and `gradientHandlePositions`
- `opacity` on the node itself, and `blendMode`
- Node opacity and fill opacity multiply. Record both; do not collapse them into one number.

**Effects**
- `effects[]` — `DROP_SHADOW`, `INNER_SHADOW`, `LAYER_BLUR`, `BACKGROUND_BLUR`, each with
  `color`, `offset` {x, y}, `radius` (blur), `spread`, `visible`
- Skip entries with `visible: false`

**Layout — the real source of padding and gap**
- `layoutMode` (`HORIZONTAL` / `VERTICAL` / `NONE`)
- `paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom`
- `itemSpacing` — the gap
- `primaryAxisAlignItems`, `counterAxisAlignItems`, `primaryAxisSizingMode`

When `layoutMode` is set, use these numbers directly. Deriving padding by subtracting child
coordinates from parent coordinates is guesswork that happens to agree most of the time.

**Text**
- `characters` — the string
- `style` — `fontFamily`, `fontPostScriptName`, `fontWeight`, `fontSize`, `letterSpacing`,
  `lineHeightPx`, `lineHeightPercentFontSize`, `textAlignHorizontal`, `textAlignVertical`,
  `textCase`, `textDecoration`
- `styleOverrideTable` when parts of one text node differ

**Interaction**
- Prototype `interactions` on the node: trigger (`ON_HOVER`, `ON_CLICK`, …), action, and its
  `transition` with `type` (`SMART_ANIMATE`, `DISSOLVE`, …), `easing` and `duration` in seconds
- Convert duration to milliseconds for the spec

**States**
- Hover / pressed / disabled are normally separate **variants** of a component set, not
  interactions. Find the parent `COMPONENT_SET` and pull every child `COMPONENT`; its `name`
  carries the variant properties, e.g. `State=Hover, Size=Medium`
- Emit one spec entry per state

## Reference images for the visual diff

```bash
curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/images/$KEY?ids=$NODE&format=png&scale=2"
```

Returns a JSON body with a short-lived S3 URL per node id. Download it to the scratchpad and
keep it as evidence; it is the backstop for the overlay diff, never the primary source of
numbers.

## Colour conversion

Figma colour channels are floats 0..1. `round(c * 255)` per channel. Watch for the alpha living
in two places at once — `fills[].color.a` and `fills[].opacity` — and multiply them.
