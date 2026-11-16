/* <ilmer-lease-map>: interactive map of the fields let with Lower Farm,
 * Middle Farm and Coldharbour Farm, combined from their lease plans.
 *
 * Usage:
 *   <ilmer-lease-map></ilmer-lease-map>
 *   <script type="module" src="/assets/js/ilmer-lease-map.js"></script>
 *
 * Self-contained: draws an SVG from ./ilmer-lease-fields-data.js with no
 * base map, because the plans are sketches that cannot be georeferenced
 * reliably. Drag to pan, wheel or the +/- buttons to zoom. Hover or focus a
 * field for its details; click or press Enter to keep them in the panel.
 */
import { LEASE_FARMS, arpToAcres, formatArp, planToMetres, polygonCentroid } from './ilmer-lease-fields-data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const USES = { m: 'Meadow', p: 'Pasture', a: 'Arable' };
const PAD = 120;

/** @typedef {import('./ilmer-lease-fields-data.js').LeaseFarm} LeaseFarm */
/** @typedef {import('./ilmer-lease-fields-data.js').LeaseField} LeaseField */
/** @typedef {[number, number]} Point */

/** @param {string} tag @param {Record<string, string | number>} [attrs] */
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};

/** @param {Point[]} pts */
const pointsAttr = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** @param {string} s */
const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** @param {LeaseFarm} farm @param {LeaseField} field */
const fieldTitle = (farm, field) =>
  `${field.name ?? `Field ${field.no}`}${field.name && field.no ? ` (${field.no})` : ''}, ${farm.name}`;

/** @param {LeaseFarm} farm @param {LeaseField} field */
const fieldDetails = (farm, field) => {
  const rows = [
    `<div class="name">${escapeHtml(field.name ?? `Field ${field.no}`)}${field.name && field.no ? ` <span class="no">${escapeHtml(field.no)}</span>` : ''}</div>`,
    `<div class="farm"><span class="swatch" style="background:${farm.color}"></span>${escapeHtml(farm.name)}</div>`
  ];
  if (field.area)
    rows.push(
      `<div class="area">${formatArp(field.area)} <span class="acres">(${arpToAcres(field.area).toFixed(2)} acres)</span></div>`
    );
  else if (farm.id === 'middle') rows.push('<div class="muted">Name and area not known: schedule not available</div>');
  if (field.use && USES[/** @type {keyof typeof USES} */ (field.use)])
    rows.push(`<div class="use">${USES[/** @type {keyof typeof USES} */ (field.use)]}</div>`);
  if (field.note) rows.push(`<div class="note">${escapeHtml(field.note)}</div>`);
  return rows.join('');
};

