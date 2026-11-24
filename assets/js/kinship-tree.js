/**
 * Interactive Ilmer Kinship Network & GEDCOM Family Tree Explorer.
 * Dynamically loads `/assets/ilmer-kinship.json` (and supports loading any local `.ged` file).
 */

const CARD_W = 192;
const CARD_H = 78;
const COL_STEP = 232;
const ROW_STEP = 168;
const PAD_X = 230;
const PAD_Y = 92;

const BADGE_ICON = {
  will: '\u{1F4DC}',
  memorial: '\u{1FAA6}',
  'war-dead': '\u271D',
  property: '\u2302'
};

const GEDCOM_PALETTE = [
  '#d97706',
  '#0284c7',
  '#16a34a',
  '#9333ea',
  '#e11d48',
  '#0d9488',
  '#4f46e5',
  '#ea580c',
  '#be185d',
  '#ca8a04'
];

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElCreate(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

function truncate(str, max) {
  return str.length > max ? `${str.slice(0, max - 1)}\u2026` : str;
}

function wrapText(str, maxChars, maxLines) {
  if (str.length <= maxChars) return [str];
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (`${cur} ${w}`.trim().length <= maxChars) {
      cur = `${cur} ${w}`.trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) {
        lines.push(truncate(words.slice(i).join(' '), maxChars));
        return lines;
      }
    }
  }
  if (cur) lines.push(truncate(cur, maxChars));
  return lines.slice(0, maxLines);
}

function orthoPath(pts, radius = 8) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const dx1 = x1 - x0;
    const dy1 = y1 - y0;
    const dx2 = x2 - x1;
    const dy2 = y2 - y1;
    const len1 = Math.hypot(dx1, dy1);
    const len2 = Math.hypot(dx2, dy2);
    const r = Math.min(radius, len1 / 2, len2 / 2);
    if (r < 0.5) {
      d += ` L ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    } else {
      const ax = x1 - (dx1 / len1) * r;
      const ay = y1 - (dy1 / len1) * r;
      const bx = x1 + (dx2 / len2) * r;
      const by = y1 + (dy2 / len2) * r;
      d += ` L ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${x1.toFixed(1)} ${y1.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
    }
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
  return d;
}

/**
 * Lightweight GEDCOM 7.0 / 5.5.1 parser + automatic topological layered layout.
 * Lets visitors drop or open any standard `.ged` file directly in the explorer.
 */
