import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { kinshipToGedcom, type KinshipDataset, type KinshipView } from '../plugins/kinship-gedcom.ts';
import { parseGedcomToView } from '../assets/js/kinship-tree.js';

const dataset: KinshipDataset = JSON.parse(
  readFileSync(new URL('../_data/ilmer-kinship.json', import.meta.url), 'utf8')
);

const CARD_W = 192;
const CARD_H = 78;
const COL_STEP = 232;
const ROW_STEP = 168;
const PAD_X = 230;
const PAD_Y = 92;

interface Rect {
  kind: string;
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectsOverlap(a: Rect, b: Rect, pad = 4): boolean {
  return !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x || a.y + a.h + pad <= b.y || b.y + b.h + pad <= a.y);
}

function segIntersectsRect(x1: number, y1: number, x2: number, y2: number, r: Rect): boolean {
  const rx1 = r.x + 2;
  const rx2 = r.x + r.w - 2;
  const ry1 = r.y + 2;
  const ry2 = r.y + r.h - 2;
  if (Math.abs(x1 - x2) < 0.5) {
    return x1 > rx1 && x1 < rx2 && Math.max(y1, y2) > ry1 && Math.min(y1, y2) < ry2;
  }
  if (Math.abs(y1 - y2) < 0.5) {
    return y1 > ry1 && y1 < ry2 && Math.max(x1, x2) > rx1 && Math.min(x1, x2) < rx2;
  }
  return false;
}

function auditViewLayout(name: string, view: KinshipView) {
  const nodeMap = new Map(view.nodes.map((n) => [n.id, n]));
  const unionIds = new Set(view.unions.map((u) => u.id));
  assert.equal(nodeMap.size, view.nodes.length, `${name}: duplicate node ids`);

  const pos = (n: { col: number; gen: number }) => ({ x: PAD_X + n.col * COL_STEP, y: PAD_Y + n.gen * ROW_STEP });

  const boxes: Rect[] = [];
  const cardBoxes = new Map<string, Rect>();

  for (const n of view.nodes) {
    assert.ok(dataset.families[n.family], `${name}: unknown family "${n.family}" on ${n.id}`);
    const p = pos(n);
    const box: Rect = { kind: 'card', id: n.id, x: p.x, y: p.y, w: CARD_W, h: CARD_H };
    boxes.push(box);
    cardBoxes.set(n.id, box);
  }

  view.genLabels.forEach((_, idx) => {
    const y = PAD_Y + idx * ROW_STEP - 26;
    boxes.push({ kind: 'gen-label', id: `gen_${idx}`, x: 30, y: y + 46, w: 155, h: 32 });
  });

  for (const hdr of view.columnHeaders) {
    const x1 = PAD_X + hdr.startCol * COL_STEP;
    const x2 = PAD_X + hdr.endCol * COL_STEP + CARD_W;
    boxes.push({ kind: 'header', id: hdr.label, x: x1, y: 26, w: x2 - x1, h: 28 });
  }

  for (const u of view.unions) {
    const n1 = nodeMap.get(u.p1);
    const n2 = nodeMap.get(u.p2);
    assert.ok(n1 && n2, `${name}: union ${u.id} references missing person`);
    const p1 = pos(n1);
    const p2 = pos(n2);
    const left = p1.x < p2.x ? p1 : p2;
    const right = p1.x < p2.x ? p2 : p1;
    const cx = (left.x + CARD_W + right.x) / 2;
    const y = (p1.y + p2.y) / 2 + CARD_H / 2;
    const txt = `m. ${u.year}`;
    const pw = Math.round(txt.length * 5.8 + 10);
    boxes.push({ kind: 'union-pill', id: u.id, x: cx - pw / 2, y: y - 25, w: pw, h: 16 });
  }

  for (const d of view.descents) {
    assert.ok(nodeMap.has(d.from) || unionIds.has(d.from), `${name}: bad descent source ${d.from}`);
    assert.ok(nodeMap.has(d.to), `${name}: bad descent target ${d.to}`);
  }

  for (const b of view.bridges ?? []) {
    const n1 = nodeMap.get(b.from);
    const n2 = nodeMap.get(b.to);
    assert.ok(n1 && n2, `${name}: bridge "${b.label}" references missing person`);
    const p1 = pos(n1);
    const p2 = pos(n2);
    const laneY = PAD_Y + b.corridorAfterGen * ROW_STEP + CARD_H + b.laneOffset;
    const x1 = p1.x + CARD_W / 2;
    const y1 = laneY < p1.y ? p1.y : p1.y + CARD_H;
    const x2 = p2.x + CARD_W / 2;
    const y2 = laneY < p2.y ? p2.y : p2.y + CARD_H;
    const pillX = PAD_X + b.pillCol * COL_STEP + CARD_W / 2;
    const pillW = Math.round(b.label.length * 6.0 + 18);
    boxes.push({ kind: 'bridge-pill', id: b.label, x: pillX - pillW / 2, y: laneY - 10, w: pillW, h: 20 });

    for (const [sx1, sy1, sx2, sy2] of [
      [x1, y1, x1, laneY],
      [x1, laneY, x2, laneY],
      [x2, laneY, x2, y2]
    ]) {
      for (const [cid, cb] of cardBoxes.entries()) {
        if (cid === b.from || cid === b.to) continue;
        assert.equal(segIntersectsRect(sx1, sy1, sx2, sy2, cb), false, `${name}: bridge "${b.label}" crosses ${cid}`);
      }
    }
  }

  for (const gb of view.gutterBridges ?? []) {
    const n1 = nodeMap.get(gb.from);
    const n2 = nodeMap.get(gb.to);
    assert.ok(n1 && n2, `${name}: gutter bridge "${gb.label}" references missing person`);
    const gx = PAD_X + gb.gutterCol * COL_STEP + CARD_W / 2;
    const py = PAD_Y + gb.pillGen * ROW_STEP + CARD_H / 2;
    const pillW = Math.round(gb.label.length * 6.0 + 18);
    boxes.push({ kind: 'gutter-pill', id: gb.label, x: gx - pillW / 2, y: py - 11, w: pillW, h: 22 });
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      assert.equal(
        rectsOverlap(boxes[i]!, boxes[j]!),
        false,
        `${name}: visual overlap between [${boxes[i]!.kind}] ${boxes[i]!.id} and [${boxes[j]!.kind}] ${boxes[j]!.id}`
      );
    }
  }
}