const STYLE = `
:host { display: block; font: 14px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #222; }
.wrap { display: flex; height: var(--ilmer-lease-map-height, 560px); border: 1px solid #ccc; border-radius: 6px; overflow: hidden; background: #fff; }
.stage { position: relative; flex: 1 1 auto; min-width: 0; background: #f4efe1; touch-action: none; cursor: grab; }
.stage.dragging { cursor: grabbing; }
svg.map { display: block; width: 100%; height: 100%; user-select: none; }
.field { stroke: #4a3f2c; stroke-width: 1.2; vector-effect: non-scaling-stroke; fill-opacity: 0.55; cursor: pointer; transition: fill-opacity 0.15s; }
.field:hover, .field.active { fill-opacity: 0.85; stroke: #b00; stroke-width: 2.5; }
.field:focus { outline: none; }
.field:focus-visible { stroke: #000; stroke-width: 3; }
.farm-group.hidden { display: none; }
.lane-edge { fill: none; stroke: #8a7a5c; stroke-linecap: round; stroke-linejoin: round; }
.lane-fill { fill: none; stroke: #f4efe1; stroke-linecap: round; stroke-linejoin: round; }
.label { font-weight: 700; fill: #222; paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.controls { position: absolute; top: 8px; left: 8px; display: flex; flex-direction: column; gap: 4px; }
.controls button { width: 32px; height: 32px; font-size: 18px; line-height: 1; border: 1px solid #aaa; border-radius: 4px; background: #fff; cursor: pointer; color: #222; }
.controls button:hover { background: #f0f0f0; }
.north { position: absolute; top: 8px; right: 8px; width: 40px; height: 56px; pointer-events: none; }
.scale { position: absolute; bottom: 8px; left: 8px; font-size: 12px; background: rgba(255,255,255,0.8); padding: 2px 6px; border-radius: 3px; pointer-events: none; }
.scale .bar { height: 6px; border: 1px solid #333; border-top: none; margin-bottom: 2px; }
.caveat { flex: 0 0 auto; margin: 0; padding: 6px 10px; font-size: 11px; color: #555; border-top: 1px solid #eee; }
.tooltip { position: absolute; pointer-events: none; background: #fff; border: 1px solid rgba(0,0,0,0.15); border-radius: 4px; padding: 6px 8px; box-shadow: 0 1px 6px rgba(0,0,0,0.18); font-size: 13px; max-width: 260px; z-index: 2; }
.tooltip[hidden] { display: none; }
.name { font-size: 16px; font-weight: 700; line-height: 1.2; }
.no { font-size: 12px; font-weight: 400; color: #555; }
.farm { font-size: 12px; color: #444; margin-top: 2px; }
.area { font-weight: 700; margin-top: 6px; }
.acres { font-weight: 400; color: #555; }
.use { font-size: 12px; }
.note, .muted { font-size: 12px; color: #666; margin-top: 4px; }
.swatch { display: inline-block; width: 12px; height: 12px; border: 1px solid #555; margin-right: 6px; vertical-align: -1px; }
.side { flex: 0 0 260px; display: flex; flex-direction: column; border-left: 1px solid #ddd; background: #fff; min-height: 0; }
.side h2 { font-size: 15px; margin: 0; padding: 8px 10px 4px; }
.info { flex: 0 0 auto; padding: 6px 10px 8px; border-bottom: 1px solid #eee; min-height: 64px; }
.legend { overflow-y: auto; flex: 1 1 auto; padding: 0 0 8px; }
.legend details { border-top: 1px solid #eee; }
.legend summary { padding: 6px 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
.legend summary label { display: flex; align-items: center; gap: 6px; cursor: pointer; flex: 1; }
.legend summary .total { font-size: 11px; color: #666; }
.legend ul { list-style: none; margin: 0; padding: 0 0 4px; }
.legend li button { all: unset; box-sizing: border-box; display: flex; gap: 6px; width: 100%; padding: 2px 10px 2px 28px; cursor: pointer; font-size: 13px; }
.legend li button:hover, .legend li button:focus-visible, .legend li button.active { background: #f2f2f2; }
.legend li .n { min-width: 22px; color: #555; text-align: right; }
@media (max-width: 640px) {
  .wrap { flex-direction: column; height: auto; }
  .stage { height: var(--ilmer-lease-map-height, 440px); flex: none; }
  .side { flex: none; max-height: 280px; border-left: none; border-top: 1px solid #ddd; }
}
`;

