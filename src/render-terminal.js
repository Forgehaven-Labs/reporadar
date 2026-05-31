// Terminal renderer with ANSI colors (no deps).
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', gray: '\x1b[90m', white: '\x1b[37m',
};

const STATUS_COLOR = { green: C.green, yellow: C.yellow, red: C.red };
const LEVEL_ICON = { ok: `${C.green}✓${C.reset}`, warn: `${C.yellow}▲${C.reset}`, bad: `${C.red}✗${C.reset}`, info: `${C.gray}•${C.reset}` };

function bar(score, width = 20) {
  const filled = Math.round((score / 100) * width);
  const color = score >= 80 ? C.green : score >= 55 ? C.yellow : C.red;
  return color + '█'.repeat(filled) + C.gray + '░'.repeat(width - filled) + C.reset;
}

export function renderTerminal(result, { verbose = false } = {}) {
  const lines = [];
  const sc = STATUS_COLOR[result.status];
  lines.push('');
  lines.push(`${C.bold}${C.cyan}RepoRadar${C.reset} ${C.gray}— health report${C.reset}`);
  lines.push(`${C.bold}${result.name}${C.reset} ${C.gray}(${result.stack.join(', ')})${C.reset}`);
  lines.push('');
  lines.push(`  ${C.bold}Overall${C.reset}  ${sc}${C.bold}${result.grade}${C.reset}  ${bar(result.overall, 24)}  ${sc}${result.overall}/100${C.reset}`);
  lines.push('');
  for (const d of result.dimensions) {
    const dc = STATUS_COLOR[d.status];
    lines.push(`  ${pad(d.label, 20)} ${bar(d.score)} ${dc}${String(d.score).padStart(3)}${C.reset} ${C.gray}(w${d.weight})${C.reset}`);
    if (verbose) {
      for (const f of d.findings) lines.push(`      ${LEVEL_ICON[f.level] || '•'} ${C.dim}${f.msg}${C.reset}`);
    } else {
      const bads = d.findings.filter((f) => f.level === 'bad');
      for (const f of bads.slice(0, 2)) lines.push(`      ${LEVEL_ICON.bad} ${C.dim}${f.msg}${C.reset}`);
    }
  }
  const allFixes = result.dimensions.flatMap((d) => d.fixes);
  if (allFixes.length) {
    lines.push('');
    lines.push(`  ${C.bold}Top fixes${C.reset} ${C.gray}(${allFixes.length} total)${C.reset}`);
    for (const fix of allFixes.slice(0, 5)) lines.push(`    ${C.yellow}→${C.reset} ${fix}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function renderPortfolioTerminal(results) {
  const lines = [''];
  lines.push(`${C.bold}${C.cyan}RepoRadar${C.reset} ${C.gray}— portfolio (${results.length} repos)${C.reset}`);
  lines.push('');
  const sorted = [...results].sort((a, b) => a.overall - b.overall);
  for (const r of sorted) {
    const sc = STATUS_COLOR[r.status];
    lines.push(`  ${sc}${r.grade.padEnd(2)}${C.reset} ${bar(r.overall, 16)} ${sc}${String(r.overall).padStart(3)}${C.reset}  ${pad(r.name, 28)} ${C.gray}${r.stack[0] || ''}${C.reset}`);
  }
  const avg = Math.round(results.reduce((a, r) => a + r.overall, 0) / results.length);
  lines.push('');
  lines.push(`  ${C.bold}Portfolio average:${C.reset} ${avg}/100  ${C.gray}(worst first — fix the reds)${C.reset}`);
  lines.push('');
  return lines.join('\n');
}

function pad(s, n) { s = String(s); return s.length >= n ? s.slice(0, n - 1) + '…' : s.padEnd(n); }
