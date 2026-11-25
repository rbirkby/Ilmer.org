export interface SourceRef {
  label: string;
  url: string;
}

export interface KinshipMember {
  id: string;
  name: string;
  gedcomName?: string;
  sex: 'M' | 'F' | 'U';
  dates?: string;
  birth?: string;
  baptism?: string;
  death?: string;
  burial?: string;
  occ?: string;
  place?: string;
  notes?: string;
  isDescentParent?: boolean;
}

export interface KinshipPerson {
  id: string;
  name: string;
  gedcomName?: string;
  sex?: 'M' | 'F' | 'U';
  groupKind?: 'couple' | 'siblings' | 'chain';
  members?: KinshipMember[];
  dates: string;
  family: string;
  col: number;
  gen: number;
  occ: string;
  place: string;
  badges: string[];
  notes: string;
  sources: SourceRef[];
}

export interface KinshipUnion {
  id: string;
  p1: string;
  p2: string;
  year: string;
  crossFamily: boolean;
  label?: string;
}

export interface KinshipDescent {
  from: string;
  to: string;
  dashed?: boolean;
}

export interface KinshipView {
  title: string;
  subtitle: string;
  genLabels: [string, string][];
  columnHeaders: Array<{ label: string; family: string; startCol: number; endCol: number }>;
  nodes: KinshipPerson[];
  unions: KinshipUnion[];
  bridges?: Array<{
    from: string;
    to: string;
    corridorAfterGen: number;
    laneOffset: number;
    pillCol: number;
    label: string;
  }>;
  gutterBridges?: Array<{
    from: string;
    to: string;
    gutterCol: number;
    pillGen: number;
    label: string;
  }>;
  descents: KinshipDescent[];
}

export interface KinshipDataset {
  version: string;
  families: Record<string, { label: string; color: string }>;
  views: {
    village: KinshipView;
    manor: KinshipView;
  };
}

interface IndividualRecord {
  id: string;
  xref: string;
  name: string;
  gedcomName: string;
  sex: 'M' | 'F' | 'U';
  birth?: string;
  baptism?: string;
  death?: string;
  burial?: string;
  occ?: string;
  place?: string;
  notes: string;
  groupMeta: string;
  sources: SourceRef[];
}

interface FamRecord {
  xref: string;
  husb?: string;
  wife?: string;
  marrYear?: string;
  note?: string;
  children: string[];
}

