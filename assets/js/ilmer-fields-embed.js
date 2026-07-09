/* Ilmer field-map embed (ES module).
 *
 * Usage on any page (must be served over http(s), as with all ES modules):
 *   <div id="ilmer-field-map" style="height: 560px"></div>
 *   <script type="module" src="ilmer-fields-embed.js"></script>
 *
 * Leaflet 1.9.4 (ESM build) is imported from unpkg; its stylesheet is injected
 * automatically. Field shapes were traced from the Ilmer estate field-map
 * diagram and georeferenced against the Chiltern Main Line and the lane to
 * the A4129. `init()` is also exported for programmatic use.
 */
import * as L from "https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js";

const FIELDS = [{"id": 1, "name": "Lakes 1", "color": "#e6194b", "latlngs": [[51.752014, -0.901538], [51.751179, -0.899263], [51.750899, -0.893459], [51.752059, -0.893358]], "label": [51.751567, -0.896724]}, {"id": 2, "name": "Lakes 2", "color": "#3cb44b", "latlngs": [[51.750573, -0.893518], [51.750302, -0.888491], [51.750265, -0.887656], [51.750165, -0.885188], [51.750467, -0.885971], [51.750836, -0.887088], [51.751085, -0.887931], [51.751702, -0.890485], [51.752062, -0.893311]], "label": [51.750982, -0.890342]}, {"id": 3, "name": "The Grove", "color": "#ffe119", "latlngs": [[51.751161, -0.899254], [51.747007, -0.889473], [51.74797, -0.888618], [51.750249, -0.887897], [51.750553, -0.893529], [51.750892, -0.893497]], "label": [51.749458, -0.892197]}, {"id": 4, "name": "Fatting Ground", "color": "#4363d8", "latlngs": [[51.750142, -0.885194], [51.750235, -0.887853], [51.748004, -0.88852], [51.748521, -0.887392], [51.749501, -0.885854]], "label": [51.749401, -0.887123]}, {"id": 5, "name": "The Slype", "color": "#f58231", "latlngs": [[51.748535, -0.887306], [51.74686, -0.884432], [51.749291, -0.886094]], "label": [51.748229, -0.885944]}, {"id": 6, "name": "Long Meadow", "color": "#911eb4", "latlngs": [[51.749298, -0.886041], [51.746864, -0.884405], [51.747002, -0.883694], [51.748073, -0.882137], [51.746993, -0.8791], [51.747851, -0.877662], [51.748269, -0.878658], [51.748953, -0.880589], [51.749337, -0.88132], [51.749797, -0.88322], [51.749623, -0.883628], [51.749791, -0.884121], [51.750139, -0.88516]], "label": [51.748442, -0.882473]}, {"id": 7, "name": "Pole Field", "color": "#46f0f0", "latlngs": [[51.747, -0.889462], [51.746481, -0.88809], [51.747751, -0.886049], [51.748508, -0.88734], [51.74793, -0.888572]], "label": [51.747488, -0.887793]}, {"id": 8, "name": "Big Banky", "color": "#f032e6", "latlngs": [[51.747015, -0.883623], [51.745884, -0.881351], [51.746974, -0.879143], [51.74805, -0.882143]], "label": [51.746975, -0.881501]}, {"id": 9, "name": "Little Banky", "color": "#bcf60c", "latlngs": [[51.746827, -0.884334], [51.745146, -0.882361], [51.745818, -0.881365], [51.747001, -0.883638]], "label": [51.746109, -0.882809]}, {"id": 10, "name": "Bridge Field and Old Plough", "color": "#fabebe", "latlngs": [[51.746474, -0.888079], [51.744555, -0.883541], [51.745116, -0.882383], [51.746796, -0.884439], [51.747733, -0.88605]], "label": [51.74612, -0.885185]}, {"id": 11, "name": "The Plain", "color": "#008080", "latlngs": [[51.746621, -0.889688], [51.745047, -0.890664], [51.744356, -0.889012], [51.744668, -0.88869], [51.743938, -0.88691], [51.74342, -0.887554], [51.743147, -0.88708], [51.743751, -0.885451], [51.744097, -0.885903], [51.744702, -0.88501]], "label": [51.744945, -0.887906]}, {"id": 12, "name": "Sheep Ground", "color": "#e6beff", "latlngs": [[51.74583, -0.894346], [51.744829, -0.890965], [51.745073, -0.89074], [51.746668, -0.889773], [51.747405, -0.891341]], "label": [51.746102, -0.89173]}, {"id": 13, "name": "The Snipe", "color": "#9a6324", "latlngs": [[51.744535, -0.897306], [51.74423, -0.894871], [51.745227, -0.894495], [51.744416, -0.891351], [51.744761, -0.891062], [51.745819, -0.8944], [51.746575, -0.896157], [51.746322, -0.896769], [51.746155, -0.897263]], "label": [51.745285, -0.895189]}, {"id": 14, "name": "Great Ground, Pond and Mill Fields", "color": "#fffac8", "latlngs": [[51.749597, -0.89661], [51.747664, -0.897157], [51.747067, -0.895781], [51.74674, -0.896083], [51.74585, -0.894398], [51.747425, -0.891416]], "label": [51.747637, -0.894703]}, {"id": 15, "name": "40 Acres", "color": "#800000", "latlngs": [[51.751099, -0.904235], [51.750507, -0.904141], [51.749811, -0.904012], [51.748628, -0.903765], [51.747798, -0.903733], [51.747778, -0.900289], [51.747299, -0.897358], [51.74963, -0.896738], [51.750992, -0.900085]], "label": [51.749264, -0.90063]}, {"id": 16, "name": "5 Acres", "color": "#aaffc3", "latlngs": [[51.751812, -0.904371], [51.751145, -0.904236], [51.75104, -0.900144], [51.751998, -0.902219]], "label": [51.751467, -0.902598]}, {"id": 17, "name": "Upper New Close", "color": "#808000", "latlngs": [[51.746296, -0.904324], [51.746224, -0.903733], [51.746183, -0.900986], [51.74618, -0.897332], [51.746419, -0.896647], [51.74693, -0.897882], [51.747252, -0.897455], [51.747678, -0.900577], [51.747631, -0.903743], [51.746727, -0.904023]], "label": [51.746861, -0.900785]}, {"id": 18, "name": "Lower New Close", "color": "#ffd8b1", "latlngs": [[51.745277, -0.904232], [51.744419, -0.901845], [51.744535, -0.901738], [51.74413, -0.899629], [51.744505, -0.899554], [51.744556, -0.897366], [51.746163, -0.897329], [51.74619, -0.90361]], "label": [51.745342, -0.900501]}, {"id": 19, "name": "Coldharbour Strips", "color": "#000075", "latlngs": [[51.746282, -0.904328], [51.742125, -0.907752], [51.741972, -0.906743], [51.742101, -0.906581], [51.746194, -0.903647]], "label": [51.743982, -0.905724]}, {"id": 20, "name": "Coldharbour East", "color": "#809900", "latlngs": [[51.741951, -0.906699], [51.739394, -0.906532], [51.739354, -0.905783], [51.740066, -0.905149], [51.739971, -0.904496], [51.738902, -0.904784], [51.738742, -0.903198], [51.740224, -0.90267], [51.741018, -0.902337], [51.742061, -0.906577]], "label": [51.740436, -0.90467]}, {"id": 21, "name": "Coldharbour West", "color": "#c04b8e", "latlngs": [[51.738563, -0.912368], [51.73831, -0.911307], [51.738464, -0.905899], [51.739107, -0.906373], [51.739394, -0.906641], [51.741945, -0.906717], [51.742106, -0.90781], [51.739705, -0.909976], [51.740038, -0.911062]], "label": [51.739705, -0.908671]}, {"id": 22, "name": "Coldharbour South", "color": "#5aa02c", "latlngs": [[51.737041, -0.912714], [51.736836, -0.910297], [51.736843, -0.907554], [51.737501, -0.905234], [51.738224, -0.903346], [51.738689, -0.903197], [51.738882, -0.905236], [51.738443, -0.9059], [51.738271, -0.911297]], "label": [51.737751, -0.908011]}];

