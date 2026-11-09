# Measuring a raster design

For screenshots and for PDFs whose pages are single full-page images. Everything here is
measurement, so everything here carries a tolerance — record it.

## First: is it actually raster

Open the PDF and check the page for embedded fonts and extractable text. No fonts and one
full-page image per page means a raster mock. Also read the page rectangle — **never assume
A4**. A design exported at 612×792 pt is US Letter, and building on the wrong page size is a
mistake that survives until someone prints it.

## Establish scale before anything else

```
scale = image_width_px / page_width_pt
```

For a bare screenshot with no page size there is no scale. Absolute sizes are then unobtainable
— ask the user for one known dimension (artboard width, or the width of a named element) and
derive everything from it. Do not proceed by assuming 1px = 1pt.

Render at 300 dpi when measuring; anti-aliasing at lower resolutions swamps sub-point features
like a 3pt corner radius.

## Element bounds

Scan for runs of non-background pixels.

- **Rows**: for each y, take the mean colour across a wide x range. Transitions between
  "background" and "ink" give the vertical bounds of every band on the page.
- **Columns**: within a known band, for each x, test whether any pixel in that band is ink.
  Group the resulting runs with a gap threshold (~6pt works for text columns) to get one run per
  label or value.

Use a threshold, not equality — JPEG-compressed mocks have no perfectly flat regions.

## Fill colours

Take the statistical **mode** over a flat interior region, never a single pixel and never within
a few pixels of an edge. Compression artefacts cluster at edges and will hand you a colour that
appears nowhere in the design.

## Corner radius

Record the left edge x for each scanline through the corner. The inset profile is the radius:
the x offset shrinks from `r` to `0` across `r` scanlines. Read where it stabilises.

A radius under about 1px means square — say square, do not report `0.4`.

## Opacity is not recoverable

You see the composite of the element over its backdrop, not the element. Two different
opacity/colour pairs produce identical pixels. If the design relies on transparency, say it
cannot be extracted from this source and ask for the Figma file or the token value.

The one exception: if the same element appears over two *known* different backdrops, you can
solve for alpha. Rare, but worth checking.

## Shadows

Effectively unrecoverable. A blur radius can be crudely estimated from the falloff distance, but
spread, exact colour and alpha cannot be separated from the backdrop. Record as a gap.

## Font size, when you cannot ship the design's font

The useful trick is to match rendered **width**, not to guess the point size.

1. Pick a label whose string you know exactly, e.g. `Customer #:`.
2. Measure its ink width in points from the image.
3. Sum the advance widths of its characters in the font you *will* ship, per 1000 em units.
4. `implied_size = measured_width * 1000 / advance_sum`

That size makes your font occupy the same horizontal space as the design's, which is what keeps
columns aligned. Do this per text role — headings, labels, table cells — not once globally.

To get advance widths, read them out of the font file with the toolkit already in the project
(fontkit ships with pdfmake, for example) and cache them as a table.

## Rules and dividers

A hairline shows up as a row whose mean colour differs from the fill above and below it. Its
colour read from a single row is a blend — sample the darkest row and treat that as the line
colour.

## Recording

Every value from this file goes into the spec as `"source": "measured"` with the tolerance
achieved. Do not launder a measured number into the spec as if it were exact.