export class IlmerLeaseMap extends HTMLElement {
  /** @type {SVGSVGElement} */ #svg;
  /** @type {HTMLElement} */ #stage;
  /** @type {HTMLElement} */ #tooltip;
  /** @type {HTMLElement} */ #info;
  /** @type {HTMLElement} */ #scale;
  /** @type {{ x: number, y: number, w: number, h: number }} */ #home = { x: 0, y: 0, w: 1, h: 1 };
  /** @type {{ x: number, y: number, w: number, h: number }} */ #view = { x: 0, y: 0, w: 1, h: 1 };
  /** @type {Map<string, { el: SVGPolygonElement, item: HTMLButtonElement, farm: LeaseFarm, field: LeaseField }>} */
  #fields = new Map();
  /** @type {string | null} */ #selected = null;

  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="wrap">
        <div class="stage" part="stage">
          <svg class="map" role="group" aria-label="Fields of Lower, Middle and Coldharbour farms, from their lease plans"></svg>
          <div class="controls">
            <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
            <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
            <button type="button" data-zoom="reset" aria-label="Show all fields">⤢</button>
          </div>
          <svg class="north" viewBox="-20 -28 40 56" aria-label="North is up" role="img">
            <path d="M0 -24 L9 8 L0 2 L-9 8 Z" fill="#333"/>
            <text x="0" y="22" text-anchor="middle" font-size="14" font-weight="700" fill="#333">N</text>
          </svg>
          <div class="scale" aria-hidden="true"><div class="bar"></div><span></span></div>
          <div class="tooltip" hidden role="status"></div>
        </div>
        <div class="side">
          <h2>Lease plans</h2>
          <div class="info" aria-live="polite"><div class="muted">Hover over or select a field to see its name and area.</div></div>
          <div class="legend"></div>
          <p class="caveat">Schematic, north up. Traced from sketch plans; the positions of the three farms relative to each other are approximate.</p>
        </div>
      </div>`;

    this.#svg = /** @type {SVGSVGElement} */ (root.querySelector('svg.map'));
    this.#stage = /** @type {HTMLElement} */ (root.querySelector('.stage'));
    this.#tooltip = /** @type {HTMLElement} */ (root.querySelector('.tooltip'));
    this.#info = /** @type {HTMLElement} */ (root.querySelector('.info'));
    this.#scale = /** @type {HTMLElement} */ (root.querySelector('.scale'));

    this.#draw(/** @type {HTMLElement} */ (root.querySelector('.legend')));
    this.#bindControls(root);
    this.#bindPanZoom();
    // label sizes and the scale bar depend on the on-screen size of the map
    new ResizeObserver(() => this.#setView(this.#view)).observe(this.#stage);
  }

  /** @param {HTMLElement} legend */
  #draw(legend) {
    const lanes = svg('g', { 'aria-hidden': 'true' });
    const fieldsLayer = svg('g');
    const labels = svg('g', { 'aria-hidden': 'true' });
    this.#svg.append(lanes, fieldsLayer, labels);

    /** @type {Point[]} */
    const all = [];

    for (const farm of LEASE_FARMS) {
      const toMap = (/** @type {Point} */ p) => planToMetres(farm, p);
      const laneWidth = 10 * farm.metresPerPixel;
      const laneGroup = svg('g', { class: 'farm-group', 'data-farm': farm.id });
      for (const lane of farm.lanes) {
        const d = pointsAttr(lane.map(toMap));
        laneGroup.append(
          svg('polyline', { class: 'lane-edge', points: d, 'stroke-width': laneWidth + 3 }),
          svg('polyline', { class: 'lane-fill', points: d, 'stroke-width': laneWidth })
        );
      }
      lanes.append(laneGroup);

      const fieldGroup = svg('g', { class: 'farm-group', 'data-farm': farm.id });
      const labelGroup = svg('g', { class: 'farm-group', 'data-farm': farm.id });
      fieldsLayer.append(fieldGroup);
      labels.append(labelGroup);

      const details = document.createElement('details');
      details.open = true;
      const drawn = farm.fields.filter((f) => f.points.length);
      details.innerHTML = `
        <summary>
          <label><input type="checkbox" checked data-farm="${farm.id}" aria-label="Show ${escapeHtml(farm.name)}">
          <span class="swatch" style="background:${farm.color}"></span>${escapeHtml(farm.name)}</label>
          <span class="total">${farm.total ? formatArp(farm.total) : `${drawn.length} fields`}</span>
        </summary><ul></ul>`;
      const checkbox = /** @type {HTMLInputElement} */ (details.querySelector('input'));
      checkbox.addEventListener('click', (e) => e.stopPropagation());
      checkbox.addEventListener('change', () => {
        this.shadowRoot
          ?.querySelectorAll(`.farm-group[data-farm="${farm.id}"]`)
          .forEach((g) => g.classList.toggle('hidden', !checkbox.checked));
      });
      const ul = /** @type {HTMLUListElement} */ (details.querySelector('ul'));
      legend.append(details);

      for (const field of farm.fields) {
        const li = document.createElement('li');
        const item = document.createElement('button');
        item.type = 'button';
        item.innerHTML = `<span class="n">${escapeHtml(field.no)}</span><span>${escapeHtml(field.name ?? `Field ${field.no}`)}${field.points.length ? '' : ' <span class="muted">(not drawn)</span>'}</span>`;
        li.append(item);
        ul.append(li);
        if (!field.points.length) {
          item.addEventListener('click', () => this.#showInfo(farm, field));
          continue;
        }

        const pts = field.points.map(toMap);
        all.push(...pts);
        const key = `${farm.id}:${field.no}`;
        const poly = /** @type {SVGPolygonElement} */ (
          svg('polygon', {
            class: 'field',
            points: pointsAttr(pts),
            fill: farm.color,
            tabindex: 0,
            role: 'button',
            'aria-label': fieldTitle(farm, field)
          })
        );
        fieldGroup.append(poly);
        const [cx, cy] = polygonCentroid(pts);
        const label = svg('text', { class: 'label', x: cx.toFixed(1), y: cy.toFixed(1), 'font-size': 14 });
        label.textContent = field.no;
        labelGroup.append(label);
        this.#fields.set(key, { el: poly, item, farm, field });

        // touch taps select instead: a tooltip would cover the field being tapped
        poly.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && this.#hover(key, true));
        poly.addEventListener('pointerleave', () => this.#hover(key, false));
        poly.addEventListener('pointermove', (e) => this.#moveTooltip(e));
        poly.addEventListener('click', () => this.#select(key));
        poly.addEventListener('focus', () => this.#showInfo(farm, field));
        poly.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.#select(key);
          }
        });
        item.addEventListener('mouseenter', () => poly.classList.add('active'));
        item.addEventListener('mouseleave', () => key !== this.#selected && poly.classList.remove('active'));
        item.addEventListener('click', () => {
          this.#showFarm(farm.id);
          this.#select(key);
          this.#zoomTo(pts);
        });
      }
    }

    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const x = Math.min(...xs) - PAD;
    const y = Math.min(...ys) - PAD;
    this.#home = { x, y, w: Math.max(...xs) + PAD - x, h: Math.max(...ys) + PAD - y };
    this.#setView({ ...this.#home });
  }

  /** Turn a farm back on if its checkbox was cleared. @param {string} id */
  #showFarm(id) {
    const box = /** @type {HTMLInputElement | null | undefined} */ (
      this.shadowRoot?.querySelector(`input[data-farm="${id}"]`)
    );
    if (!box || box.checked) return;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
  }

  /** @param {ShadowRoot} root */
  #bindControls(root) {
    root.querySelectorAll('[data-zoom]').forEach((b) =>
      b.addEventListener('click', () => {
        const z = /** @type {HTMLElement} */ (b).dataset.zoom;
        if (z === 'reset') this.#setView({ ...this.#home });
        else this.#zoomAt(z === 'in' ? 0.7 : 1 / 0.7);
      })
    );
  }

  #bindPanZoom() {
    /** @type {{ id: number, x: number, y: number, moved: boolean } | null} */
    let drag = null;
    this.#stage.addEventListener('pointerdown', (e) => {
      if (/** @type {Element} */ (e.target).closest('.controls')) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    });
    this.#stage.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!drag.moved) {
        drag.moved = true;
        this.#stage.setPointerCapture(e.pointerId);
        this.#stage.classList.add('dragging');
        this.#tooltip.hidden = true;
      }
      const k = this.#unitsPerPixel();
      this.#setView({ ...this.#view, x: this.#view.x - dx * k, y: this.#view.y - dy * k });
      drag.x = e.clientX;
      drag.y = e.clientY;
    });
    const end = (/** @type {PointerEvent} */ e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved && e.type === 'pointerup') {
        // swallow the click that ends a drag so it does not select a field
        this.#stage.addEventListener('click', (c) => c.stopPropagation(), { capture: true, once: true });
      }
      this.#stage.classList.remove('dragging');
      drag = null;
    };
    this.#stage.addEventListener('pointerup', end);
    this.#stage.addEventListener('pointercancel', end);
    this.#stage.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.#zoomAt(Math.exp(e.deltaY * 0.0015), e);
      },
      { passive: false }
    );
  }

  /** Map units per screen pixel, allowing for the letterboxing of preserveAspectRatio. */
  #unitsPerPixel() {
    const r = this.#svg.getBoundingClientRect();
    return Math.max(this.#view.w / (r.width || 1), this.#view.h / (r.height || 1));
  }

  /** @param {number} factor @param {{ clientX: number, clientY: number }} [at] */
  #zoomAt(factor, at) {
    const r = this.#svg.getBoundingClientRect();
    const v = this.#view;
    const k = this.#unitsPerPixel();
    // map point under the cursor (or the centre) stays put
    const cx = v.x + v.w / 2 + ((at ? at.clientX : r.left + r.width / 2) - (r.left + r.width / 2)) * k;
    const cy = v.y + v.h / 2 + ((at ? at.clientY : r.top + r.height / 2) - (r.top + r.height / 2)) * k;
    const w = Math.min(Math.max(v.w * factor, this.#home.w / 20), this.#home.w * 3);
    const f = w / v.w;
    this.#setView({ x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f, w, h: v.h * f });
  }

  /** @param {Point[]} pts */
  #zoomTo(pts) {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 150) * 2.2;
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const aspect = this.#home.h / this.#home.w;
    this.#setView({ x: cx - size / 2, y: cy - (size * aspect) / 2, w: size, h: size * aspect });
  }

  /** @param {{ x: number, y: number, w: number, h: number }} v */
  #setView(v) {
    this.#view = v;
    this.#svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    // keep labels a constant size on screen
    const k = this.#unitsPerPixel();
    for (const t of this.#svg.querySelectorAll('.label')) {
      t.setAttribute('font-size', (12 * k).toFixed(2));
      t.setAttribute('style', `stroke-width:${(3 * k).toFixed(2)}px`);
    }
    this.#updateScale();
  }

  #updateScale() {
    if (!this.#scale) return;
    const k = this.#unitsPerPixel();
    if (!Number.isFinite(k) || k <= 0) return;
    // 1 furlong = 201.168 m; pick a round length near 100px on screen
    const target = 100 * k;
    const steps = [10, 20, 50, 100, 200, 500, 1000, 2000];
    const metres = steps.find((s) => s >= target * 0.6) ?? 2000;
    const bar = /** @type {HTMLElement} */ (this.#scale.querySelector('.bar'));
    bar.style.width = `${metres / k}px`;
    /** @type {HTMLElement} */ (this.#scale.querySelector('span')).textContent = `≈ ${metres} m`;
  }

  /** @param {string} key @param {boolean} on */
  #hover(key, on) {
    const f = this.#fields.get(key);
    if (!f) return;
    if (on) {
      this.#tooltip.innerHTML = fieldDetails(f.farm, f.field);
      this.#tooltip.hidden = false;
      if (!this.#selected) this.#showInfo(f.farm, f.field);
    } else {
      this.#tooltip.hidden = true;
    }
  }

  /** @param {PointerEvent} e */
  #moveTooltip(e) {
    const r = this.#stage.getBoundingClientRect();
    const t = this.#tooltip;
    const x = e.clientX - r.left + 14;
    const y = e.clientY - r.top + 14;
    t.style.left = `${Math.min(x, r.width - t.offsetWidth - 4)}px`;
    t.style.top = `${Math.min(y, r.height - t.offsetHeight - 4)}px`;
  }

  /** @param {string} key */
  #select(key) {
    if (this.#selected) {
      const prev = this.#fields.get(this.#selected);
      prev?.el.classList.remove('active');
      prev?.item.classList.remove('active');
    }
    const f = this.#fields.get(key);
    if (!f || this.#selected === key) {
      this.#selected = null;
      return;
    }
    this.#selected = key;
    f.el.classList.add('active');
    f.item.classList.add('active');
    this.#showInfo(f.farm, f.field);
  }

  /** @param {LeaseFarm} farm @param {LeaseField} field */
  #showInfo(farm, field) {
    this.#info.innerHTML = fieldDetails(farm, field);
  }
}

if (!customElements.get('ilmer-lease-map')) customElements.define('ilmer-lease-map', IlmerLeaseMap);
