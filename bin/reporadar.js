#!/usr/bin/env node
// RepoRadar CLI — scan a repo or a folder of repos for health.
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { scanRepo } from '../src/scan.js';
import { renderTerminal, renderPortfolioTerminal } from '../src/render-terminal.js';
import { renderHTML, renderPortfolioHTML } from '../src/render-html.js';
import { renderClaude } from '../src/render-claude.js';

const HELP = `
RepoRadar — scan, score, and get a Claude-ready fix plan for any repo.

Usage:
  reporadar scan <path> [options]        Scan a single repository
  reporadar portfolio <dir> [options]    Scan every git repo inside <dir>

Options:
  --html <file>     Write an HTML dashboard
  --json <file>     Write raw JSON results
  --claude <file>   Write a Claude Code fix plan (single-repo scan only)
  --verbose         Show every finding in the terminal
  -h, --help        Show this help

Examples:
  reporadar scan .
  reporadar scan ./my-app --html report.html --claude FIXES.md
  reporadar portfolio ~/Documents/repos --html portfolio.html
`;

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--verbose') opts.verbose = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a.startsWith('--')) opts[a.slice(2)] = argv[++i];
    else opts._.push(a);
  }
  return opts;
}

function write(file, content) {
  const abs = resolve(file);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  console.log(`  written: ${abs}`);
}

function isGitRepo(p) {
  return existsSync(join(p, '.git'));
}

function looksLikeRepo(p) {
  // Treat as a scannable project if it has a .git or a recognizable manifest.
  return isGitRepo(p) || ['package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'README.md'].some((m) => existsSync(join(p, m)));
}

function main() {
  const argv = process.argv.slice(2);
  const opts = parseArgs(argv);
  const cmd = opts._[0];
  const target = opts._[1];

  if (opts.help || !cmd) { console.log(HELP); process.exit(opts.help ? 0 : 1); }

  if (cmd === 'scan') {
    if (!target) { console.error('error: scan requires a <path>'); process.exit(1); }
    const result = scanRepo(resolve(target));
    console.log(renderTerminal(result, { verbose: opts.verbose }));
    if (opts.html) write(opts.html, renderHTML(result));
    if (opts.json) write(opts.json, JSON.stringify(result, null, 2));
    if (opts.claude) write(opts.claude, renderClaude(result));
    // Freemium boundary marker (NOT payment logic): in a free build the toolkit
    // still runs every feature; it only prints a one-line upgrade pointer when
    // the Pro fix-plan / dashboard flags are used. The paid download leaves
    // REPORADAR_EDITION unset and prints nothing extra. See MONETIZATION.md.
    if (process.env.REPORADAR_EDITION === 'free' && (opts.claude || opts.html)) {
      console.log('\n  RepoRadar Free — the scan + grade are yours forever.');
      console.log('  Unlock the full fix plan, dashboard, and portfolio mode: https://reporadar.dev');
    }
    process.exit(result.status === 'red' ? 2 : 0);
  }

  if (cmd === 'portfolio') {
    if (!target) { console.error('error: portfolio requires a <dir>'); process.exit(1); }
    const root = resolve(target);
    const dirs = readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(root, e.name))
      .filter(looksLikeRepo);
    if (!dirs.length) { console.error(`error: no repos found under ${root}`); process.exit(1); }
    const results = [];
    for (const d of dirs) {
      try { results.push(scanRepo(d)); }
      catch (e) { console.error(`  skipped ${d}: ${e.message}`); }
    }
    console.log(renderPortfolioTerminal(results));
    if (opts.html) write(opts.html, renderPortfolioHTML(results));
    if (opts.json) write(opts.json, JSON.stringify(results, null, 2));
    process.exit(0);
  }

  console.error(`error: unknown command "${cmd}"`);
  console.log(HELP);
  process.exit(1);
}

main();
