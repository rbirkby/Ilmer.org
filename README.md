# Ilmer.org

ilmer.org

## Development

`npm run start`

## Ilmer in 1839

The interactive Three.js reconstruction is at `/history/ilmer-1839/`.
The model combines 1839 footprints and traced road edges, the supporting 1876 reference,
photograph-informed architecture and modern measured terrain.
View buttons fly smoothly between their destinations, lifting over intervening
terrain and roofs. Another view redirects the flight; entering the cart or
Historic Tour cancels it. Reduced-motion preferences use instant view changes.
The Controls selector switches between look-around orbiting and manual flight.
In Fly freely mode, drag to look, use W/A/S/D to travel, Q/E to descend/ascend,
Shift for faster movement, and arrows to turn. Hold the visible direction
buttons for touch or pointer travel. Flight remains inside the crop, above
terrain and roofs. View transitions, the Historic Tour and riding suspend manual
movement; changing a view ends the tour or ride. There is no End Flight button.
The on-page evidence and reference-image section has been removed; source
images and the terrain/tree provenance datasets remain in the repository.
On supported mobile browsers, Camera AR view combines the rear camera with the
GPS-positioned reconstruction and device compass. The camera and live location
are used in the browser and are not uploaded by the site. Alignment is
approximate: the historic-map registration and phone GPS are not survey-grade.
AR controls stay hidden without a usable compass heading, except on touch devices
that require a tap to request compass permission.
Trees and hedges are hidden in AR and restored on exit.
The reconstruction import map content-hashes its helper modules as well as the
entry script, preventing older cached helpers from breaking startup after an
update. Module-loading failures display an error instead of leaving the loading message.
The church's east chancel has an east-facing window following the supplied
correction; its frame and glazing arrangement are illustrative. The sagging
roof, slipped tiles and cracked masonry still indicate the chancel's poor repair.
A masonry-filled arched doorway with a pale surround marks the church's south
wall facing Upper Farm, opposite the porch. Its infill uses the same stone material
and aligned courses as the nave wall. Its dimensions and surround are interpreted.
The Old Vicarage has ground-floor windows on both long elevations and ground-floor
and upstairs windows on its gable ends; the projecting entrance remains between
the front window bays. Its 1.5-metre ground-floor windows are centred 2.0 metres
above local ground (sills at 1.25 metres, heads at 2.75 metres); the 1.5-metre
roof-space windows span 6.56–8.06 metres above ground, centred at 7.31 metres
above the 6-metre eaves. The roof is steeply pitched (about 51 degrees including
its overhang) and thatched, with the chimney raised to clear the ridge.
These heights and the pitch are model interpretations, not
surveyed elevations.
Two Cottages & Gardens and Three Tenements & Gardens retain their mapped
footprints and boarding, with domestic-sized framed doors, thresholds and windows
instead of barn entrances. Window bays repeat along the longer ranges and appear
on the end walls. Their arrangement is illustrative, not recorded elevations.
The larger tenement range has two separately framed front doors, with window
bays distributed around both entrances.
Wooden dwelling windows leave at least one model metre of solid wall between
their outer frame and a corner, with separation from other windows and doorways.
Narrow walls omit windows that cannot fit these clearances. The cottages,
tenements and stone Lower Farm house have brick chimney stacks; existing Middle
Farm and Old Vicarage chimneys are retained. Stack positions are interpreted.
Small boarded farm volumes (longest traced dimension below 40 map pixels,
12.8 model metres) have timber down to the local ground, including their
sloping-ground foundation infill. Larger boarded ranges retain their brick bases.
The two-storey stone Lower Farm house has dense, irregular climbing ivy on all
four walls and into its gables, with openings left clear. This follows the supplied
historical correction; the individual stems and extent of coverage are illustrative.
The optional horse-and-cart journey follows the existing connected road
centrelines inside the traced 1839 road from the map's left edge, past the church to Lower Farm and the
opposite edge. Horse and cart sample the same measured terrain as the roads.
Click or tap the horse or cart once to enter the ride. With the scene
focused, C enters, pauses or resumes it. A pause/resume control appears only
while riding; Escape or any place view returns to exploration.
Hidden tabs pause the journey. The cart,
horse and journey are illustrative, not evidence of a particular 1839 trip.
Entering the cart activates original, procedurally synthesized hoofbeats, wheel
rumble, wooden creaks and occasional horse snorts and whinnies through Web Audio.
No third-party recordings are used. Sounds always play while riding, subject to
browser audio permissions; there is no mute control. Pausing, leaving, changing
views or hiding the tab silences them.
The externally moving cart and Historic Tour do not activate audio.
Every scene view shows the moving horse and cart with a seated driver while
leaving its camera free to orbit, including place views, the overhead plan and
the original-map overlay. There is no cart-visibility checkbox. View changes
preserve the journey's position. The rider's view hides the driver's body so it
does not obstruct the camera. The cart remains on the road rather than following
the overview camera, so it can travel outside a close-up view's frame.
Both views share a continuous back-and-forth circuit, with small semicircular
turns inside the road width at either end. Along the narrower historical lanes,
the journey stays nearer the centre, widening gradually only for the end turns.
The horse leads the cart along that
same circuit, so it turns first and the cart and rider follow without teleporting.
Every render keeps the camera at least 1.2 model units above the local measured
terrain, including orbit, pan, zoom and cart travel. Outside the terrain crop,
the nearest boundary elevation supplies the camera floor.
"Historic Tour" starts a roof-height tour with one stop per mapped
building volume, plus the church, including the isolated unnamed footprint.
The route orders stops by proximity, interpolates the camera and its look target,
and briefly pauses beside each building. It repeats after visiting every stop.
Pause/resume, End flight, Escape and the existing view buttons remain available.
Terrain clearance and building bounds keep the flight above ground and roofs;
the horse and cart continue along their road route independently.
Mapped tree positions are unchanged; broadleaf crowns combine clustered
foliage lobes and individual leaf geometry, with smaller orchard canopies.
Trees and hedges are always visible in every view, including the original map;
there is no landscape-visibility checkbox.
Two sheep flocks and three chicken flocks occupy separate mapped enclosures,
including eight chickens within the traced grounds of Two Cottages & Gardens.
They wander in groups, pause to graze or peck, and stay inside their own polygon
with body clearance from the boundary. Paths are checked against the rendered
roads, building bounds, ponds and tree trunks; feet sample the measured terrain.
These animated animals and their numbers are illustrative, not an 1839 census.
The large detached Upper Farm building beside its pond is a stone house, with
a domestic door, corner-clear framed windows, a chimney and thatched main and
lean-to roofs. Its storey count is
not established by the map.
The middle of Upper Farm's three joined barns is a taller, tithe-barn-like volume:
its modeled eaves are 11 metres above its foundation, twice the adjoining barns'
5.5 metres. The three footprints and neighbouring heights are unchanged.
These heights interpret the supplied correction rather than surveyed elevations.
Middle Farm has a visibly solid 0.8-unit thatch layer with rounded eaves and a
single taller chimney centred on the main roof ridge. Its main house has three
storeys: two below the eaves and a third in the roof space, with a window on each
gable end. The lower attached wing retains its existing height. These thicknesses, heights
and concealed elevations remain interpretations of the supplied corrections.
Every mapped red building footprint has been reviewed against the original crop.
The compound Upper Farm ranges retain their steps and projecting wings; the
northern range is realigned, the stone house has its stepped front projection,
and several small barns have attached low volumes. Middle Farm's main block is
narrowed to the actual red body rather than filling its western recess; its long
outbuilding gains the northern cross-wing and side projections. The eastern
Lower Farm building is a narrow main block with a projecting side bay.
All Lower Farm outbuildings, including the side bay, have thatched roofs;
the stone farmhouse retains its tiled roof.
The cottage L-plan, simple tenement ranges, church porch and existing Vicarage
entrance were checked too. The church's whole nave/chancel/porch plan is shifted
and narrowed into its red outline without moving the doorway to another side
or changing its vertical architecture. A small detached red footprint beside
Middle Farm's northern shed is included as an unnamed small outbuilding.
Projection roofs and their uses as porches or lean-tos
are interpretations, not established by the plan. Sub-3-pixel paint/ink wobbles
and the unfilled hatched bay beside the Upper Farm sheds are unresolved rather
than invented as certain roofed structures.
Foliage is partially transparent (0.38 opacity per surface) so buildings and
scenery remain visible through the leaves; trunks remain solid.
Place labels render after transparent foliage, without testing or writing scene
depth, so their text remains readable where tree crowns overlap them.
Road clearance omits trees whose canopy-radius footprint intersects the actual
rendered road or track triangles, or the cart's swept route. Trunks within the
traced ponds are also excluded. Retained trees keep their positions and sizes.
The source detections are preserved; these exclusions are scene filters.
The pond beside Two Cottages & Gardens is retraced from the 1839 outline.
Its full surface follows the terrain to keep that historic extent visible;
the modern ground previously concealed most of a flat water plane. This shows
the mapped extent, not a measured historic water level or pond depth.
Two further ponds opposite the church, adjoining plots 46 and 47, follow
the irregular 1839 outlines. The adjacent dotted verge boundaries shape the
wider road junction. The other roads now follow paired edge traces from the
1839 map rather than constant-width ribbons fitted from the later map.
The area directly beside Three Tenements & Gardens is a garden, not a pond.
Six illustrative ducks swim and dabble within the pond beside Two Cottages
& Gardens.
These new pond surfaces also drape over the ground, depicting their mapped
extents rather than claiming known historical water elevations.
Road edges and field hedges have separate coordinate datasets. Road edges,
including the dotted pond verges and both mapped farm-access lanes, generate
road surfaces only, never hedges. Field and property divisions have green,
terrain-following hedges. These include the dotted internal parcel divisions
in plots 2a/2b and 45a/45b, following the requested display convention rather
than asserting recorded hedge planting. The traces were rechecked against
the original 2000 by 882 pixel crop, including the previously missing
northwestern boundary and the small Upper Farm and Middle Farm enclosures.
Parcel shading uses the corrected outlines instead of unrelated coarse polygons.
Building positions and footprints are unchanged by this boundary correction.
The cart route is checked with 0.8 model units of body clearance inside the actual
road polygons. Livestock containment uses the corrected field outlines.
Faded northern-lane ink near map y90–105 and the short southern continuation
near y840–855 require interpolation. The church-junction opening between
Upper Farm's frontage and the churchyard has no separately inked road edge;
the displayed connection spans that gap. At Lower Farm, building frontage
edges delimit the road where a separate verge is absent.
The circular feature near map x215 and unfilled recess beside plot 48 have
no inferred use. Hedge species and height remain illustrative.
Three.js and its licence are copied from the pinned npm dependency at build time.