const CONTAINER_SELECTOR = "#ilmer-field-map, [data-ilmer-field-map]";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_CSS_SRI = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
const FILL_OPACITY = 0.5;

const WIDGET_CSS = `
.ifm-wrap { display: flex; gap: 0; align-items: stretch; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; border: 1px solid #ccc; border-radius: 6px; overflow: hidden; }
.ifm-map { flex: 1 1 auto; min-width: 0; }
.ifm-legend { flex: 0 0 240px; overflow-y: auto; background: #fafafa; border-left: 1px solid #ddd; padding: 10px 12px; font-size: 13px; }
.ifm-legend h2 { font-size: 14px; margin: 0 0 8px; }
.ifm-legend ul { list-style: none; margin: 0; padding: 0; }
.ifm-legend li { display: flex; align-items: baseline; gap: 7px; padding: 3px 4px; border-radius: 3px; cursor: pointer; line-height: 1.25; }
.ifm-legend li:hover { background: #e8eefb; }
.ifm-swatch { flex: 0 0 11px; width: 11px; height: 11px; border-radius: 2px; border: 1px solid rgba(0,0,0,.25); align-self: center; }
.ifm-num { flex: 0 0 1.6em; text-align: right; font-weight: 600; }
.leaflet-tooltip.ifm-field-label { background: transparent; border: none; box-shadow: none; font-weight: 700; font-size: 12px; color: #222; text-shadow: 0 0 3px #fff, 0 0 3px #fff, 0 0 4px #fff; }
.leaflet-tooltip.ifm-field-label:before { display: none; }
@media (max-width: 640px) { .ifm-wrap { flex-direction: column; } .ifm-legend { flex-basis: auto; max-height: 180px; border-left: none; border-top: 1px solid #ddd; } }
`;

