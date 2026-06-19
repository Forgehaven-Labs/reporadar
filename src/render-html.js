// Self-contained HTML dashboard renderer (inline CSS/JS, no external assets).
// Renders either a single-repo report or a portfolio overview.

const COLORS = { green: '#2ecc71', yellow: '#f1c40f', red: '#e74c3c' };

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function gauge(score, status, size = 160) {
  const r = size / 2 - 14;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - score / 100);
  const color = COLORS[status];
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="gauge">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#23262e" stroke-width="12"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="12"
      stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${off}"
      transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="46%" text-anchor="middle" class="gauge-num" fill="${color}">${score}</text>
    <text x="50%" y="62%" text-anchor="middle" class="gauge-sub">/ 100</text>
  </svg>`;
}

function dimCard(d) {
  const color = COLORS[d.status];
  const findings = d.findings.map((f) => {
    const icon = { ok: '✓', warn: '▲', bad: '✗', info: '•' }[f.level] || '•';
    const cls = { ok: 'ok', warn: 'warn', bad: 'bad', info: 'info' }[f.level] || 'info';
    return `<li class="f-${cls}"><span class="ico">${icon}</span>${esc(f.msg)}</li>`;
  }).join('');
  return `<div class="card">
    <div class="card-head">
      <span class="dot" style="background:${color}"></span>
      <h3>${esc(d.label)}</h3>
      <span class="score" style="color:${color}">${d.score}</span>
    </div>
    <div class="track"><div class="fill" style="width:${d.score}%;background:${color}"></div></div>
    <ul class="findings">${findings}</ul>
  </div>`;
}

const STYLE = `
:root{--bg:#0f1115;--panel:#171a21;--panel2:#1d212b;--line:#262b36;--txt:#e6e8ec;--mut:#9aa3b2;}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:32px;max-width:1100px;margin:0 auto}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.brand .logo{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#6c8cff,#9b6cff);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff}
.brand h1{font-size:22px;font-weight:800;letter-spacing:-.3px}
.brand .tag{color:var(--mut);font-size:13px;margin-left:6px}
.hero{display:flex;gap:28px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:24px;margin:18px 0}
.hero .meta h2{font-size:24px;margin-bottom:4px}
.hero .meta .stack{color:var(--mut);font-size:13px}
.grade{font-size:46px;font-weight:800;line-height:1}
.gauge .gauge-num{font-size:38px;font-weight:800}
.gauge .gauge-sub{font-size:13px;fill:var(--mut)}
.summary{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap}
.pill{font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid var(--line);color:var(--mut)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
.card-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.card-head h3{font-size:15px;font-weight:600;flex:1}
.card-head .score{font-weight:800;font-size:18px}
.dot{width:10px;height:10px;border-radius:50%}
.track{height:6px;background:#23262e;border-radius:4px;overflow:hidden;margin-bottom:12px}
.fill{height:100%;border-radius:4px}
.findings{list-style:none;font-size:13px;display:flex;flex-direction:column;gap:5px}
.findings li{display:flex;gap:8px;color:var(--mut)}
.findings .ico{flex:none;width:14px}
.f-ok .ico{color:#2ecc71}.f-warn .ico{color:#f1c40f}.f-bad{color:#e6e8ec}.f-bad .ico{color:#e74c3c}.f-info .ico{color:#6b7385}
.section-title{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);margin:28px 0 12px}
.fixes{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:8px 8px}
.fixes ol{list-style:none;counter-reset:fx}
.fixes li{counter-increment:fx;padding:11px 14px;border-bottom:1px solid var(--line);font-size:14px;display:flex;gap:12px;align-items:flex-start}
.fixes li:last-child{border-bottom:none}
.fixes li::before{content:counter(fx);background:var(--panel2);color:var(--mut);font-size:12px;font-weight:700;width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex:none}
.fixes .dim{color:#9b6cff;font-weight:600}
.fixes .p0{color:#e74c3c;font-weight:700}
footer{color:var(--mut);font-size:12px;margin-top:28px;text-align:center}
/* portfolio */
.ptable{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.ptable th,.ptable td{padding:12px 14px;text-align:left;font-size:14px;border-bottom:1px solid var(--line)}
.ptable th{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.ptable tr:last-child td{border-bottom:none}
.ptable .g{font-weight:800;font-size:16px}
.ptable .ptrack{height:8px;width:120px;background:#23262e;border-radius:4px;overflow:hidden;display:inline-block;vertical-align:middle}
.ptable .pfill{height:100%}
`;

function shell(title, body, brand) {
  const by = brand ? esc(brand) : 'RepoRadar';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head><body>${body}
<footer>Generated by ${by} · static analysis · no code executed</footer></body></html>`;
}

// Report header. A Team/Agency-licensed user can white-label the deliverable with
// --brand "Agency Name"; unbranded reports show RepoRadar. The flag works in every
// build (the binary is never crippled) — white-labeling client reports is a right
// granted by the Team license, not a feature unlocked in the code.
function brandBlock(brand, tag) {
  const name = (brand && brand.trim()) || 'RepoRadar';
  const letter = esc(name[0].toUpperCase());
  return `<div class="brand"><div class="logo">${letter}</div><h1>${esc(name)}</h1><span class="tag">${esc(tag)}</span></div>`;
}

export function renderHTML(result, opts = {}) {
  const allFixes = result.dimensions.flatMap((d) => d.fixes.map((f) => ({ dim: d.label, status: d.status, fix: f })));
  const rank = (x) => (/\(P0\)/.test(x.fix) ? 0 : x.status === 'red' ? 1 : x.status === 'yellow' ? 2 : 3);
  const ordered = [...allFixes].sort((a, b) => rank(a) - rank(b));
  const reds = result.dimensions.filter((d) => d.status === 'red').length;
  const yellows = result.dimensions.filter((d) => d.status === 'yellow').length;
  const greens = result.dimensions.filter((d) => d.status === 'green').length;

  const fixesHtml = ordered.length
    ? `<ol>${ordered.map((x) => {
        const p0 = /\(P0\)/.test(x.fix);
        return `<li><span><span class="${p0 ? 'p0' : 'dim'}">[${esc(x.dim)}]</span> ${esc(x.fix)}</span></li>`;
      }).join('')}</ol>`
    : '<ol><li><span>No fixes required — this repo is in good shape. 🎉</span></li></ol>';

  const body = `
  ${brandBlock(opts.brand, 'repo health report')}
  <div class="hero">
    ${gauge(result.overall, result.status)}
    <div class="meta">
      <div class="grade" style="color:${COLORS[result.status]}">${esc(result.grade)}</div>
      <h2>${esc(result.name)}</h2>
      <div class="stack">${esc(result.stack.join(' · '))}</div>
      <div class="summary">
        <span class="pill">🟢 ${greens} healthy</span>
        <span class="pill">🟡 ${yellows} warning</span>
        <span class="pill">🔴 ${reds} critical</span>
        <span class="pill">${ordered.length} fixes</span>
      </div>
    </div>
  </div>
  <div class="grid">${result.dimensions.map(dimCard).join('')}</div>
  <div class="section-title">Prioritized fix plan</div>
  <div class="fixes">${fixesHtml}</div>`;
  return shell(`${opts.brand || 'RepoRadar'} — ${result.name}`, body, opts.brand);
}

export function renderPortfolioHTML(results, opts = {}) {
  const sorted = [...results].sort((a, b) => a.overall - b.overall);
  const avg = Math.round(results.reduce((a, r) => a + r.overall, 0) / results.length);
  const reds = results.filter((r) => r.status === 'red').length;
  const rows = sorted.map((r) => `<tr>
    <td class="g" style="color:${COLORS[r.status]}">${esc(r.grade)}</td>
    <td>${esc(r.name)}</td>
    <td><span class="ptrack"><span class="pfill" style="width:${r.overall}%;background:${COLORS[r.status]}"></span></span> <b style="color:${COLORS[r.status]}">${r.overall}</b></td>
    <td style="color:var(--mut)">${esc(r.stack[0] || '')}</td>
    <td style="color:var(--mut)">${r.dimensions.filter((d) => d.status === 'red').length} red</td>
  </tr>`).join('');
  const body = `
  ${brandBlock(opts.brand, 'portfolio overview')}
  <div class="hero">
    ${gauge(avg, avg >= 80 ? 'green' : avg >= 55 ? 'yellow' : 'red')}
    <div class="meta">
      <h2>${results.length} repositories</h2>
      <div class="stack">Portfolio average health</div>
      <div class="summary">
        <span class="pill">🔴 ${reds} repos need attention</span>
        <span class="pill">avg ${avg}/100</span>
      </div>
    </div>
  </div>
  <div class="section-title">Repositories (worst first)</div>
  <table class="ptable">
    <thead><tr><th>Grade</th><th>Repo</th><th>Health</th><th>Stack</th><th>Critical</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  return shell(`${opts.brand || 'RepoRadar'} — portfolio (${results.length})`, body, opts.brand);
}