`assets/ilmer-terrain.json` is a generated elevation grid, sampled from the
Environment Agency's 1 m bare-earth DTM at about 2 m spacing. The tithe map is
georeferenced through the Ordnance Survey map (St Peter's Church and Lower
Farm's benchmarked farmhouse), and the JSON records the source, request,
checksum, licence, registration, the railway embankment's traced crest and a
comparison with the OS benchmarks and spot heights.
It is not an elevation estimate derived from the supplied hillshade.

Contains Environment Agency information, copyright and/or database right 2022,
used under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
Modern registration landmarks use [OpenStreetMap contributors' data](https://www.openstreetmap.org/copyright).

To regenerate it, download `image/tiff` from the source WCS recorded in the
JSON with `request=GetCoverage`, `service=WCS`, `version=2.0.1`,
the recorded `coverageId`, `subset=E(475500,478500)`,
`subset=N(204500,207000)`, keeping its native British National Grid
(EPSG:27700) so nothing is resampled, then run:

```sh
node scripts/build-ilmer-terrain.ts /path/to/downloaded-dtm.tif
```

The converter intentionally rejects unsupported TIFF encodings, missing
elevations and incomplete coverage rather than substituting flat ground.
The historic map is registered approximately, not surveyed or georectified.
The modern embankment across the eastern edge, beyond Lower Farm, is removed
from the displayed historical terrain. Within its traced feet only, elevations
are interpolated across the measured surrounding grade with blended margins.
Roads, the cart, buildings, vegetation and camera clearance use that same
corrected grid. The original source elevations remain untouched. This local
correction is an inferred pre-earthwork surface, not measured 1839 ground;
other modern earthworks and unknown historical changes remain limitations.

Individual tree-symbol centres, template scores, manual corrections and the
checked map registration live in `assets/ilmer-trees.json`. The old interpolated
rows have been removed. Regenerate with `scripts/build-ilmer-trees.py
--diagnostics /path/to/output` using Python with numpy, scipy,
opencv-python-headless and Pillow. The script tests reflected and unreflected
orientations, rejects local folds, records each landmark's residual, and writes
the public detection and overlay images. Format the generated JSON with
`npx oxfmt --write assets/ilmer-trees.json` afterwards.

The scene filters detections outside the tithe crop or inside building
footprints, then instances each remaining symbol once. These are later evidence,
not a census of trees surviving from 1839. Large residuals at uncertain landmarks
are recorded, not silently warped away. Place controls use the names transcribed
in `history/fields-farming.md`.

Where that registration puts a crown over a road, the cart route or a pond, the
symbol is stepped onto the verge or left out. That clearance is not searched in
the browser. `assets/ilmer-placed-trees.json` holds the resulting positions,
species and the render index each crown's size and colour use. The page loads it
with the same content-hash query string as the other assets. Every symbol meets
the same fixed trials, so regenerating the file reproduces the forest. Run it
again when detected symbols, the terrain, roads,
ponds, the cart route or the crown mesh change:

```sh
node scripts/build-ilmer-placed-trees.ts
npx oxfmt --write assets/ilmer-placed-trees.json
```

The generator reuses the page's terrain draping, so the cleared positions match
the roads the page draws. A bounding-box test skips road triangles that cannot
touch a crown. The page checks the file's hashes of `ilmer-trees.json` and
`ilmer-terrain.json` and refuses to start if they have drifted.

## Stylesheets

All stylesheet links live in [_includes/head.liquid](_includes/head.liquid) and local CSS uses the `cacheBust` filter.

- [assets/css/style.css](assets/css/style.css) is the shared base: palette and font tokens, site chrome, article content, media, tables, margin notes, accessibility utilities and the lightbox. It also imports the dependency-owned GitHub alert styles.
- [assets/css/archive.css](assets/css/archive.css) provides the archive theme and its components: heroes, archive browsing, parish cards, census lists and minute navigation. The post, archive and parish-hub layouts load it automatically; posts (including drafts) always use archive presentation without a page-level flag. Keep it separate so home, wills, timeline and 404 pages do not download unused archive rules.
- [assets/css/home.css](assets/css/home.css), [assets/css/will.css](assets/css/will.css) and [assets/css/timeline.css](assets/css/timeline.css) load only for their respective layouts. Home and will rules were previously embedded in templates. The will's `data-script` attribute selects its handwriting font; only round-hand wills request Pinyon Script.

Keep CSS rules out of Markdown and Liquid style blocks. Use a component class for static presentation; posts can set `articleClass` in front matter for a scoped article treatment, such as `article--fitted-transcript` on Court Rolls. The Domesday folio mask is scoped to its image, not every article image.

Inline styles remain appropriate for content-specific values: archive hero image URLs and SmartFrame image aspect ratios and maximum widths. The shared SmartFrame width and display rules belong to the base stylesheet. Runtime styles controlled by interactive widgets are separate from authored page CSS.

Article images accept comma-separated URL fragment hints. Add `small` to reduce the usual displayed width and height without resizing the source file: `![Caption](/images/photo.avif#left,small)`. Combine it with `left` or `right` for a smaller float, or use `#small` alone for a reduced width image. Captions share the resized frame; lightbox images remain full-size.

`npm test` includes stylesheet ownership checks, the site build and internal link checks. For visual CSS changes, also compare representative home, article, archive, census, will and timeline pages at desktop and phone widths, including expanded archive years and both will font-toggle states.