// resolves once Leaflet's stylesheet is loaded: building before then breaks
// tooltip positioning, which measures element sizes
const injectStyles = () => new Promise((resolve) => {
  const style = document.createElement("style");
  style.textContent = WIDGET_CSS;
  document.head.appendChild(style);

  if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) return resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = LEAFLET_CSS;
  link.integrity = LEAFLET_CSS_SRI;
  link.crossOrigin = "";
  link.onload = () => resolve();
  link.onerror = () => resolve();
  document.head.appendChild(link);
});

const build = (container) => {
  container.classList.add("ifm-wrap");
  if (container.clientHeight < 100) container.style.height = "520px";

  const mapDiv = document.createElement("div");
  mapDiv.className = "ifm-map";
  const legend = document.createElement("div");
  legend.className = "ifm-legend";
  legend.innerHTML = "<h2>Ilmer Field Maps</h2><ul></ul>";
  container.append(mapDiv, legend);

  const map = L.map(mapDiv);
  // set the view before adding layers: standalone tooltips (the field number
  // labels) position themselves when added and don't follow later pans
  map.fitBounds(L.latLngBounds(FIELDS.flatMap((f) => f.latlngs)).pad(0.06));
  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  const sat = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Imagery &copy; Esri &amp; contributors" });
  L.control.layers({ "OpenStreetMap": osm, "Satellite (Esri)": sat }).addTo(map);
  L.control.scale({ imperial: true }).addTo(map);

  const ul = legend.querySelector("ul");
  for (const f of FIELDS) {
    const poly = L.polygon(f.latlngs, {
      color: "#333", weight: 1.2, opacity: 0.85,
      fillColor: f.color, fillOpacity: FILL_OPACITY,
    }).addTo(map);
    poly.bindTooltip(`<b>${f.id}. ${f.name}</b>`, { sticky: true });
    L.tooltip({ permanent: true, direction: "center", className: "ifm-field-label" })
      .setContent(String(f.id))
      .setLatLng(f.label)
      .addTo(map);

    const li = document.createElement("li");
    li.innerHTML = `<span class="ifm-swatch" style="background:${f.color}"></span>` +
      `<span class="ifm-num">${f.id}</span><span>${f.name}</span>`;
    li.addEventListener("click", () => map.fitBounds(poly.getBounds(), { maxZoom: 17 }));
    li.addEventListener("mouseenter", () => poly.setStyle({ weight: 3, color: "#d00" }));
    li.addEventListener("mouseleave", () => poly.setStyle({ weight: 1.2, color: "#333" }));
    ul.appendChild(li);
  }
};

export function init(root = document) {
  const containers = root.querySelectorAll(CONTAINER_SELECTOR);
  if (!containers.length) return;
  injectStyles().then(() => containers.forEach(build));
}

if (document.readyState !== "loading") init();
else document.addEventListener("DOMContentLoaded", () => init());
