export const BD_SHEET_NAME = 'BD';
export const BD_HEADER_OFFSET = 3;

export const COLUMN_INDEX = Object.freeze({
  year: 1,
  month: 2,
  week: 3,
  date: 4,
  typeMachine: 5,
  machine: 6,
  typeProd: 7,
  typeCD: 8,
  dimension: 14,
  conf1: 16,
  conf2: 17,
  conf3: 18,
  commentaire: 64,
  qualiteNiv3: 67,
  qualiteNiv2: 68,
  tempsD1: 85,
  cqCW: 100,
  cqCX: 101,
  cqCY: 102,
  pannes: 110,
  tempsD1Net: 111,
  notesGarant: 131
});

export function parseDateCell(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseNumberCell(value) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : 0;
}

export function formatAsInputDate(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function deriveDefaultDateRange(rows) {
  if (!rows) return null;
  const dates = rows
    .map((row) => parseDateCell(row?.[COLUMN_INDEX.date]))
    .filter(Boolean)
    .sort((a, b) => a - b);

  if (!dates.length) return null;

  const latest = dates[dates.length - 1];
  const start = new Date(latest);
  start.setMonth(latest.getMonth() - 6);

  return {
    start: formatAsInputDate(start),
    end: formatAsInputDate(latest)
  };
}

export function collectUniqueNames(rows) {
  if (!rows) return [];
  const names = new Set();

  rows.forEach((row) => {
    if (!row) return;
    [COLUMN_INDEX.conf1, COLUMN_INDEX.conf2, COLUMN_INDEX.conf3]
      .map((index) => row[index])
      .forEach((name) => {
        if (name && typeof name === 'string') {
          const trimmed = name.trim();
          if (trimmed.length > 1) names.add(trimmed);
        }
      });
  });

  return Array.from(names).sort();
}

export function buildCdEntries(rows, getNormalizedName) {
  if (!rows) return [];

  let cdId = 1;
  const entries = [];

  for (const row of rows) {
    if (!row) continue;

    const parsedDate = parseDateCell(row[COLUMN_INDEX.date]);
    if (!parsedDate) continue;

    const date = formatAsInputDate(parsedDate);
    const conf1 = getNormalizedName(row[COLUMN_INDEX.conf1]);
    const conf2 = getNormalizedName(row[COLUMN_INDEX.conf2]);
    if (!conf1 && !conf2) continue;

    const tempsD1 = parseNumberCell(row[COLUMN_INDEX.tempsD1]);
    if (tempsD1 <= 0) continue;

    const typeProd = row[COLUMN_INDEX.typeProd] || 'N/A';
    if (typeof typeProd === 'string' && typeProd.toLowerCase() === 'proto') continue;

    let qualite = 'Niv1';
    let qualiteInfo = null;
    if (row[COLUMN_INDEX.qualiteNiv3]) {
      qualite = 'Niv3';
      qualiteInfo = typeof row[COLUMN_INDEX.qualiteNiv3] === 'string'
        ? row[COLUMN_INDEX.qualiteNiv3]
        : "Pas d'informations";
    } else if (row[COLUMN_INDEX.qualiteNiv2]) {
      qualite = 'Niv2';
      qualiteInfo = typeof row[COLUMN_INDEX.qualiteNiv2] === 'string'
        ? row[COLUMN_INDEX.qualiteNiv2]
        : "Pas d'informations";
    }

    const pannes = parseNumberCell(row[COLUMN_INDEX.pannes]);

    entries.push({
      id: cdId++,
      date,
      week: row[COLUMN_INDEX.week] || null,
      month: row[COLUMN_INDEX.month] || null,
      year: row[COLUMN_INDEX.year] || null,
      conf1,
      conf2,
      tempsD1,
      tempsD1Net: parseNumberCell(row[COLUMN_INDEX.tempsD1Net]),
      qualite,
      qualiteInfo,
      isPanne: pannes > 0,
      dimension: row[COLUMN_INDEX.dimension] || 'N/A',
      machine: row[COLUMN_INDEX.machine] || 'N/A',
      commentaire: row[COLUMN_INDEX.commentaire] || '',
      cqCW: row[COLUMN_INDEX.cqCW] || '',
      cqCX: row[COLUMN_INDEX.cqCX] || '',
      cqCY: row[COLUMN_INDEX.cqCY] || '',
      notesGarant: row[COLUMN_INDEX.notesGarant] || '',
      typeMachine: row[COLUMN_INDEX.typeMachine] || 'N/A',
      typeProd,
      typeCD: row[COLUMN_INDEX.typeCD] || 'Normal'
    });
  }

  return entries;
}