export function parseGedcomToView(text, fileName = 'Loaded GEDCOM') {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const indis = new Map();
  const fams = new Map();

  let curType = null;
  let curRec = null;
  let subTag = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Z0-9_]+)(?:\s+(.*))?$/.exec(line);
    if (!m) continue;
    const level = Number(m[1]);
    const xref = m[2] || '';
    const tag = m[3];
    const val = (m[4] || '').trim();

    if (level === 0) {
      subTag = null;
      if (tag === 'INDI' && xref) {
        curType = 'INDI';
        curRec = {
          id: xref,
          name: '',
          surname: 'unknown',
          sex: 'U',
          birth: '',
          baptism: '',
          death: '',
          occ: '',
          place: '',
          notes: []
        };
        indis.set(xref, curRec);
      } else if (tag === 'FAM' && xref) {
        curType = 'FAM';
        curRec = { id: xref, husb: '', wife: '', marr: '', children: [], note: '' };
        fams.set(xref, curRec);
      } else {
        curType = null;
        curRec = null;
      }
      continue;
    }

    if (!curRec) continue;

    if (curType === 'INDI') {
      if (level === 1) {
        subTag = tag;
        if (tag === 'NAME' && !curRec.name) {
          const snMatch = /\/([^/]+)\//.exec(val);
          curRec.surname = (snMatch ? snMatch[1] : val.split(/\s+/).pop() || 'family')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
          curRec.name = val.replace(/\//g, '').replace(/\s+/g, ' ').trim();
        } else if (tag === 'SEX') {
          curRec.sex = val;
        } else if (tag === 'OCCU' && !curRec.occ) {
          curRec.occ = val;
        } else if (tag === 'NOTE') {
          curRec.notes.push(val);
        }
      } else if (level === 2) {
        if (subTag === 'BIRT' && tag === 'DATE' && !curRec.birth) curRec.birth = val;
        if (subTag === 'BAPM' && tag === 'DATE' && !curRec.baptism) curRec.baptism = val;
        if ((subTag === 'DEAT' || subTag === 'BURI') && tag === 'DATE' && !curRec.death) curRec.death = val;
        if ((subTag === 'RESI' || subTag === 'BIRT') && tag === 'PLAC' && !curRec.place) curRec.place = val;
        if (subTag === 'NOTE' && tag === 'CONT') curRec.notes.push(val);
      }
    } else if (curType === 'FAM') {
      if (level === 1) {
        subTag = tag;
        if (tag === 'HUSB') curRec.husb = val;
        if (tag === 'WIFE') curRec.wife = val;
        if (tag === 'CHIL') curRec.children.push(val);
        if (tag === 'NOTE') curRec.note = val;
      } else if (level === 2 && subTag === 'MARR' && tag === 'DATE') {
        curRec.marr = val;
      }
    }
  }

  // Assign families/colors from surnames
  const families = {};
  let colorIdx = 0;
  for (const ind of indis.values()) {
    const key = ind.surname || 'family';
    if (!families[key]) {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      families[key] = { label, color: GEDCOM_PALETTE[colorIdx++ % GEDCOM_PALETTE.length] };
    }
  }

  // Topological generation assignment
  const parentsOf = new Map();
  const childrenOf = new Map();
  const spouseOf = new Map();
  for (const id of indis.keys()) {
    parentsOf.set(id, []);
    childrenOf.set(id, []);
    spouseOf.set(id, []);
  }
  for (const fam of fams.values()) {
    const ps = [fam.husb, fam.wife].filter((x) => x && indis.has(x));
    if (ps.length === 2) {
      spouseOf.get(ps[0]).push(ps[1]);
      spouseOf.get(ps[1]).push(ps[0]);
    }
    for (const c of fam.children) {
      if (!indis.has(c)) continue;
      for (const p of ps) {
        parentsOf.get(c).push(p);
        childrenOf.get(p).push(c);
      }
    }
  }

  const genMap = new Map();
  const roots = [...indis.keys()].filter((id) => parentsOf.get(id).length === 0);
  const queue = roots.map((id) => [id, 0]);
  while (queue.length) {
    const [id, g] = queue.shift();
    if ((genMap.get(id) ?? -1) >= g) continue;
    genMap.set(id, g);
    for (const c of childrenOf.get(id)) {
      queue.push([c, g + 1]);
    }
  }
  for (const id of indis.keys()) {
    if (!genMap.has(id)) genMap.set(id, 0);
  }
  // Align spouses onto the same generation row (max of the pair)
  for (let pass = 0; pass < 3; pass++) {
    for (const fam of fams.values()) {
      if (fam.husb && fam.wife && genMap.has(fam.husb) && genMap.has(fam.wife)) {
        const g = Math.max(genMap.get(fam.husb), genMap.get(fam.wife));
        genMap.set(fam.husb, g);
        genMap.set(fam.wife, g);
      }
    }
  }

  // Group into rows and lay out spouses side by side with 1.18 spacing
  const maxGen = Math.max(0, ...genMap.values());
  const byGen = Array.from({ length: maxGen + 1 }, () => []);
  for (const ind of indis.values()) {
    byGen[genMap.get(ind.id)].push(ind);
  }

  const colMap = new Map();
  for (let g = 0; g <= maxGen; g++) {
    const row = byGen[g];
    row.sort((a, b) => a.surname.localeCompare(b.surname) || a.name.localeCompare(b.name));
    const placed = new Set();
    let curCol = 0;
    for (const ind of row) {
      if (placed.has(ind.id)) continue;
      colMap.set(ind.id, curCol);
      placed.add(ind.id);
      const sp = spouseOf.get(ind.id).find((sid) => !placed.has(sid) && genMap.get(sid) === g);
      if (sp) {
        curCol += 1.18;
        colMap.set(sp, curCol);
        placed.add(sp);
      }
      curCol += 1.15;
    }
  }

  const cleanId = (xref) => `g_${xref.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
  const nodes = [...indis.values()].map((ind) => {
    const start = ind.birth || (ind.baptism ? `bap. ${ind.baptism}` : '');
    const dates = start && ind.death ? `${start}–${ind.death}` : start || (ind.death ? `d. ${ind.death}` : '');
    return {
      id: cleanId(ind.id),
      name: ind.name || ind.id,
      sex: ind.sex,
      dates,
      family: ind.surname || 'family',
      col: colMap.get(ind.id) ?? 0,
      gen: genMap.get(ind.id) ?? 0,
      occ: ind.occ,
      place: ind.place,
      badges: [],
      notes: ind.notes.join(' ') || `Imported from ${fileName}.`,
      sources: []
    };
  });

  const unions = [];
  const descents = [];
  let uSeq = 1;
  for (const fam of fams.values()) {
    const hasH = fam.husb && indis.has(fam.husb);
    const hasW = fam.wife && indis.has(fam.wife);
    let sourceRef = null;
    if (hasH && hasW && genMap.get(fam.husb) === genMap.get(fam.wife)) {
      const uid = `gu_${uSeq++}`;
      const p1 = cleanId(fam.husb);
      const p2 = cleanId(fam.wife);
      const cross = indis.get(fam.husb).surname !== indis.get(fam.wife).surname;
      unions.push({
        id: uid,
        p1,
        p2,
        year: fam.marr ? fam.marr.replace(/^ABT\s+/i, 'c.') : 'm.',
        crossFamily: cross,
        label: fam.note || undefined
      });
      sourceRef = uid;
    } else if (hasH) {
      sourceRef = cleanId(fam.husb);
    } else if (hasW) {
      sourceRef = cleanId(fam.wife);
    }
    if (sourceRef) {
      for (const c of fam.children) {
        if (indis.has(c)) {
          descents.push({ from: sourceRef, to: cleanId(c) });
        }
      }
    }
  }

  return {
    families,
    view: {
      title: fileName,
      subtitle: `Parsed ${nodes.length} individuals and ${fams.size} family records from GEDCOM.`,
      genLabels: Array.from({ length: maxGen + 1 }, (_, i) => [`Gen ${i + 1}`, '']),
      columnHeaders: [],
      nodes,
      unions,
      bridges: [],
      descents
    }
  };
}

function initKinshipExplorer() {
  const app = document.getElementById('kinship-app');
  if (!app) return;

  const dataUrl = app.dataset.kinshipUrl || '/assets/ilmer-kinship.json';
  const wrapEl = document.getElementById('kinship-canvas-wrap');
  const svgEl = document.getElementById('kinship-svg');
  const vpEl = document.getElementById('kinship-viewport');
  const layerBands = document.getElementById('layer-bands');
  const layerHeaders = document.getElementById('layer-headers');
  const layerEdges = document.getElementById('layer-edges');
  const layerUnions = document.getElementById('layer-unions');
  const layerNodes = document.getElementById('layer-nodes');
  const layerBridgePills = document.getElementById('layer-bridge-pills');
  const filtersEl = document.getElementById('family-filters');
  const drawerEl = document.getElementById('dossier-drawer');
  const loadingEl = document.getElementById('kinship-loading');
  const zoomReadout = document.getElementById('zoom-readout');
  const selBanner = document.getElementById('selection-banner');
  const selBannerText = document.getElementById('selection-banner-text');
  const btnBridges = document.getElementById('btn-bridges');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const searchInput = document.getElementById('kinship-search-input');
  const searchResults = document.getElementById('kinship-search-results');
  const gedcomUpload = document.getElementById('gedcom-upload');
  const customTab = document.getElementById('tab-custom');

  let dataset = null;
  let customData = null;
  let currentView = 'village';
  let activeFamily = 'all';
  let selectedNodeId = null;
  let showBridgesOnly = false;

  let scale = 0.6;
  let panX = 20;
  let panY = 20;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  function getFamilies() {
    if (currentView === 'custom' && customData) return customData.families;
    return dataset ? dataset.families : {};
  }

  function getData() {
    if (currentView === 'custom' && customData) return customData.view;
    return dataset ? dataset.views[currentView] : null;
  }

  function nodePos(n) {
    return { x: PAD_X + n.col * COL_STEP, y: PAD_Y + n.gen * ROW_STEP };
  }

  function applyTransform() {
    vpEl.setAttribute('transform', `translate(${panX.toFixed(1)}, ${panY.toFixed(1)}) scale(${scale.toFixed(3)})`);
    zoomReadout.textContent = `${Math.round(scale * 100)}%`;
  }

  function fitToView() {
    const data = getData();
    if (!data || !data.nodes.length) return;
    const minX = 16;
    const minY = 16;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of data.nodes) {
      const p = nodePos(n);
      maxX = Math.max(maxX, p.x + CARD_W + 48);
      maxY = Math.max(maxY, p.y + CARD_H + 50);
    }
    const rect = wrapEl.getBoundingClientRect();
    const availW = Math.max(rect.width, 320);
    const availH = Math.max(rect.height, 260);
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    scale = Math.min(1.0, Math.max(0.16, Math.min(availW / contentW, availH / contentH) * 0.94));
    panX = (availW - contentW * scale) / 2 - minX * scale;
    panY = (availH - contentH * scale) / 2 - minY * scale;
    applyTransform();
  }

  function centerOnNode(id) {
    const data = getData();
    if (!data) return;
    const n = data.nodes.find((x) => x.id === id);
    if (!n) return;
    const p = nodePos(n);
    const rect = wrapEl.getBoundingClientRect();
    scale = Math.max(scale, 0.84);
    panX = rect.width / 2 - (p.x + CARD_W / 2) * scale;
    panY = rect.height / 2 - (p.y + CARD_H / 2) * scale;
    applyTransform();
  }

  function buildGraph(data) {
    const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
    const unionMap = new Map(data.unions.map((u) => [u.id, u]));
    const parentsOf = new Map();
    const childrenOf = new Map();
    const spousesOf = new Map();

    for (const n of data.nodes) {
      parentsOf.set(n.id, []);
      childrenOf.set(n.id, []);
      spousesOf.set(n.id, []);
    }

    for (const u of data.unions) {
      if (spousesOf.has(u.p1) && spousesOf.has(u.p2)) {
        spousesOf.get(u.p1).push({ id: u.p2, union: u });
        spousesOf.get(u.p2).push({ id: u.p1, union: u });
      }
    }

    for (const d of data.descents) {
      if (unionMap.has(d.from)) {
        const u = unionMap.get(d.from);
        parentsOf.get(d.to)?.push(u.p1, u.p2);
        childrenOf.get(u.p1)?.push(d.to);
        childrenOf.get(u.p2)?.push(d.to);
      } else if (nodeMap.has(d.from)) {
        parentsOf.get(d.to)?.push(d.from);
        childrenOf.get(d.from)?.push(d.to);
      }
    }

    return { nodeMap, unionMap, parentsOf, childrenOf, spousesOf };
  }

  function getConnectedLineage(startId, graph) {
    const related = new Set([startId]);
    const upQ = [startId];
    while (upQ.length) {
      const cur = upQ.shift();
      for (const p of graph.parentsOf.get(cur) || []) {
        if (!related.has(p)) {
          related.add(p);
          upQ.push(p);
        }
      }
    }
    const downQ = [startId];
    while (downQ.length) {
      const cur = downQ.shift();
      for (const c of graph.childrenOf.get(cur) || []) {
        if (!related.has(c)) {
          related.add(c);
          downQ.push(c);
        }
      }
    }
    for (const id of [...related]) {
      for (const s of graph.spousesOf.get(id) || []) {
        related.add(s.id);
      }
    }
    return related;
  }

  function renderFilters() {
    const data = getData();
    const families = getFamilies();
    filtersEl.textContent = '';
    if (!data) return;

    const famKeys = [...new Set(data.nodes.map((n) => n.family))];

    const mkPill = (key, label, dotColor) => {
      const active = activeFamily === key;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kinship-pill';
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (dotColor) {
        const dot = document.createElement('span');
        dot.className = 'kinship-dot';
        dot.style.background = active ? '#ffffff' : dotColor;
        btn.appendChild(dot);
      }
      btn.appendChild(document.createTextNode(label));
      btn.addEventListener('click', () => {
        activeFamily = key;
        selectedNodeId = null;
        showBridgesOnly = false;
        btnBridges.setAttribute('aria-pressed', 'false');
        closeDrawer(false);
        renderFilters();
        updateHighlights();
      });
      return btn;
    };

    filtersEl.appendChild(mkPill('all', `All (${data.nodes.length})`, null));
    for (const f of famKeys) {
      const meta = families[f] || { label: f, color: '#64748b' };
      filtersEl.appendChild(mkPill(f, meta.label, meta.color));
    }
  }

  function renderTree() {
    const data = getData();
    const families = getFamilies();
    if (!data) return;

    const graph = buildGraph(data);
    layerBands.textContent = '';
    layerHeaders.textContent = '';
    layerEdges.textContent = '';
    layerUnions.textContent = '';
    layerNodes.textContent = '';
    layerBridgePills.textContent = '';

    const maxCol = Math.max(0, ...data.nodes.map((n) => n.col));
    const totalWidth = PAD_X + maxCol * COL_STEP + CARD_W + 48;
    const totalHeight = PAD_Y + (data.genLabels.length - 1) * ROW_STEP + CARD_H + 40;

    // 1. Generation horizontal bands + left rail
    data.genLabels.forEach(([title, era], idx) => {
      const y = PAD_Y + idx * ROW_STEP - 26;
      if (idx % 2 === 1) {
        layerBands.appendChild(
          svgElCreate('rect', {
            x: 16,
            y,
            width: totalWidth - 16,
            height: ROW_STEP,
            rx: 8,
            fill: '#f6f1e6',
            opacity: '0.75'
          })
        );
      }
      const t1 = svgElCreate('text', {
        x: 30,
        y: y + 58,
        fill: '#1d1d1a',
        'font-size': '12',
        'font-weight': '700'
      });
      t1.textContent = title;
      layerBands.appendChild(t1);

      if (era) {
        const t2 = svgElCreate('text', {
          x: 30,
          y: y + 74,
          fill: '#5c5346',
          'font-size': '11'
        });
        t2.textContent = era;
        layerBands.appendChild(t2);
      }
    });

    layerBands.appendChild(
      svgElCreate('line', {
        x1: PAD_X - 24,
        y1: 24,
        x2: PAD_X - 24,
        y2: totalHeight,
        stroke: '#cbbda0',
        'stroke-width': '1',
        'stroke-dasharray': '4 4'
      })
    );

    // 2. Top Family Column Headers
    for (const hdr of data.columnHeaders || []) {
      const fam = families[hdr.family] || { color: '#64748b' };
      const x1 = PAD_X + hdr.startCol * COL_STEP;
      const x2 = PAD_X + hdr.endCol * COL_STEP + CARD_W;
      const w = x2 - x1;
      layerHeaders.appendChild(
        svgElCreate('rect', {
          x: x1,
          y: 26,
          width: w,
          height: 28,
          rx: 6,
          fill: '#fbf8f1',
          stroke: fam.color,
          'stroke-width': '1.2'
        })
      );
      layerHeaders.appendChild(
        svgElCreate('rect', {
          x: x1,
          y: 26,
          width: w,
          height: 4,
          rx: 2,
          fill: fam.color
        })
      );
      const ht = svgElCreate('text', {
        x: x1 + w / 2,
        y: 45,
        'text-anchor': 'middle',
        fill: fam.color,
        'font-size': '11',
        'font-weight': '700',
        'letter-spacing': '0.05em'
      });
      ht.textContent = hdr.label;
      layerHeaders.appendChild(ht);
    }

    // Union hubs
    const unionHub = new Map();
    for (const u of data.unions) {
      const n1 = graph.nodeMap.get(u.p1);
      const n2 = graph.nodeMap.get(u.p2);
      if (!n1 || !n2) continue;
      const p1 = nodePos(n1);
      const p2 = nodePos(n2);
      const left = p1.x < p2.x ? p1 : p2;
      const right = p1.x < p2.x ? p2 : p1;
      const x1 = left.x + CARD_W;
      const x2 = right.x;
      const y = (p1.y + p2.y) / 2 + CARD_H / 2;
      unionHub.set(u.id, { x: (x1 + x2) / 2, y, x1, x2, u });
    }

    // 3. Orthogonal Bus Descent Edges
    const busGroups = new Map();
    for (const d of data.descents) {
      let sx;
      let sy;
      let sGen;
      let sourceNodeIds;
      if (unionHub.has(d.from)) {
        const h = unionHub.get(d.from);
        sx = h.x;
        sy = h.y;
        sGen = graph.nodeMap.get(h.u.p1).gen;
        sourceNodeIds = [h.u.p1, h.u.p2];
      } else {
        const sn = graph.nodeMap.get(d.from);
        if (!sn) continue;
        const sp = nodePos(sn);
        sx = sp.x + CARD_W / 2;
        sy = sp.y + CARD_H;
        sGen = sn.gen;
        sourceNodeIds = [d.from];
      }
      const tn = graph.nodeMap.get(d.to);
      if (!tn) continue;
      const tp = nodePos(tn);
      const tx = tp.x + CARD_W / 2;
      const ty = tp.y;

      const corridorTop = PAD_Y + (tn.gen - 1) * ROW_STEP + CARD_H;
      const key = `${d.from}|${tn.gen}`;
      if (!busGroups.has(key)) busGroups.set(key, { sGen, tGen: tn.gen, corridorTop, items: [] });
      busGroups.get(key).items.push({ d, sx, sy, tx, ty, sourceNodeIds, tn });
    }

    const corridorCounter = new Map();
    for (const grp of busGroups.values()) {
      const idx = corridorCounter.get(grp.tGen) || 0;
      corridorCounter.set(grp.tGen, idx + 1);
      const busY = grp.corridorTop + 34 + (idx % 3) * 8;

      for (const { d, sx, sy, tx, ty, sourceNodeIds, tn } of grp.items) {
        let pts;
        if (Math.abs(sx - tx) < 1.5 && tn.gen === grp.sGen + 1) {
          pts = [
            [sx, sy],
            [tx, ty]
          ];
        } else if (tn.gen > grp.sGen + 1) {
          const dropY = PAD_Y + grp.sGen * ROW_STEP + CARD_H + 38;
          pts = [
            [sx, sy],
            [sx, dropY],
            [tx, dropY],
            [tx, ty]
          ];
        } else {
          pts = [
            [sx, sy],
            [sx, busY],
            [tx, busY],
            [tx, ty]
          ];
        }

        layerEdges.appendChild(
          svgElCreate('path', {
            d: orthoPath(pts, 8),
            class: 'edge-path',
            stroke: '#766c5c',
            'stroke-width': d.dashed ? '1.5' : '1.7',
            'stroke-dasharray': d.dashed ? '5 4' : 'none',
            opacity: '0.68',
            'data-sources': sourceNodeIds.join(','),
            'data-target': d.to,
            'data-kind': 'descent'
          })
        );
      }
    }

    // 4. Corridor-Routed Intermarriage Bridges
    for (const b of data.bridges || []) {
      const n1 = graph.nodeMap.get(b.from);
      const n2 = graph.nodeMap.get(b.to);
      if (!n1 || !n2) continue;
      const p1 = nodePos(n1);
      const p2 = nodePos(n2);
      const laneY = PAD_Y + b.corridorAfterGen * ROW_STEP + CARD_H + b.laneOffset;
      const x1 = p1.x + CARD_W / 2;
      const y1 = laneY < p1.y ? p1.y : p1.y + CARD_H;
      const x2 = p2.x + CARD_W / 2;
      const y2 = laneY < p2.y ? p2.y : p2.y + CARD_H;

      const g = svgElCreate('g', {
        class: 'bridge-group',
        'data-sources': `${b.from},${b.to}`,
        'data-kind': 'bridge'
      });
      g.appendChild(
        svgElCreate('path', {
          d: orthoPath(
            [
              [x1, y1],
              [x1, laneY],
              [x2, laneY],
              [x2, y2]
            ],
            10
          ),
          class: 'edge-path',
          stroke: '#b3541a',
          'stroke-width': '1.9',
          'stroke-dasharray': '6 4',
          opacity: '0.85'
        })
      );
      g.appendChild(svgElCreate('circle', { cx: x1, cy: y1, r: 3, fill: '#b3541a' }));
      g.appendChild(svgElCreate('circle', { cx: x2, cy: y2, r: 3, fill: '#b3541a' }));
      layerEdges.appendChild(g);

      const pillX = PAD_X + b.pillCol * COL_STEP + CARD_W / 2;
      const pillW = Math.round(b.label.length * 6.0 + 18);
      const pillH = 20;
      const pg = svgElCreate('g', {
        class: 'bridge-group',
        'data-sources': `${b.from},${b.to}`,
        'data-kind': 'bridge-pill'
      });
      pg.appendChild(
        svgElCreate('rect', {
          x: pillX - pillW / 2,
          y: laneY - pillH / 2,
          width: pillW,
          height: pillH,
          rx: 10,
          fill: '#fbf8f1',
          stroke: '#b3541a',
          'stroke-width': '1.2'
        })
      );
      const lbl = svgElCreate('text', {
        x: pillX,
        y: laneY + 3.5,
        'text-anchor': 'middle',
        fill: '#1d1d1a',
        'font-size': '10',
        'font-weight': '650'
      });
      lbl.textContent = b.label;
      pg.appendChild(lbl);
      pg.addEventListener('click', (e) => {
        e.stopPropagation();
        selectNode(b.from, false);
      });
      layerBridgePills.appendChild(pg);
    }

    // 5. Gutter-Routed Manor Transfers
    for (const gb of data.gutterBridges || []) {
      const n1 = graph.nodeMap.get(gb.from);
      const n2 = graph.nodeMap.get(gb.to);
      if (!n1 || !n2) continue;
      const p1 = nodePos(n1);
      const p2 = nodePos(n2);
      const gx = PAD_X + gb.gutterCol * COL_STEP + CARD_W / 2;
      const x1 = p1.x + CARD_W;
      const y1 = p1.y + CARD_H / 2;
      const x2 = p2.x;
      const y2 = p2.y + CARD_H / 2;

      const g = svgElCreate('g', {
        class: 'bridge-group',
        'data-sources': `${gb.from},${gb.to}`,
        'data-kind': 'bridge'
      });
      g.appendChild(
        svgElCreate('path', {
          d: orthoPath(
            [
              [x1, y1],
              [gx, y1],
              [gx, y2],
              [x2, y2]
            ],
            12
          ),
          class: 'edge-path',
          stroke: '#b3541a',
          'stroke-width': '2',
          'stroke-dasharray': '6 4',
          opacity: '0.85'
        })
      );
      layerEdges.appendChild(g);

      const py = PAD_Y + gb.pillGen * ROW_STEP + CARD_H / 2;
      const pillW = Math.round(gb.label.length * 6.0 + 18);
      const pillH = 22;
      const pg = svgElCreate('g', {
        class: 'bridge-group',
        'data-sources': `${gb.from},${gb.to}`,
        'data-kind': 'bridge-pill'
      });
      pg.appendChild(
        svgElCreate('rect', {
          x: gx - pillW / 2,
          y: py - pillH / 2,
          width: pillW,
          height: pillH,
          rx: 11,
          fill: '#fbf8f1',
          stroke: '#b3541a',
          'stroke-width': '1.2'
        })
      );
      const lbl = svgElCreate('text', {
        x: gx,
        y: py + 3.5,
        'text-anchor': 'middle',
        fill: '#1d1d1a',
        'font-size': '10',
        'font-weight': '650'
      });
      lbl.textContent = gb.label;
      pg.appendChild(lbl);
      layerBridgePills.appendChild(pg);
    }

    // 6. Spouse Union Bars
    for (const u of data.unions) {
      const h = unionHub.get(u.id);
      if (!h) continue;
      const g = svgElCreate('g', {
        class: 'union-group',
        'data-sources': `${u.p1},${u.p2}`,
        'data-cross': u.crossFamily ? '1' : '0',
        'data-kind': 'union'
      });
      g.appendChild(
        svgElCreate('line', {
          x1: h.x1,
          y1: h.y,
          x2: h.x2,
          y2: h.y,
          stroke: u.crossFamily ? '#b3541a' : '#766c5c',
          'stroke-width': u.crossFamily ? '2.8' : '2',
          class: 'edge-path'
        })
      );
      g.appendChild(
        svgElCreate('circle', {
          cx: h.x,
          cy: h.y,
          r: u.crossFamily ? 4.5 : 3.5,
          fill: u.crossFamily ? '#b3541a' : '#fbf8f1',
          stroke: u.crossFamily ? '#b3541a' : '#766c5c',
          'stroke-width': '1.8'
        })
      );
      const txt = u.year.startsWith('m.') ? u.year : `m. ${u.year}`;
      const pw = Math.round(txt.length * 5.8 + 10);
      g.appendChild(
        svgElCreate('rect', {
          x: h.x - pw / 2,
          y: h.y - 25,
          width: pw,
          height: 16,
          rx: 8,
          fill: '#fbf8f1',
          stroke: u.crossFamily ? '#b3541a' : '#cbbda0',
          'stroke-width': '1'
        })
      );
      const yt = svgElCreate('text', {
        x: h.x,
        y: h.y - 14,
        'text-anchor': 'middle',
        fill: u.crossFamily ? '#b3541a' : '#5c5346',
        'font-size': '9.5',
        'font-weight': '700'
      });
      yt.textContent = txt;
      g.appendChild(yt);
      layerUnions.appendChild(g);
    }

    // 7. Person Cards
    for (const n of data.nodes) {
      const p = nodePos(n);
      const fam = families[n.family] || { color: '#64748b' };
      const icons = (n.badges || []).map((b) => BADGE_ICON[b]).filter(Boolean);

      const g = svgElCreate('g', {
        class: 'person-node',
        transform: `translate(${p.x}, ${p.y})`,
        tabindex: '0',
        role: 'button',
        'aria-label': `${n.name}${n.dates ? `, ${n.dates}` : ''}`,
        'data-id': n.id,
        'data-family': n.family
      });

      g.appendChild(
        svgElCreate('rect', {
          class: 'node-card',
          width: CARD_W,
          height: CARD_H,
          rx: 8,
          fill: '#ffffff',
          stroke: fam.color,
          'stroke-width': '1.3'
        })
      );
      g.appendChild(
        svgElCreate('rect', {
          x: 0,
          y: 0,
          width: 5,
          height: CARD_H,
          rx: 2,
          fill: fam.color
        })
      );

      const nameLines = wrapText(n.name, 23, 2);
      nameLines.forEach((line, li) => {
        const nt = svgElCreate('text', {
          x: 13,
          y: 20 + li * 14.5,
          fill: '#1d1d1a',
          'font-size': '11.5',
          'font-weight': '650'
        });
        nt.textContent = line;
        g.appendChild(nt);
      });

      const dateY = nameLines.length > 1 ? 50 : 39;
      if (n.dates) {
        const dt = svgElCreate('text', {
          x: 13,
          y: dateY,
          fill: '#5c5346',
          'font-size': '10'
        });
        dt.textContent = truncate(n.dates, 28);
        g.appendChild(dt);
      }

      const sub = n.place || n.occ || '';
      const maxSubChars = icons.length === 0 ? 27 : icons.length === 1 ? 22 : 17;
      if (sub) {
        const st = svgElCreate('text', {
          x: 13,
          y: 68,
          fill: fam.color,
          'font-size': '9.8',
          'font-weight': '600'
        });
        st.textContent = truncate(sub, maxSubChars);
        g.appendChild(st);
      }

      if (icons.length) {
        const bt = svgElCreate('text', {
          x: CARD_W - 8,
          y: 68,
          'text-anchor': 'end',
          'font-size': '10.5'
        });
        bt.textContent = icons.join(' ');
        g.appendChild(bt);
      }

      const activate = (e) => {
        e.stopPropagation();
        selectNode(n.id, false);
      };
      g.addEventListener('click', activate);
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate(e);
        }
      });

      layerNodes.appendChild(g);
    }

    updateHighlights();
  }

  function updateHighlights() {
    const data = getData();
    const families = getFamilies();
    if (!data) return;
    const graph = buildGraph(data);

    let activeSet = null;
    if (selectedNodeId) {
      activeSet = getConnectedLineage(selectedNodeId, graph);
      const sel = graph.nodeMap.get(selectedNodeId);
      selBanner.hidden = false;
      selBannerText.textContent = `Tracing lineage of ${sel ? sel.name : ''} (${activeSet.size} connected)`;
    } else if (showBridgesOnly) {
      activeSet = new Set();
      for (const u of data.unions.filter((x) => x.crossFamily)) {
        activeSet.add(u.p1);
        activeSet.add(u.p2);
      }
      for (const b of data.bridges || []) {
        activeSet.add(b.from);
        activeSet.add(b.to);
      }
      for (const b of data.gutterBridges || []) {
        activeSet.add(b.from);
        activeSet.add(b.to);
      }
      selBanner.hidden = false;
      selBannerText.textContent = 'Highlighting cross-family intermarriage bridges';
    } else if (activeFamily !== 'all') {
      activeSet = new Set(data.nodes.filter((n) => n.family === activeFamily).map((n) => n.id));
      for (const id of [...activeSet]) {
        for (const s of graph.spousesOf.get(id) || []) activeSet.add(s.id);
      }
      selBanner.hidden = false;
      selBannerText.textContent = `Filtering: ${(families[activeFamily] || {}).label || activeFamily}`;
    } else {
      selBanner.hidden = true;
    }

    for (const el of layerNodes.querySelectorAll('.person-node')) {
      const id = el.getAttribute('data-id');
      const card = el.querySelector('.node-card');
      el.classList.toggle('dimmed', Boolean(activeSet && !activeSet.has(id)));
      card?.setAttribute('stroke-width', id === selectedNodeId ? '3' : '1.3');
    }

    for (const el of layerEdges.querySelectorAll('path[data-kind="descent"]')) {
      const srcs = (el.getAttribute('data-sources') || '').split(',');
      const tgt = el.getAttribute('data-target');
      el.classList.remove('dimmed', 'highlighted-edge');
      if (showBridgesOnly) {
        el.classList.add('dimmed');
      } else if (activeSet) {
        const hit = activeSet.has(tgt) && srcs.some((s) => activeSet.has(s));
        el.classList.add(hit ? 'highlighted-edge' : 'dimmed');
      }
    }

    const updateBridge = (el) => {
      const srcs = (el.getAttribute('data-sources') || '').split(',');
      el.classList.remove('dimmed');
      const p = el.querySelector('path');
      p?.classList.remove('bridge-pulse');
      if (showBridgesOnly) {
        p?.classList.add('bridge-pulse');
      } else if (activeSet) {
        if (srcs.some((s) => activeSet.has(s))) {
          p?.classList.add('bridge-pulse');
        } else {
          el.classList.add('dimmed');
        }
      }
    };
    for (const el of layerEdges.querySelectorAll('.bridge-group')) updateBridge(el);
    for (const el of layerBridgePills.querySelectorAll('.bridge-group')) updateBridge(el);

    for (const el of layerUnions.querySelectorAll('.union-group')) {
      const srcs = (el.getAttribute('data-sources') || '').split(',');
      const isCross = el.getAttribute('data-cross') === '1';
      el.classList.remove('dimmed');
      if (showBridgesOnly) {
        if (!isCross) el.classList.add('dimmed');
      } else if (activeSet && !srcs.some((s) => activeSet.has(s))) {
        el.classList.add('dimmed');
      }
    }
  }

  function makeChip(person, families, extraText) {
    const pf = families[person.family] || { color: '#64748b' };
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kinship-chip';
    const left = document.createElement('span');
    left.className = 'kinship-chip-left';
    const dot = document.createElement('span');
    dot.className = 'kinship-dot';
    dot.style.background = pf.color;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'kinship-chip-name';
    nameSpan.textContent = person.name;
    left.append(dot, nameSpan);

    const right = document.createElement('span');
    right.className = 'kinship-chip-extra';
    right.textContent = extraText || person.dates;

    btn.append(left, right);
    btn.addEventListener('click', () => selectNode(person.id, true));
    return btn;
  }

  function selectNode(id, shouldCenter = false) {
    const data = getData();
    const families = getFamilies();
    if (!data) return;
    const graph = buildGraph(data);
    const n = graph.nodeMap.get(id);
    if (!n) return;

    selectedNodeId = id;
    showBridgesOnly = false;
    btnBridges.setAttribute('aria-pressed', 'false');
    updateHighlights();
    if (shouldCenter) centerOnNode(id);

    const fam = families[n.family] || { label: n.family, color: '#64748b' };
    const badgeEl = document.getElementById('d-family-badge');
    badgeEl.textContent = '';
    const dot = document.createElement('span');
    dot.className = 'kinship-dot';
    dot.style.background = fam.color;
    const famSpan = document.createElement('span');
    famSpan.textContent = fam.label;
    badgeEl.style.color = fam.color;
    badgeEl.append(dot, famSpan);

    document.getElementById('d-name').textContent = n.name;
    const icons = (n.badges || []).map((b) => BADGE_ICON[b]).filter(Boolean);
    document.getElementById('d-dates').textContent = icons.length ? `${n.dates}  \u00b7  ${icons.join(' ')}` : n.dates;

    const parents = [...new Set(graph.parentsOf.get(id) || [])].map((pid) => graph.nodeMap.get(pid)).filter(Boolean);
    const spouses = (graph.spousesOf.get(id) || [])
      .map((s) => ({ person: graph.nodeMap.get(s.id), year: s.union.year }))
      .filter((s) => s.person);
    const children = [...new Set(graph.childrenOf.get(id) || [])].map((cid) => graph.nodeMap.get(cid)).filter(Boolean);
    const nodeBridges = [...(data.bridges || []), ...(data.gutterBridges || [])].filter(
      (b) => b.from === id || b.to === id
    );

    const body = document.getElementById('d-body');
    body.textContent = '';

    // Occupation & residence grid
    const grid = document.createElement('div');
    grid.className = 'kinship-meta-grid';
    for (const [label, val] of [
      ['Occupation / Role', n.occ || '\u2014'],
      ['Residence / Place', n.place || '\u2014']
    ]) {
      const box = document.createElement('div');
      box.className = 'kinship-meta-box';
      const lEl = document.createElement('div');
      lEl.className = 'kinship-meta-label';
      lEl.textContent = label;
      const vEl = document.createElement('div');
      vEl.className = 'kinship-meta-val';
      vEl.textContent = val;
      box.append(lEl, vEl);
      grid.appendChild(box);
    }
    body.appendChild(grid);

    // Individual members when this visual card groups a couple or sibling set
    if (n.members && n.members.length) {
      const sec = document.createElement('div');
      const h = document.createElement('h3');
      h.className = 'kinship-section-title';
      h.textContent =
        n.groupKind === 'couple'
          ? 'Married Couple (Individual GEDCOM Records)'
          : `Individuals in this Group (${n.members.length})`;
      const list = document.createElement('div');
      list.className = 'kinship-chip-list';
      for (const m of n.members) {
        const row = document.createElement('div');
        row.className = 'kinship-meta-box';
        const mName = document.createElement('div');
        mName.className = 'kinship-meta-val';
        mName.textContent = m.name;
        const mDates = [
          m.birth ? `b. ${m.birth}` : '',
          m.baptism ? `bap. ${m.baptism}` : '',
          m.death ? `d. ${m.death}` : '',
          m.burial ? `bur. ${m.burial}` : ''
        ]
          .filter(Boolean)
          .join(' \u00b7 ');
        const mMeta = document.createElement('div');
        mMeta.className = 'kinship-meta-label';
        mMeta.textContent = [mDates, m.place].filter(Boolean).join(' \u2014 ') || m.occ || '';
        row.append(mName, mMeta);
        list.appendChild(row);
      }
      sec.append(h, list);
      body.appendChild(sec);
    }

    // Notes
    if (n.notes) {
      const sec = document.createElement('div');
      const h = document.createElement('h3');
      h.className = 'kinship-section-title';
      h.textContent = 'Biographical Notes';
      const p = document.createElement('p');
      p.className = 'kinship-notes';
      p.textContent = n.notes;
      sec.append(h, p);
      body.appendChild(sec);
    }

    const addGroup = (title, items, fmtExtra) => {
      if (!items.length) return;
      const sec = document.createElement('div');
      const h = document.createElement('h3');
      h.className = 'kinship-section-title';
      h.textContent = title;
      const list = document.createElement('div');
      list.className = 'kinship-chip-list';
      for (const item of items) {
        list.appendChild(makeChip(item.person || item, families, fmtExtra ? fmtExtra(item) : ''));
      }
      sec.append(h, list);
      body.appendChild(sec);
    };

    addGroup('Parents', parents);
    addGroup('Spouse / Marriage', spouses, (s) => (s.year.startsWith('m.') ? s.year : `m. ${s.year}`));
    addGroup(`Children in Diagram (${children.length})`, children);

    if (nodeBridges.length) {
      const sec = document.createElement('div');
      const h = document.createElement('h3');
      h.className = 'kinship-section-title';
      h.textContent = 'Cross-Family Bridges';
      const list = document.createElement('div');
      list.className = 'kinship-chip-list';
      for (const b of nodeBridges) {
        const div = document.createElement('div');
        div.className = 'kinship-bridge-note';
        div.textContent = b.label;
        list.appendChild(div);
      }
      sec.append(h, list);
      body.appendChild(sec);
    }

    if (n.sources && n.sources.length) {
      const sec = document.createElement('div');
      const h = document.createElement('h3');
      h.className = 'kinship-section-title';
      h.textContent = 'Ilmer.org Sources';
      const ul = document.createElement('ul');
      ul.className = 'kinship-sources';
      for (const src of n.sources) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = src.url;
        a.textContent = src.label;
        li.appendChild(a);
        ul.appendChild(li);
      }
      sec.append(h, ul);
      body.appendChild(sec);
    }

    drawerEl.hidden = false;
  }

  function closeDrawer(clearSelection = true) {
    drawerEl.hidden = true;
    if (clearSelection) {
      selectedNodeId = null;
      updateHighlights();
    }
  }

  function switchView(view) {
    currentView = view;
    activeFamily = 'all';
    selectedNodeId = null;
    showBridgesOnly = false;
    btnBridges.setAttribute('aria-pressed', 'false');
    closeDrawer(false);

    for (const tab of app.querySelectorAll('.kinship-tab')) {
      tab.setAttribute('aria-selected', tab.dataset.view === view ? 'true' : 'false');
    }

    renderFilters();
    renderTree();
    fitToView();
  }

  // Pan & Zoom
  wrapEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.person-node') || e.target.closest('.bridge-group')) return;
    isDragging = true;
    wrapEl.classList.add('is-dragging');
    dragStartX = e.clientX - panX;
    dragStartY = e.clientY - panY;
    wrapEl.setPointerCapture(e.pointerId);
  });
  wrapEl.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    panX = e.clientX - dragStartX;
    panY = e.clientY - dragStartY;
    applyTransform();
  });
  wrapEl.addEventListener('pointerup', () => {
    isDragging = false;
    wrapEl.classList.remove('is-dragging');
  });
  wrapEl.addEventListener('pointercancel', () => {
    isDragging = false;
    wrapEl.classList.remove('is-dragging');
  });

  svgEl.addEventListener('click', () => {
    if (selectedNodeId) closeDrawer(true);
  });

  wrapEl.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const rect = wrapEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const nextScale = Math.min(2.2, Math.max(0.16, scale * factor));
      const ratio = nextScale / scale;
      panX = mx - (mx - panX) * ratio;
      panY = my - (my - panY) * ratio;
      scale = nextScale;
      applyTransform();
    },
    { passive: false }
  );

  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    const r = wrapEl.getBoundingClientRect();
    const ns = Math.min(2.2, scale * 1.2);
    panX = r.width / 2 - (r.width / 2 - panX) * (ns / scale);
    panY = r.height / 2 - (r.height / 2 - panY) * (ns / scale);
    scale = ns;
    applyTransform();
  });
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    const r = wrapEl.getBoundingClientRect();
    const ns = Math.max(0.16, scale / 1.2);
    panX = r.width / 2 - (r.width / 2 - panX) * (ns / scale);
    panY = r.height / 2 - (r.height / 2 - panY) * (ns / scale);
    scale = ns;
    applyTransform();
  });
  document.getElementById('btn-fit')?.addEventListener('click', fitToView);
  document.getElementById('btn-close-drawer')?.addEventListener('click', () => closeDrawer(true));
  document.getElementById('btn-clear-selection')?.addEventListener('click', () => {
    activeFamily = 'all';
    showBridgesOnly = false;
    btnBridges.setAttribute('aria-pressed', 'false');
    closeDrawer(true);
    renderFilters();
    updateHighlights();
  });

  btnBridges?.addEventListener('click', () => {
    showBridgesOnly = !showBridgesOnly;
    if (showBridgesOnly) {
      selectedNodeId = null;
      activeFamily = 'all';
      closeDrawer(false);
      renderFilters();
    }
    btnBridges.setAttribute('aria-pressed', showBridgesOnly ? 'true' : 'false');
    updateHighlights();
  });

  btnFullscreen?.addEventListener('click', () => {
    const next = !app.classList.contains('is-fullscreen');
    app.classList.toggle('is-fullscreen', next);
    btnFullscreen.setAttribute('aria-pressed', next ? 'true' : 'false');
    btnFullscreen.textContent = next ? 'Exit fullscreen' : 'Fullscreen';
    requestAnimationFrame(fitToView);
  });

  for (const tab of app.querySelectorAll('.kinship-tab')) {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  }

  // Search across loaded views
  searchInput?.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q || !dataset) {
      searchResults.hidden = true;
      return;
    }
    const viewsToSearch = [
      ['village', dataset.views.village, dataset.families],
      ['manor', dataset.views.manor, dataset.families]
    ];
    if (customData) viewsToSearch.push(['custom', customData.view, customData.families]);

    const matches = [];
    for (const [viewKey, ds, fams] of viewsToSearch) {
      for (const n of ds.nodes) {
        const hay = `${n.name} ${n.dates} ${n.occ} ${n.place} ${n.notes}`.toLowerCase();
        if (hay.includes(q)) matches.push({ viewKey, node: n, fams });
      }
    }

    searchResults.textContent = '';
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'kinship-search-empty';
      empty.textContent = 'No matching records found.';
      searchResults.appendChild(empty);
    } else {
      for (const { viewKey, node, fams } of matches.slice(0, 12)) {
        const fam = fams[node.family] || { color: '#64748b' };
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kinship-search-item';

        const dot = document.createElement('span');
        dot.className = 'kinship-dot';
        dot.style.background = fam.color;
        dot.style.marginTop = '0.45rem';

        const info = document.createElement('div');
        const nameEl = document.createElement('div');
        nameEl.className = 'kinship-search-name';
        nameEl.textContent = node.name;
        const metaEl = document.createElement('div');
        metaEl.className = 'kinship-search-meta';
        metaEl.textContent = `${node.dates}${node.place ? ` \u00b7 ${node.place}` : ''}`;
        info.append(nameEl, metaEl);

        btn.append(dot, info);
        btn.addEventListener('click', () => {
          searchResults.hidden = true;
          searchInput.value = '';
          if (viewKey !== currentView) switchView(viewKey);
          selectNode(node.id, true);
        });
        searchResults.appendChild(btn);
      }
    }
    searchResults.hidden = false;
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.kinship-search')) {
      searchResults.hidden = true;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!drawerEl.hidden) {
        closeDrawer(true);
      } else if (app.classList.contains('is-fullscreen')) {
        app.classList.remove('is-fullscreen');
        btnFullscreen.setAttribute('aria-pressed', 'false');
        btnFullscreen.textContent = 'Fullscreen';
        requestAnimationFrame(fitToView);
      }
    }
  });

  // Load any user-supplied GEDCOM (.ged) file dynamically in the browser
  gedcomUpload?.addEventListener('change', async () => {
    const file = gedcomUpload.files?.[0];
    if (!file) return;
    const text = await file.text();
    customData = parseGedcomToView(text, file.name);
    customTab.hidden = false;
    customTab.textContent = `${file.name} (${customData.view.nodes.length})`;
    gedcomUpload.value = '';
    switchView('custom');
  });

  window.addEventListener('resize', fitToView);

  // Dynamically fetch the site's schema-validated JSON archive
  fetch(dataUrl)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((json) => {
      dataset = json;
      loadingEl.hidden = true;
      renderFilters();
      renderTree();
      requestAnimationFrame(fitToView);
    })
    .catch(() => {
      loadingEl.textContent = 'Could not load the kinship dataset. Please reload the page.';
    });
}

if (typeof document !== 'undefined') {
  initKinshipExplorer();
}
