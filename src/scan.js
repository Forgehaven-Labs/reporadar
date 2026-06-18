// RepoRadar scan engine — pure Node, zero dependencies.
// Static-by-default: inspects config and files without executing builds.
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

// ---------- small helpers ----------

function read(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

function has(repo, ...rel) {
  return rel.some((r) => existsSync(join(repo, r)));
}

function firstExisting(repo, rels) {
  return rels.find((r) => existsSync(join(repo, r))) || null;
}

function git(repo, args) {
  try {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

// Walk repo collecting source files, skipping noise. Bounded for speed.
function listSourceFiles(repo, limit = 4000) {
  const out = [];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', 'vendor', 'Pods', '.venv', 'venv', '__pycache__', 'bin', 'obj', 'DerivedData', 'coverage', '.gradle', 'target']);
  const stack = [repo];
  while (stack.length && out.length < limit) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.github' && e.name !== '.env') continue;
      if (skip.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile()) out.push(full);
      if (out.length >= limit) break;
    }
  }
  return out;
}

// ---------- stack detection ----------

export function detectStack(repo) {
  const signals = [];
  if (has(repo, 'package.json')) signals.push('Node/JS');
  if (has(repo, 'tsconfig.json')) signals.push('TypeScript');
  if (has(repo, 'requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py')) signals.push('Python');
  if (has(repo, 'go.mod')) signals.push('Go');
  if (has(repo, 'Cargo.toml')) signals.push('Rust');
  if (has(repo, 'Gemfile')) signals.push('Ruby');
  if (has(repo, 'pom.xml', 'build.gradle', 'build.gradle.kts')) signals.push('JVM');
  if (existsSync(repo) && readdirSync(repo).some((f) => f.endsWith('.csproj') || f.endsWith('.sln'))) signals.push('.NET');
  if (existsSync(repo) && readdirSync(repo).some((f) => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace')) || has(repo, 'Package.swift')) signals.push('Swift/iOS');
  if (has(repo, 'index.html') && signals.length === 0) signals.push('Static site');
  return signals.length ? signals : ['Unknown'];
}

// ---------- dimension checks ----------
// Each returns { score 0-100, findings: [{level, msg}], fixes: [string] }

function checkTests(repo, stack) {
  const findings = [];
  const fixes = [];
  let score = 0;
  const pkg = jsonOf(read(join(repo, 'package.json')));
  const testDirs = ['test', 'tests', '__tests__', 'spec'];
  const hasTestDir = testDirs.some((d) => existsSync(join(repo, d)));
  const files = listSourceFiles(repo);
  const testFiles = files.filter((f) => /(\.|_)(test|spec)\.[a-z]+$/i.test(basename(f)) || /test_.*\.py$/i.test(basename(f)));

  if (pkg?.scripts?.test && !/no test specified/i.test(pkg.scripts.test)) {
    score += 40;
    findings.push({ level: 'ok', msg: `npm test script defined: \`${pkg.scripts.test}\`` });
  } else if (stack.includes('Node/JS')) {
    findings.push({ level: 'bad', msg: 'No real `test` script in package.json' });
    fixes.push('Add a real `test` script (e.g. `"test": "node --test"` or vitest/jest) to package.json.');
  }

  if (testFiles.length > 0) {
    score += Math.min(45, 15 + testFiles.length * 3);
    findings.push({ level: 'ok', msg: `${testFiles.length} test file(s) found` });
  } else if (hasTestDir) {
    score += 15;
    findings.push({ level: 'warn', msg: 'Test directory exists but no recognizable test files' });
  } else {
    findings.push({ level: 'bad', msg: 'No test files detected anywhere in the repo' });
    fixes.push('Add at least a smoke test for the main entry point so regressions are caught.');
  }

  if (has(repo, 'coverage', '.nyc_output') || pkg?.scripts?.coverage) {
    score += 15;
    findings.push({ level: 'ok', msg: 'Coverage tooling present' });
  } else {
    fixes.push('Wire up a coverage report so test completeness is measurable.');
  }
  return { score: clamp(score), findings, fixes };
}

function checkDocs(repo) {
  const findings = [];
  const fixes = [];
  let score = 0;
  const readmePath = firstExisting(repo, ['README.md', 'README.rst', 'README.txt', 'readme.md']);
  if (readmePath) {
    const body = read(join(repo, readmePath)) || '';
    const len = body.length;
    if (len > 1500) { score += 50; findings.push({ level: 'ok', msg: `README is substantial (${len} chars)` }); }
    else if (len > 300) { score += 30; findings.push({ level: 'warn', msg: `README is thin (${len} chars)` }); fixes.push('Expand the README: what it is, install, usage, and an example.'); }
    else { score += 10; findings.push({ level: 'bad', msg: 'README is nearly empty' }); fixes.push('Write a real README with install + usage sections.'); }
    if (/##?\s+(install|setup|getting started|usage)/i.test(body)) { score += 15; findings.push({ level: 'ok', msg: 'README has setup/usage sections' }); }
    else fixes.push('Add an Install/Usage section to the README.');
  } else {
    findings.push({ level: 'bad', msg: 'No README found' });
    fixes.push('Add a README.md — this is the first thing a buyer or contributor reads.');
  }
  if (has(repo, 'LICENSE', 'LICENSE.md', 'LICENSE.txt')) { score += 20; findings.push({ level: 'ok', msg: 'LICENSE present' }); }
  else { findings.push({ level: 'warn', msg: 'No LICENSE file' }); fixes.push('Add a LICENSE file so usage terms are unambiguous.'); }
  if (has(repo, 'CHANGELOG.md', 'CONTRIBUTING.md', 'docs')) { score += 15; findings.push({ level: 'ok', msg: 'Extra docs present (changelog/contributing/docs)' }); }
  return { score: clamp(score), findings, fixes };
}

function checkCI(repo) {
  const findings = [];
  const fixes = [];
  let score = 0;
  const ghDir = join(repo, '.github', 'workflows');
  let workflows = [];
  try { workflows = readdirSync(ghDir).filter((f) => /\.ya?ml$/.test(f)); } catch {}
  if (workflows.length) {
    score += 70;
    findings.push({ level: 'ok', msg: `${workflows.length} GitHub Actions workflow(s)` });
    const txt = workflows.map((w) => read(join(ghDir, w)) || '').join('\n');
    if (/test|pytest|node --test|vitest|jest|xcodebuild/i.test(txt)) { score += 30; findings.push({ level: 'ok', msg: 'CI runs tests' }); }
    else { fixes.push('CI exists but does not appear to run tests — add a test job.'); }
  } else if (has(repo, 'Jenkinsfile', '.gitlab-ci.yml', '.circleci', 'azure-pipelines.yml')) {
    score += 70; findings.push({ level: 'ok', msg: 'Non-GitHub CI configuration present' });
  } else {
    findings.push({ level: 'bad', msg: 'No CI configuration found' });
    fixes.push('Add a CI workflow (.github/workflows/ci.yml) that builds and tests on every push.');
  }
  return { score: clamp(score), findings, fixes };
}

function checkDependencies(repo, stack) {
  const findings = [];
  const fixes = [];
  let score = 50; // neutral baseline; adjust up/down
  const pkg = jsonOf(read(join(repo, 'package.json')));
  if (stack.includes('Node/JS')) {
    const lock = firstExisting(repo, ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);
    if (lock) { score += 25; findings.push({ level: 'ok', msg: `Lockfile present (${basename(lock)})` }); }
    else { score -= 20; findings.push({ level: 'bad', msg: 'No lockfile — non-reproducible installs' }); fixes.push('Commit a lockfile (package-lock.json) for reproducible installs.'); }
    const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
    const total = Object.keys(deps).length;
    const looseRanges = Object.values(deps).filter((v) => typeof v === 'string' && /^[\^~]?\*$|^\*$|^latest$/.test(v)).length;
    if (looseRanges > 0) { score -= 15; findings.push({ level: 'warn', msg: `${looseRanges} dependency(ies) pinned to *, latest — unpredictable` }); fixes.push('Pin floating (*/latest) dependency versions to explicit ranges.'); }
    findings.push({ level: 'info', msg: `${total} declared dependencies` });
    if (total > 0) score += 10;
  } else if (stack.includes('Python')) {
    if (has(repo, 'requirements.txt', 'poetry.lock', 'Pipfile.lock', 'pyproject.toml')) { score += 35; findings.push({ level: 'ok', msg: 'Python dependency manifest present' }); }
    else { score -= 20; fixes.push('Add a requirements.txt or pyproject.toml to declare dependencies.'); }
  } else {
    findings.push({ level: 'info', msg: 'Dependency depth check skipped for this stack (static mode)' });
    score += 20;
  }
  return { score: clamp(score), findings, fixes };
}

const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key id'],
  [/-----BEGIN (RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY-----/, 'Private key block'],
  [/sk-[A-Za-z0-9]{20,}/, 'OpenAI-style secret key'],
  [/sk-ant-[A-Za-z0-9_\-]{20,}/, 'Anthropic API key'],
  [/ghp_[A-Za-z0-9]{30,}/, 'GitHub personal access token'],
  [/AIza[0-9A-Za-z\-_]{30,}/, 'Google API key'],
  [/xox[baprs]-[0-9A-Za-z\-]{10,}/, 'Slack token'],
  [/(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["'][^"'\s]{8,}["']/i, 'Hardcoded credential assignment'],
];

function checkSecrets(repo) {
  const findings = [];
  const fixes = [];
  const files = listSourceFiles(repo).filter((f) => {
    const ext = extname(f).toLowerCase();
    return !['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.ico', '.lock', '.svg', '.woff', '.woff2', '.ttf', '.map'].includes(ext);
  });
  let hits = 0;
  const seen = new Set();
  for (const f of files.slice(0, 2500)) {
    const txt = read(f);
    if (!txt) continue;
    for (const [re, label] of SECRET_PATTERNS) {
      if (re.test(txt)) {
        const key = label + ':' + f;
        if (seen.has(key)) continue;
        seen.add(key);
        hits++;
        const rel = f.replace(repo, '').replace(/^\//, '');
        findings.push({ level: 'bad', msg: `Possible ${label} in ${rel}` });
        fixes.push(`Rotate and remove the ${label} found in ${rel}; load it from an env var instead. (P0)`);
      }
    }
  }
  // .env committed?
  if (has(repo, '.env') && !gitIgnored(repo, '.env')) {
    findings.push({ level: 'bad', msg: '.env present and not gitignored' });
    fixes.push('Add .env to .gitignore and ensure no real secrets are committed.');
    hits++;
  }
  // Any exposed secret is serious — one hit drops to red, more zeroes it out.
  let score = hits === 0 ? 100 : Math.max(0, 100 - hits * 50);
  if (hits === 0) findings.push({ level: 'ok', msg: 'No obvious secret patterns detected' });
  return { score: clamp(score), findings, fixes };
}

function gitIgnored(repo, file) {
  const gi = read(join(repo, '.gitignore')) || '';
  return gi.split('\n').some((l) => l.trim() === file || l.trim() === file + '/');
}

function checkGitHygiene(repo) {
  const findings = [];
  const fixes = [];
  let score = 0;
  if (!existsSync(join(repo, '.git'))) {
    findings.push({ level: 'warn', msg: 'Not a git repository' });
    fixes.push('Initialize version control with `git init`.');
    return { score: 20, findings, fixes };
  }
  if (has(repo, '.gitignore')) { score += 30; findings.push({ level: 'ok', msg: '.gitignore present' }); }
  else { findings.push({ level: 'bad', msg: 'No .gitignore' }); fixes.push('Add a .gitignore (node_modules, build output, .env, etc.).'); }

  const dirty = git(repo, ['status', '--porcelain']);
  if (dirty === null) { findings.push({ level: 'info', msg: 'Could not read git status' }); }
  else if (dirty === '') { score += 35; findings.push({ level: 'ok', msg: 'Working tree clean' }); }
  else {
    const count = dirty.split('\n').filter(Boolean).length;
    score += 10;
    findings.push({ level: 'warn', msg: `${count} uncommitted change(s)` });
  }

  const last = git(repo, ['log', '-1', '--format=%cr']);
  if (last) {
    score += 20;
    findings.push({ level: 'info', msg: `Last commit: ${last}` });
    if (/year|months/.test(last)) { findings.push({ level: 'warn', msg: 'Repo looks stale (no recent commits)' }); }
  } else {
    findings.push({ level: 'warn', msg: 'No commits yet' });
  }
  const count = git(repo, ['rev-list', '--count', 'HEAD']);
  if (count && Number(count) > 1) score += 15;
  return { score: clamp(score), findings, fixes };
}

function checkBuildConfig(repo, stack) {
  const findings = [];
  const fixes = [];
  let score = 0;
  const pkg = jsonOf(read(join(repo, 'package.json')));
  // Lint
  if (has(repo, '.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs', 'eslint.config.js', '.ruff.toml', 'ruff.toml', '.flake8', '.golangci.yml', '.swiftlint.yml') || pkg?.eslintConfig) {
    score += 45; findings.push({ level: 'ok', msg: 'Linter configured' });
  } else {
    findings.push({ level: 'warn', msg: 'No linter configuration' });
    fixes.push('Add a linter config (eslint/ruff/swiftlint) to keep style consistent.');
  }
  // Formatter / editorconfig
  if (has(repo, '.prettierrc', '.prettierrc.json', '.editorconfig', '.prettierrc.js')) { score += 20; findings.push({ level: 'ok', msg: 'Formatter/editorconfig present' }); }
  // Build script
  if (stack.includes('Node/JS')) {
    if (pkg?.scripts?.build) { score += 35; findings.push({ level: 'ok', msg: `Build script: \`${pkg.scripts.build}\`` }); }
    else { score += 15; findings.push({ level: 'info', msg: 'No build script (may not need one)' }); }
  } else {
    score += 25; findings.push({ level: 'info', msg: 'Build config check is static for this stack' });
  }
  return { score: clamp(score), findings, fixes };
}

// ---------- orchestration ----------

const DIMENSIONS = [
  { key: 'tests', label: 'Tests', weight: 20, fn: checkTests, stackAware: true },
  { key: 'secrets', label: 'Security / Secrets', weight: 18, fn: checkSecrets },
  { key: 'docs', label: 'Documentation', weight: 15, fn: checkDocs },
  { key: 'dependencies', label: 'Dependencies', weight: 15, fn: checkDependencies, stackAware: true },
  { key: 'ci', label: 'CI / Automation', weight: 12, fn: checkCI },
  { key: 'git', label: 'Git Hygiene', weight: 10, fn: checkGitHygiene },
  { key: 'build', label: 'Build / Lint Config', weight: 10, fn: checkBuildConfig, stackAware: true },
];

function statusOf(score) {
  if (score >= 80) return 'green';
  if (score >= 55) return 'yellow';
  return 'red';
}

export function gradeOf(score) {
  if (score >= 93) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 78) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 62) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

export function scanRepo(repoPath) {
  const repo = repoPath.replace(/\/$/, '');
  if (!existsSync(repo) || !statSync(repo).isDirectory()) {
    throw new Error(`Not a directory: ${repo}`);
  }
  const stack = detectStack(repo);
  const dims = DIMENSIONS.map((d) => {
    const res = d.stackAware ? d.fn(repo, stack) : d.fn(repo);
    return {
      key: d.key,
      label: d.label,
      weight: d.weight,
      score: res.score,
      status: statusOf(res.score),
      findings: res.findings,
      fixes: res.fixes,
    };
  });
  const overall = Math.round(dims.reduce((a, d) => a + d.score * d.weight, 0) / dims.reduce((a, d) => a + d.weight, 0));
  return {
    name: basename(repo),
    path: repo,
    stack,
    overall,
    grade: gradeOf(overall),
    status: statusOf(overall),
    dimensions: dims,
    scannedAt: new Date().toISOString(),
  };
}

// ---------- tiny utils ----------
function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }
function jsonOf(txt) { if (!txt) return null; try { return JSON.parse(txt); } catch { return null; } }
