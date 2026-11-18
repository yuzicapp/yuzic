#!/usr/bin/env node
/**
 * Architecture baseline measurement.
 *
 * Emits a machine-readable snapshot of the structural facts the rewrite is
 * meant to move: how much code there is, where the cycles and dead exports
 * are, where provider names leak out of provider folders, and what the
 * adapter/capability surface currently looks like.
 *
 * Every structural number comes from tools/architecture/detectors.mjs, the same
 * module the gates enforce against, so the baseline and the gates cannot report
 * different numbers for the same property.
 *
 * Output is deterministic — collections sorted, no timestamps, no absolute
 * paths — so two runs on one tree produce byte-identical JSON and a later run
 * diffs cleanly against the committed artifact.
 *
 *   node tools/architecture/measure.mjs            # write .hermes/rewrite-baseline.json
 *   node tools/architecture/measure.mjs --stdout   # print instead of writing
 *   node tools/architecture/measure.mjs --no-coverage
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isTest, sourceFiles } from './allowlist.mjs';
import {
  cycles, unusedExports, providerReferences, unsafeEscapes, consoleCalls, oversizedFiles,
  GENERAL_LIMIT, ORCHESTRATION_LIMIT,
} from './detectors.mjs';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, '.hermes', 'rewrite-baseline.json');

const args = new Set(process.argv.slice(2));
const toStdout = args.has('--stdout');
const withCoverage = !args.has('--no-coverage');

const lineCount = file => readFileSync(join(ROOT, file), 'utf8').split('\n').length;

// --- size -------------------------------------------------------------------

function measureSize(files) {
  const production = files.filter(f => !isTest(f));
  const tests = files.filter(isTest);
  const total = list => list.reduce((n, f) => n + lineCount(f), 0);
  return {
    productionFiles: production.length,
    productionLines: total(production),
    testFiles: tests.length,
    testLines: total(tests),
  };
}

// --- routes -----------------------------------------------------------------

const measureRoutes = files => files
  .filter(f => f.startsWith('src/app/') && f.endsWith('.tsx'))
  .map(f => f.slice('src/app/'.length))
  .sort();

// --- adapter and capability surface ----------------------------------------

/**
 * The ApiAdapter surface: each sub-API, whether it is required, and the methods
 * its interface declares. Read from the contract so the inventory cannot drift
 * from what adapters must actually implement.
 */
function measureAdapterSurface() {
  const src = readFileSync(join(SRC, 'providers/contracts/ServerAdapter.ts'), 'utf8');

  /** Method names declared directly on an interface or type-alias body. */
  const methodsOf = name => {
    const block = src.match(new RegExp(`export (?:interface ${name} |type ${name} = )\\{([\\s\\S]*?)\\n\\}`));
    if (!block) return [];
    const names = [];
    for (const line of block[1].split('\n')) {
      const m = line.match(/^\s*(\w+)\??\s*[(:]/);
      if (m) names.push(m[1]);
    }
    return [...new Set(names)].sort();
  };

  const block = src.match(/export interface ApiAdapter \{([\s\S]*?)\n\}/);
  const members = [];
  if (block) {
    for (const line of block[1].split('\n')) {
      const m = line.match(/^\s*(\w+)(\??):\s*(\w+)/);
      if (m) members.push({ name: m[1], required: m[2] !== '?', type: m[3], methods: methodsOf(m[3]) });
    }
  }
  return members.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The capability names the contract declares.
 *
 * Read from `CapabilityMap`'s own keys rather than a separate union, because
 * the map is the contract: a capability exists exactly when something can be
 * called for it.
 */
function measureCapabilities() {
  const contract = join(SRC, 'providers/contracts/Capabilities.ts');
  if (!existsSync(contract)) return [];
  const src = readFileSync(contract, 'utf8');
  const block = src.match(/export interface CapabilityMap \{([\s\S]*?)\n\}/);
  if (!block) return [];
  const names = [];
  for (const line of block[1].split('\n')) {
    // Quoted keys ('artist.enrich') and bare ones (lyrics) alike, at the map's
    // own indent only: a capability's multi-line parameter list sits deeper,
    // and its parameter names are not capabilities.
    const match = line.match(/^ {2}'([^']+)'\s*:/) ?? line.match(/^ {2}(\w+)\s*:/);
    if (match) names.push(match[1]);
  }
  return names.sort();
}

/** Protocol implementations: servers and integrations, each under its own folder. */
const measureProviderImplementations = () => ['server', 'integration']
  .flatMap(kind => {
    const dir = join(SRC, 'providers', kind);
    return readdirSync(dir)
      .filter(name => statSync(join(dir, name)).isDirectory())
      .map(name => `${kind}/${name}`);
  })
  .sort();

// --- tests ------------------------------------------------------------------

function measureTests() {
  const argv = ['jest', '--ci', '--silent', '--json', '--outputFile', '.hermes/.jest-result.json'];
  if (withCoverage) argv.push('--coverage', '--coverageReporters', 'json-summary');
  try {
    execFileSync('npx', ['--no-install', ...argv], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  } catch (err) {
    if (typeof err.stdout !== 'string') throw err;
  }
  const result = JSON.parse(readFileSync(join(ROOT, '.hermes/.jest-result.json'), 'utf8'));
  const out = {
    suites: result.numTotalTestSuites,
    tests: result.numTotalTests,
    passed: result.numPassedTests,
    failed: result.numFailedTests,
  };
  if (withCoverage) {
    const { total } = JSON.parse(readFileSync(join(ROOT, 'coverage/coverage-summary.json'), 'utf8'));
    out.coverage = {
      lines: total.lines.pct,
      statements: total.statements.pct,
      functions: total.functions.pct,
      branches: total.branches.pct,
    };
  }
  return out;
}

// --- main -------------------------------------------------------------------

const files = sourceFiles();
const unsafe = unsafeEscapes(files);

const baseline = {
  schema: 'yuzic-architecture-baseline/2',
  size: measureSize(files),
  tests: measureTests(),
  cycles: cycles(),
  unusedExports: (list => ({ count: list.length, entries: list }))(unusedExports()),
  unsafe: Object.fromEntries(
    [...new Set(unsafe.map(e => e.kind))].sort().map(kind => {
      const entries = unsafe.filter(e => e.kind === kind).map(({ file, line }) => ({ file, line }));
      return [kind, { count: entries.length, entries }];
    })
  ),
  providerLeakage: (list => ({ count: list.length, entries: list }))(providerReferences(files)),
  // Failure reports still going to the console rather than to the log. A
  // to-do list that only shrinks — see check-console.mjs.
  consoleCalls: (list => ({ count: list.length, entries: list }))(consoleCalls(files)),
  largeFiles: {
    generalLimit: GENERAL_LIMIT,
    orchestrationLimit: ORCHESTRATION_LIMIT,
    entries: oversizedFiles(files),
  },
  routes: measureRoutes(files),
  adapter: {
    apiAdapterMembers: measureAdapterSurface(),
    capabilities: measureCapabilities(),
    providerImplementations: measureProviderImplementations(),
  },
};

const json = JSON.stringify(baseline, null, 2) + '\n';
if (toStdout) {
  process.stdout.write(json);
} else {
  mkdirSync(join(ROOT, '.hermes'), { recursive: true });
  writeFileSync(OUT, json);
  process.stderr.write(`wrote ${relative(ROOT, OUT)}\n`);
}
