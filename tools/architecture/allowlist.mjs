/**
 * Shared ratchet for the architecture gates.
 *
 * Each gate reports violations as stable string keys. A key present in
 * `allowlist.json` is tolerated; anything else fails. Entries that no longer
 * violate also fail, with instructions to prune them — that is what makes the
 * allowlist shrink-only rather than a place things quietly accumulate.
 *
 * The allowlist held the measured state of the tree when the gates went in.
 * Every section was since emptied, and it is not an exemption anyone is
 * entitled to add to. The one exception is `file-shape`, which holds two files
 * by decision (2026-09-23): the autoplay coordinator and the sources registry
 * grew past their line limits, and splitting them only to fit was judged to
 * cost more than the limit protects.
 */
import { readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ALLOWLIST_PATH = join(HERE, 'allowlist.json');

export function readAllowlist() {
  try {
    return JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export function writeAllowlist(next) {
  const sorted = {};
  for (const key of Object.keys(next).sort()) {
    if (next[key].length) sorted[key] = [...next[key]].sort();
  }
  // A gate tolerating nothing needs no section, and with no sections there is
  // no file to keep: a prune that empties the last one removes it.
  if (Object.keys(sorted).length === 0) {
    rmSync(ALLOWLIST_PATH, { force: true });
    return;
  }
  writeFileSync(ALLOWLIST_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

/**
 * Compare a gate's violations against its allowlist section.
 *
 * Modes: `--prune` rewrites the section to exactly the current violations
 * (only ever removing tolerated entries, never adding new ones);
 * `--baseline` accepts the current violations as the starting state, which is
 * only legitimate when the gate is first installed.
 */
export function enforce(gate, violations, describe = key => key, options = {}) {
  const args = new Set(process.argv.slice(2));
  const allowlist = readAllowlist();
  const allowed = new Set(allowlist[gate] ?? []);
  const current = [...new Set(violations)].sort();

  if (args.has('--baseline')) {
    writeAllowlist({ ...allowlist, [gate]: current });
    process.stderr.write(`${gate}: baselined ${current.length} violations\n`);
    return 0;
  }

  const added = current.filter(key => !allowed.has(key));
  const fixed = [...allowed].filter(key => !current.includes(key)).sort();

  if (args.has('--prune')) {
    // Moving code can replace one violation with another without making
    // anything worse — a cycle that now runs through a renamed module is the
    // same cycle. Gates that opt into `allowSwap` accept that during a prune,
    // but only while the total does not grow, so the set can still never
    // expand. Gates without it stay strictly removal-only.
    const isSwap = options.allowSwap && current.length <= allowed.size;
    if (added.length && !isSwap) {
      report(gate, added, [], describe);
      return 1;
    }
    if (added.length) {
      process.stderr.write(
        `${gate}: ${added.length} replaced ${fixed.length} (total ${allowed.size} -> ${current.length}, not increased)\n`
      );
    }
    writeAllowlist({ ...allowlist, [gate]: current });
    process.stderr.write(`${gate}: pruned ${fixed.length} fixed entries, ${current.length} remain\n`);
    return 0;
  }

  if (added.length || fixed.length) {
    report(gate, added, fixed, describe);
    return 1;
  }

  process.stderr.write(`${gate}: ok (${current.length} allowlisted)\n`);
  return 0;
}

function report(gate, added, fixed, describe) {
  if (added.length) {
    process.stderr.write(`\n${gate}: ${added.length} new violation${added.length === 1 ? '' : 's'}\n`);
    for (const key of added.slice(0, 25)) process.stderr.write(`  ${describe(key)}\n`);
    if (added.length > 25) process.stderr.write(`  ... and ${added.length - 25} more\n`);
  }
  if (fixed.length) {
    process.stderr.write(
      `\n${gate}: ${fixed.length} allowlisted entr${fixed.length === 1 ? 'y is' : 'ies are'} no longer violating.\n` +
      `  The allowlist only shrinks: run \`npm run architecture:prune\` to remove them.\n`
    );
    for (const key of fixed.slice(0, 25)) process.stderr.write(`  ${key}\n`);
    if (fixed.length > 25) process.stderr.write(`  ... and ${fixed.length - 25} more\n`);
  }
}

/** Every .ts/.tsx file under src, as repo-relative POSIX paths, sorted. */
export function sourceFiles(root = process.cwd()) {
  const src = join(root, 'src');
  const out = [];
  const walk = dir => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name)) out.push(relative(root, full).split(sep).join('/'));
    }
  };
  walk(src);
  return out.sort();
}

/** Tests are held to different rules than production code throughout these gates. */
export const isTest = file => /\.(test|spec)\.tsx?$/.test(file) || file.includes('/__tests__/');