test('village and manor kinship views have valid references and zero overlapping boxes', () => {
  auditViewLayout('village', dataset.views.village);
  auditViewLayout('manor', dataset.views.manor);
});

function expectedIndividualCount(): number {
  const ids = new Set<string>();
  for (const view of [dataset.views.village, dataset.views.manor]) {
    for (const node of view.nodes) {
      if (node.members && node.members.length > 0) {
        for (const m of node.members) ids.add(m.id);
      } else {
        ids.add(node.id);
      }
    }
  }
  return ids.size;
}

test('kinshipToGedcom produces valid GEDCOM 7.0 with strictly one person per INDI record', () => {
  const ged = kinshipToGedcom(dataset, 'https://www.ilmer.org');
  const lines = ged.trim().split('\n');

  assert.equal(lines[0], '0 HEAD');
  assert.ok(lines.includes('1 GEDC'));
  assert.ok(lines.includes('2 VERS 7.0'));
  assert.equal(lines[lines.length - 1], '0 TRLR');

  const indiIds = new Set<string>();
  const famIds = new Set<string>();
  const indiNames: string[] = [];
  let inIndi = false;

  for (const line of lines) {
    const im = /^0 (@I\d+@) INDI$/.exec(line);
    if (im) {
      indiIds.add(im[1]!);
      inIndi = true;
      continue;
    }
    const fm = /^0 (@F\d+@) FAM$/.exec(line);
    if (fm) {
      famIds.add(fm[1]!);
      inIndi = false;
      continue;
    }
    if (/^0 /.test(line)) {
      inIndi = false;
      continue;
    }
    if (inIndi && line.startsWith('1 NAME ')) {
      indiNames.push(line.slice('1 NAME '.length));
    }
  }

  const expectedIndis = expectedIndividualCount();
  assert.equal(indiIds.size, expectedIndis);
  assert.equal(indiNames.length, expectedIndis);
  assert.ok(famIds.size > 0);

  // Every INDI record must represent strictly one individual person
  for (const name of indiNames) {
    assert.match(name, /\/[^/]+\//, `INDI NAME missing /Surname/: ${name}`);
    assert.doesNotMatch(
      name,
      /[&→]|\b(Children|Siblings|brothers)\b/i,
      `INDI NAME appears to combine multiple people: ${name}`
    );
  }

  for (const line of lines) {
    const refIndi = /^1 (?:HUSB|WIFE|CHIL) (@I\d+@)$/.exec(line);
    if (refIndi) assert.ok(indiIds.has(refIndi[1]!), `Dangling INDI pointer ${refIndi[1]}`);
    const refFam = /^1 (?:FAMC|FAMS) (@F\d+@)$/.exec(line);
    if (refFam) assert.ok(famIds.has(refFam[1]!), `Dangling FAM pointer ${refFam[1]}`);
  }
});

test('browser GEDCOM parser round-trips exported GEDCOM 7.0 into a renderable view', () => {
  const ged = kinshipToGedcom(dataset, 'https://www.ilmer.org');
  const parsed = parseGedcomToView(ged, 'ilmer-kinship.ged');
  const expectedIndis = expectedIndividualCount();

  assert.equal(parsed.view.nodes.length, expectedIndis);
  assert.ok(parsed.view.unions.length >= 16);
  assert.ok(parsed.view.descents.length >= 100);
  assert.ok(parsed.view.genLabels.length >= 6);
});
