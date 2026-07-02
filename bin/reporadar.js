#!/usr/bin/env node
// RepoRadar CLI — scan a repo or a folder of repos for health.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { scanRepo } from '../src/scan.js';
import { discoverRepos } from '../src/discover.js';
import { renderTerminal, renderPortfolioTerminal } from '../src/render-terminal.js';
import { renderHTML, renderPortfolioHTML } from '../src/render-html.js';
import { renderClaude } from '../src/render-claude.js';

const HELP = `
RepoRadar — scan, score, and get a Claude-ready fix plan for any repo.

Usage:
  reporadar scan <path> [options]        Scan a single repository
  reporadar portfolio <dir> [options]    Scan every git repo inside <dir> (nested up to 3 levels)

Options:
  --html <file>       Write an HTML dashboard
  --json <file>       Write raw JSON results
  --claude <file>     Write a Claude Code fix plan (single-repo scan)
  --claude-dir <dir>  Write one fix plan per repo (portfolio scan)
  --brand <name>    White-label the HTML report with your name (Team license)
  --verbose         Show every finding in the terminal
  -h, --help        Show this help

Examples:
  reporadar scan .
  reporadar scan ./my-app --html report.html --claude FIXES.md
  reporadar portfolio ~/Documents/repos --html portfolio.html
`;

const VALUE_FLAGS = new Set(['html', 'json', 'claude', 'claude-dir', 'brand']);
const BOOL_FLAGS = new Set(['verbose', 'help']);

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--verbose') opts.verbose = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a.startsWith('--')) {
      const key = a.slice(2);
      if (VALUE_FLAGS.has(key)) {
        const val = argv[i + 1];
        if (val === undefined || val.startsWith('--')) {
          console.error(`error: --${key} requires a value`);
          process.exit(1);
        }
        opts[key] = val;
        i++;
      } else if (BOOL_FLAGS.has(key)) {
        opts[key] = true;
      } else {
        console.error(`error: unknown option --${key}`);
        console.log(HELP);
        process.exit(1);
      }
    } else opts._.push(a);
  }
  return opts;
}

function write(file, content) {
  const abs = resolve(file);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  console.log(`  written: ${abs}`);
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
    if (opts.html) write(opts.html, renderHTML(result, { brand: opts.brand }));
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
    const dirs = discoverRepos(root);
    if (!dirs.length) { console.error(`error: no repos found under ${root}`); process.exit(1); }
    const results = [];
    for (const d of dirs) {
      try {
        const r = scanRepo(d);
        r.name = relative(root, d) || r.name; // disambiguate nested repos (driftwink/ios vs drivelog/ios)
        results.push(r);
      } catch (e) { console.error(`  skipped ${d}: ${e.message}`); }
    }
    console.log(renderPortfolioTerminal(results));
    if (opts.html) write(opts.html, renderPortfolioHTML(results, { brand: opts.brand }));
    if (opts.json) write(opts.json, JSON.stringify(results, null, 2));
    if (opts['claude-dir']) {
      for (const r of results) {
        write(join(opts['claude-dir'], r.name.replace(/[/\\]/g, '__') + '.md'), renderClaude(r));
      }
    }
    // Honor the documented exit-code contract in portfolio mode too: a red repo in
    // the set fails the gate, so `reporadar portfolio` can guard CI like `scan` does.
    process.exit(results.some((r) => r.status === 'red') ? 2 : 0);
  }

  console.error(`error: unknown command "${cmd}"`);
  console.log(HELP);
  process.exit(1);
}

main();
