/**
 * Renders the real coverPlaceholder() over a sample of names, as an SVG grid,
 * so a change to the colours can be looked at before it is shipped.
 *
 * Imports the compiled module rather than reimplementing it — a preview that
 * draws its own version of the algorithm is a preview of nothing.
 *
 *   npx tsc src/components/coverPlaceholder.ts --outDir <dir> --rootDir src --module commonjs --target es2022
 *   node tools/preview-placeholders.mjs <dir>/components/coverPlaceholder.js out.svg [light|dark] [columns]
 *
 * CommonJS rather than ESM: the module imports ../constants/colors for its text
 * colours, and tsc does not add the .js extension that ESM would need.
 */

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [, , modulePath, outPath, mode = 'dark'] = process.argv;
if (!modulePath || !outPath) {
  console.error('usage: node tools/preview-placeholders.mjs <compiled module> <out.svg> [light|dark]');
  process.exit(1);
}

const { coverPlaceholder } = await import(pathToFileURL(modulePath).href);

// Real-shaped names: the live recordings from the issue, things that collide on
// a first letter, a one-word title, and non-Latin scripts the app localises to.
const ALBUMS = [
  ['Stevie Ray Vaughan', 'Live at the El Mocambo'],
  ['Stevie Ray Vaughan', 'Live at Carnegie Hall'],
  ['Stevie Ray Vaughan', 'Texas Flood'],
  ['Stevie Ray Vaughan', 'Couldn’t Stand the Weather'],
  ['The Chemical Brothers', 'Come With Us'],
  ['The Chemical Brothers', 'Dig Your Own Hole'],
  ['Grateful Dead', 'Cornell 5/8/77'],
  ['Grateful Dead', 'Europe ’72'],
  ['Miles Davis', 'Kind of Blue'],
  ['Radiohead', 'Kid A'],
  ['Boards of Canada', 'Geogaddi'],
  ['Aphex Twin', 'Selected Ambient Works 85–92'],
  ['宇多田ヒカル', 'First Love'],
  ['坂本龍一', '音楽図鑑'],
  ['Sigur Rós', '( )'],
  ['Unknown Artist', 'Untitled'],
];

const CELL = 150;
const GAP = 14;
const LABEL = 34;
const COLUMNS = Number(process.argv[5]) || 4;
const rows = Math.ceil(ALBUMS.length / COLUMNS);
const width = COLUMNS * CELL + (COLUMNS + 1) * GAP;
const height = rows * (CELL + LABEL) + (rows + 1) * GAP;

const page = mode === 'dark' ? '#0b0b0c' : '#f6f6f7';
const label = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';

const escape = text => text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

let defs = '';
let cells = '';

ALBUMS.forEach(([artist, title], index) => {
  // The seed the component will use: stable per album, and not the title alone,
  // so two albums of the same name by different artists differ.
  const seed = `album:${artist}\u0000${title}`;
  const { background, foreground, initials } = coverPlaceholder(seed, title, mode);

  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const x = GAP + column * (CELL + GAP);
  const y = GAP + row * (CELL + LABEL + GAP);
  const id = `g${index}`;

  void id;
  cells += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="10" fill="${background}"/>`
    + `<text x="${x + CELL / 2}" y="${y + CELL / 2}" fill="${foreground}" font-family="Helvetica, Arial, sans-serif"`
    + ` font-size="44" font-weight="600" text-anchor="middle" dominant-baseline="central">${escape(initials)}</text>`
    + `<text x="${x}" y="${y + CELL + 16}" fill="${label}" font-family="Helvetica, Arial, sans-serif" font-size="11">${escape(title.slice(0, 26))}</text>`
    + `<text x="${x}" y="${y + CELL + 30}" fill="${label}" font-family="Helvetica, Arial, sans-serif" font-size="10">${escape(artist.slice(0, 28))}</text>`;
});

writeFileSync(
  outPath,
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<rect width="${width}" height="${height}" fill="${page}"/><defs>${defs}</defs>${cells}</svg>`,
);

console.log(`wrote ${outPath} (${mode})`);