/** Formats a single person's display name into GEDCOM `Given /Surname/` form. */
function formatGedcomName(name: string, explicit?: string): string {
  if (explicit) return explicit;
  const cleaned = name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const commaIdx = cleaned.indexOf(',');
  const baseName = commaIdx === -1 ? cleaned : cleaned.slice(0, commaIdx).trim();
  const titleSuffix = commaIdx === -1 ? '' : ` ${cleaned.slice(commaIdx + 1).trim()}`;

  const parts = baseName.split(' ');
  if (parts.length < 2) return `${baseName}${titleSuffix}`.trim();

  // Keep aristocratic particles like "de Moleyns" together as the surname
  if (parts.length >= 3 && /^(de|le|la|van|von)$/i.test(parts[parts.length - 2]!)) {
    const surname = `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
    const given = parts.slice(0, -2).join(' ');
    return `${given} /${surname}/${titleSuffix}`.trim();
  }

  const surname = parts[parts.length - 1];
  const given = parts.slice(0, -1).join(' ');
  return `${given} /${surname}/${titleSuffix}`.trim();
}

/** Escapes leading `@` per GEDCOM 7.0 and wraps lines using `CONT` for embedded newlines. */
function gedcomTextLines(level: number, tag: string, text: string): string[] {
  const safe = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = safe.split('\n');
  const out: string[] = [];
  rawLines.forEach((line, idx) => {
    const escaped = line.startsWith('@') ? `@${line}` : line;
    out.push(`${idx === 0 ? level : level + 1} ${idx === 0 ? tag : 'CONT'} ${escaped}`);
  });
  return out;
}

/** Extracts rough birth/baptism and death/burial date strings from a person's display date field. */
function extractLifeDates(dates: string): { birth?: string; baptism?: string; death?: string } {
  const out: { birth?: string; baptism?: string; death?: string } = {};
  const bapMatch = /bap\.\s*(\??\d{4})/i.exec(dates);
  if (bapMatch) {
    out.baptism = bapMatch[1]!.startsWith('?') ? `ABT ${bapMatch[1]!.slice(1)}` : bapMatch[1]!;
  }
  const bornMatch = /\bb\.\s*(c\.\s*)?(\d{4})/i.exec(dates);
  if (bornMatch) {
    out.birth = bornMatch[1] ? `ABT ${bornMatch[2]}` : bornMatch[2];
  }
  const rangeMatch = /(c\.\s*)?(\d{4})[–-](\d{4})\+?/.exec(dates);
  if (rangeMatch && !dates.includes('/')) {
    if (!out.birth && !out.baptism) {
      out.birth = rangeMatch[1] ? `ABT ${rangeMatch[2]}` : rangeMatch[2];
    }
    if (!dates.includes(`${rangeMatch[3]}+`)) {
      out.death = rangeMatch[3];
    }
  }
  const deathMatch = /\bd\.\s*(\d{1,2}\s+[A-Z][a-z]{2}\s+)?(\d{4})/i.exec(dates);
  if (deathMatch) {
    out.death = `${(deathMatch[1] ?? '').toUpperCase()}${deathMatch[2]}`.trim();
  }
  return out;
}

/**
 * Serializes `_data/ilmer-kinship.json` into a standards-compliant GEDCOM 7.0 document.
 * Every `INDI` record represents strictly one individual person: any visual card grouping a
 * married couple, sibling group, or succession pair via `members` is expanded into individual
 * `INDI` records linked by proper `FAM` records.
 */
export function kinshipToGedcom(dataset: KinshipDataset, siteUrl = 'https://www.ilmer.org'): string {
  const baseUrl = siteUrl.replace(/\/+$/, '');
  const lines: string[] = [
    '0 HEAD',
    '1 GEDC',
    '2 VERS 7.0',
    '1 SOUR ILMER.ORG',
    '2 NAME Ilmer Past Kinship Archive',
    `2 WWW ${baseUrl}/history/family-trees/`,
    '1 LANG en-GB',
    '1 NOTE Reconstructed from St Peter\u2019s Ilmer parish registers, 1841-1921 censuses, wills, and monumental inscriptions.'
  ];

  const views: Array<[string, KinshipView]> = [
    ['Village Kinship Web', dataset.views.village],
    ['Manorial Dynasties', dataset.views.manor]
  ];

  const individuals: IndividualRecord[] = [];
  const indiById = new Map<string, IndividualRecord>();
  const fams: FamRecord[] = [];
  const unionToFam = new Map<string, FamRecord>();
  const coupleCardToFam = new Map<string, FamRecord>();
  const singleParentFam = new Map<string, FamRecord>();
  const famcOf = new Map<string, string[]>();
  const famsOf = new Map<string, string[]>();

  // Maps a visual card id to the individual xrefs that represent it as:
  // - incoming child targets (e.g. all siblings in a sibling group, or first member in a chain)
  // - outgoing descent parent (e.g. a couple's FAM, or the specific sibling marked isDescentParent)
  const cardChildXrefs = new Map<string, string[]>();
  const cardParentXref = new Map<string, string>();
  const cardPrimaryXref = new Map<string, string>();

  let indiSeq = 1;
  let famSeq = 1;

  const addLink = (map: Map<string, string[]>, key: string, val: string) => {
    const arr = map.get(key) ?? [];
    if (!arr.includes(val)) arr.push(val);
    map.set(key, arr);
  };

  const registerIndi = (rec: Omit<IndividualRecord, 'xref'>): IndividualRecord => {
    const existing = indiById.get(rec.id);
    if (existing) return existing;
    const full: IndividualRecord = { ...rec, xref: `@I${indiSeq++}@` };
    individuals.push(full);
    indiById.set(full.id, full);
    return full;
  };

  // Pass 1: Register strictly one INDI per individual person and build couple/chain FAMs
  for (const [viewLabel, view] of views) {
    for (const node of view.nodes) {
      const groupMeta = `${viewLabel} \u2014 ${dataset.families[node.family]?.label ?? node.family}`;

      if (node.members && node.members.length >= 2) {
        const memberRecs = node.members.map((m) => {
          const parsed = extractLifeDates(m.dates ?? '');
          return registerIndi({
            id: m.id,
            name: m.name,
            gedcomName: formatGedcomName(m.name, m.gedcomName),
            sex: m.sex,
            birth: m.birth ?? parsed.birth,
            baptism: m.baptism ?? parsed.baptism,
            death: m.death ?? parsed.death,
            burial: m.burial,
            occ: m.occ ?? node.occ,
            place: m.place ?? node.place,
            notes: m.notes ?? node.notes,
            groupMeta,
            sources: node.sources
          });
        });

        if (node.groupKind === 'couple') {
          const [m1, m2] = memberRecs as [IndividualRecord, IndividualRecord];
          const husb = m1.sex === 'F' && m2.sex !== 'F' ? m2.xref : m1.xref;
          const wife = m1.sex === 'F' && m2.sex !== 'F' ? m1.xref : m2.xref;
          const fam: FamRecord = { xref: `@F${famSeq++}@`, husb, wife, children: [] };
          fams.push(fam);
          coupleCardToFam.set(node.id, fam);
          addLink(famsOf, husb, fam.xref);
          addLink(famsOf, wife, fam.xref);
          // Incoming descent attaches to the first member (the descendant of the parent line)
          cardChildXrefs.set(node.id, [m1.xref]);
          cardPrimaryXref.set(node.id, m1.xref);
          cardParentXref.set(node.id, m1.xref);
        } else if (node.groupKind === 'chain') {
          // Sequential succession (e.g. 4th Earl -> adopted cousin 5th Earl)
          cardChildXrefs.set(node.id, [memberRecs[0]!.xref]);
          cardPrimaryXref.set(node.id, memberRecs[0]!.xref);
          cardParentXref.set(node.id, memberRecs[memberRecs.length - 1]!.xref);
          for (let i = 0; i < memberRecs.length - 1; i++) {
            const prev = memberRecs[i]!;
            const next = memberRecs[i + 1]!;
            const fam: FamRecord = {
              xref: `@F${famSeq++}@`,
              husb: prev.sex === 'F' ? undefined : prev.xref,
              wife: prev.sex === 'F' ? prev.xref : undefined,
              children: [next.xref],
              note: 'Succession / adoption link'
            };
            fams.push(fam);
            addLink(famsOf, prev.xref, fam.xref);
            addLink(famcOf, next.xref, fam.xref);
          }
        } else {
          // Sibling group: every member is a separate INDI child of the same parent FAM
          cardChildXrefs.set(
            node.id,
            memberRecs.map((r) => r.xref)
          );
          const parentIdx = node.members.findIndex((m) => m.isDescentParent);
          const parentRec = memberRecs[parentIdx >= 0 ? parentIdx : 0]!;
          cardPrimaryXref.set(node.id, parentRec.xref);
          cardParentXref.set(node.id, parentRec.xref);
        }
      } else {
        const life = extractLifeDates(node.dates);
        const rec = registerIndi({
          id: node.id,
          name: node.name,
          gedcomName: formatGedcomName(node.name, node.gedcomName),
          sex: node.sex ?? 'U',
          birth: life.birth,
          baptism: life.baptism,
          death: life.death,
          occ: node.occ,
          place: node.place,
          notes: node.notes,
          groupMeta,
          sources: node.sources
        });
        cardChildXrefs.set(node.id, [rec.xref]);
        cardPrimaryXref.set(node.id, rec.xref);
        cardParentXref.set(node.id, rec.xref);
      }
    }
  }

  // Pass 2: Build explicit spouse union FAMs and wire all parent -> child descents
  for (const [, view] of views) {
    for (const u of view.unions) {
      const x1 = cardPrimaryXref.get(u.p1);
      const x2 = cardPrimaryXref.get(u.p2);
      if (!x1 || !x2) continue;
      const ind1 = individuals.find((r) => r.xref === x1)!;
      const ind2 = individuals.find((r) => r.xref === x2)!;
      const husb = ind1.sex === 'F' && ind2.sex !== 'F' ? x2 : x1;
      const wife = ind1.sex === 'F' && ind2.sex !== 'F' ? x1 : x2;
      const fam: FamRecord = {
        xref: `@F${famSeq++}@`,
        husb,
        wife,
        marrYear: u.year,
        note: u.label,
        children: []
      };
      fams.push(fam);
      unionToFam.set(u.id, fam);
      addLink(famsOf, husb, fam.xref);
      addLink(famsOf, wife, fam.xref);
    }

    for (const d of view.descents) {
      const childXrefs = cardChildXrefs.get(d.to);
      if (!childXrefs || childXrefs.length === 0) continue;

      let fam = unionToFam.get(d.from) ?? coupleCardToFam.get(d.from);
      if (!fam) {
        const parentXref = cardParentXref.get(d.from);
        if (!parentXref) continue;
        fam = singleParentFam.get(parentXref);
        if (!fam) {
          const parentInd = individuals.find((r) => r.xref === parentXref)!;
          fam = {
            xref: `@F${famSeq++}@`,
            husb: parentInd.sex === 'F' ? undefined : parentXref,
            wife: parentInd.sex === 'F' ? parentXref : undefined,
            children: []
          };
          fams.push(fam);
          singleParentFam.set(parentXref, fam);
          addLink(famsOf, parentXref, fam.xref);
        }
      }

      for (const cx of childXrefs) {
        if (!fam.children.includes(cx)) {
          fam.children.push(cx);
          addLink(famcOf, cx, fam.xref);
        }
      }
    }
  }

  // Emit INDI records (strictly 1 individual per INDI)
  for (const ind of individuals) {
    lines.push(`0 ${ind.xref} INDI`);
    lines.push(`1 NAME ${ind.gedcomName}`);
    lines.push(`1 SEX ${ind.sex}`);
    if (ind.birth) {
      lines.push('1 BIRT');
      lines.push(`2 DATE ${ind.birth}`);
    }
    if (ind.baptism) {
      lines.push('1 BAPM');
      lines.push(`2 DATE ${ind.baptism}`);
    }
    if (ind.death) {
      lines.push('1 DEAT');
      lines.push(`2 DATE ${ind.death}`);
    }
    if (ind.burial) {
      lines.push('1 BURI');
      lines.push(`2 DATE ${ind.burial}`);
    }
    if (ind.occ) lines.push(`1 OCCU ${ind.occ}`);
    if (ind.place) {
      lines.push('1 RESI');
      lines.push(`2 PLAC ${ind.place}`);
    }
    for (const fx of famsOf.get(ind.xref) ?? []) {
      lines.push(`1 FAMS ${fx}`);
    }
    for (const fx of famcOf.get(ind.xref) ?? []) {
      lines.push(`1 FAMC ${fx}`);
    }
    const fullNote = ind.notes ? `${ind.notes}\n[${ind.groupMeta}]` : `[${ind.groupMeta}]`;
    lines.push(...gedcomTextLines(1, 'NOTE', fullNote));
    for (const src of ind.sources) {
      lines.push('1 SOUR @S1@');
      lines.push(`2 PAGE ${src.label} (${baseUrl}${src.url})`);
    }
  }

  // Emit FAM records
  for (const fam of fams) {
    lines.push(`0 ${fam.xref} FAM`);
    if (fam.husb) lines.push(`1 HUSB ${fam.husb}`);
    if (fam.wife) lines.push(`1 WIFE ${fam.wife}`);
    if (fam.marrYear) {
      lines.push('1 MARR');
      lines.push(`2 DATE ${fam.marrYear.replace(/^c\.\s*/i, 'ABT ')}`);
    }
    for (const cx of fam.children) {
      lines.push(`1 CHIL ${cx}`);
    }
    if (fam.note) {
      lines.push(...gedcomTextLines(1, 'NOTE', fam.note));
    }
  }

  lines.push('0 @S1@ SOUR');
  lines.push('1 TITL Ilmer Past \u2014 Parish Registers, Censuses, Wills & Memorials');
  lines.push('1 AUTH Ilmer Local History Archive');
  lines.push(`1 PUBL ${baseUrl}/`);
  lines.push('0 TRLR');

  return `${lines.join('\n')}\n`;
}
