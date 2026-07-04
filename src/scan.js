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

// Hardened git invocation. RepoRadar scans UNTRUSTED repos, and git honors the
// scanned repo's own .git/config — a planted `core.fsmonitor` or `core.hooksPath`
// executes an arbitrary program during an otherwise read-only `git status`. That
// would turn the scanner into a remote-code-execution vector, voiding its core
// "static-only, safe to point at code you don't trust" promise. We neutralize
// every config-driven exec vector on the command line (`-c` beats the repo's
// local config), refuse system/global config, and disable prompts/locks. See the
// hostile-core.fsmonitor regression test. Also bounded in time and output so a
// pathological repo cannot hang or OOM the scan.
const GIT_SAFE_FLAGS = [
  '-c', 'core.fsmonitor=',
  '-c', 'core.hooksPath=/dev/null',
  '-c', 'core.pager=cat',
  '-c', 'core.editor=true',
  '-c', 'protocol.ext.allow=never',
];
const GIT_SAFE_ENV = {
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
  GIT_OPTIONAL_LOCKS: '0',
};

function git(repo, args) {
  try {
    return execFileSync('git', [...GIT_SAFE_FLAGS, ...args], {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, ...GIT_SAFE_ENV },
      timeout: 10000,
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  } catch {
    return null;
  }
}

// Linear, non-backtracking wildcard match for ONE path segment. '*' matches any
// run of non-'/' chars, '?' one char. Classic two-pointer greedy algorithm (O(n)),
// so a hostile pattern like `*a*a*a…` cannot cause the catastrophic backtracking a
// compiled RegExp would. The .reporadarignore is read from the scanned (untrusted)
// repo, so this matcher must be DoS-proof.
function matchSegment(pat, str) {
  let p = 0, s = 0, star = -1, mark = 0;
  while (s < str.length) {
    if (p < pat.length && (pat[p] === '?' || pat[p] === str[s])) { p++; s++; }
    else if (p < pat.length && pat[p] === '*') { star = p++; mark = s; }
    else if (star !== -1) { p = star + 1; s = ++mark; }
    else return false;
  }
  while (p < pat.length && pat[p] === '*') p++;
  return p === pat.length;
}

// Does the segment pattern match a leading run of the path? gitignore-style prefix
// semantics: `demo/` (→ ['demo']) also matches `demo/foo/bar`. '**' matches zero or
// more whole segments. Recursion is bounded by segment counts (path depth is tiny)
// and every segment test is linear, so there is no exponential blowup.
function matchPathGlob(patSegs, pi, pathSegs, si) {
  while (pi < patSegs.length) {
    if (patSegs[pi] === '**') {
      for (let k = si; k <= pathSegs.length; k++) {
        if (matchPathGlob(patSegs, pi + 1, pathSegs, k)) return true;
      }
      return false;
    }
    if (si >= pathSegs.length) return false;
    if (!matchSegment(patSegs[pi], pathSegs[si])) return false;
    pi++; si++;
  }
  return true; // pattern consumed → prefix match (trailing path segments allowed)
}

// Load .reporadarignore (gitignore-style) from the scan root and return a predicate
// that tests a path RELATIVE to that root. This is how a repo opts specific paths
// (vendored code, generated output, test fixtures) out of the scan. It is opt-in per
// repo: a repo with no .reporadarignore is scanned exactly as before, so default
// secret detection is never weakened. Supports bare names (match a segment at any
// depth, gitignore-style), slash-anchored paths (relative to the scan root), and a
// simple `*`/`**` glob. Patterns are matched with a non-backtracking matcher, and
// pattern/path lengths and counts are capped, so an untrusted ignore file cannot
// wedge the scan (ReDoS).
function loadIgnore(repo) {
  const raw = read(join(repo, '.reporadarignore'));
  if (!raw) return () => false;
  const patterns = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.replace(/\/+$/, '')); // a trailing slash is cosmetic here
  if (!patterns.length) return () => false;
  const safe = patterns
    .filter((l) => l.length <= 256) // ignore absurdly long patterns outright
    .slice(0, 500); // and cap how many we honor
  const matchers = safe.map((pat) => {
    if (pat.includes('*') || pat.includes('?')) {
      const patSegs = pat.split('/');
      return (rel) => matchPathGlob(patSegs, 0, rel.split('/'), 0);
    }
    if (pat.includes('/')) {
      // anchored to the scan root
      return (rel) => rel === pat || rel.startsWith(pat + '/');
    }
    // bare name: match that path segment at any depth
    return (rel) => rel === pat || rel.split('/').includes(pat);
  });
  return (rel) => rel.length <= 4096 && matchers.some((m) => m(rel));
}

// Walk repo collecting source files, skipping noise. Bounded for speed.
function listSourceFiles(repo, limit = 4000) {
  const out = [];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', 'vendor', 'Pods', '.venv', 'venv', '__pycache__', 'bin', 'obj', 'DerivedData', 'coverage', '.gradle', 'target']);
  const ignored = loadIgnore(repo);
  const stack = [repo];
  while (stack.length && out.length < limit) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.github' && e.name !== '.env') continue;
      if (skip.has(e.name)) continue;
      const full = join(dir, e.name);
      const rel = full.slice(repo.length).replace(/^[/\\]+/, '');
      if (ignored(rel)) continue;
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile()) out.push(full);
      if (out.length >= limit) break;
    }
  }
  return out;
}

// Recognize a test file across the languages RepoRadar detects. The old check only
// saw JS/Python `foo.test.js` / `test_foo.py` conventions, so Swift (`FooTests.swift`),
// Kotlin/Java (`FooTest.kt`), .NET (`FooTests.cs`) and Go (`foo_test.go`) suites scored
// as zero tests — the single biggest false negative when scanning a mixed portfolio.
// The extension guard also stops docs like `PRODUCT_SPEC.md` from counting as tests.
const TEST_CODE_EXT = /\.(js|jsx|ts|tsx|mjs|cjs|py|swift|kt|kts|java|cs|go|rb|rs|scala|groovy|php)$/i;
function isTestFile(name) {
  if (!TEST_CODE_EXT.test(name)) return false;
  return (
    /(\.|_|-)(test|spec)\.[a-z]+$/i.test(name) ||       // foo.test.ts, foo_test.js, foo-spec.tsx
    /^test_.*\.py$/i.test(name) ||                      // test_foo.py (pytest)
    /_test\.(go|py|rb|rs)$/i.test(name) ||              // foo_test.go, foo_test.rb
    /_spec\.rb$/i.test(name) ||                         // foo_spec.rb (RSpec)
    /Tests?\.(swift|kt|kts|java|cs|scala|groovy)$/.test(name) || // FooTests.swift, FooTest.kt, FooTests.cs
    /Spec\.(kt|kts|groovy|scala)$/.test(name)           // FooSpec.kt (Kotest/Spock)
  );
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
  const hasTestDir = testDirs.some((d) => existsSync(join(repo, d))) || existsSync(join(repo, 'src', 'test'));
  const files = listSourceFiles(repo);
  const testFiles = files.filter((f) => isTestFile(basename(f)));

  if (pkg?.scripts?.test && !/no test specified/i.test(pkg.scripts.test)) {
    score += 40;
    findings.push({ level: 'ok', msg: `npm test script defined: \`${pkg.scripts.test}\`` });
  } else if (stack.includes('Node/JS')) {
    findings.push({ level: 'bad', msg: 'No real `test` script in package.json' });
    fixes.push('Add a real `test` script (e.g. `"test": "node --test"` or vitest/jest) to package.json.');
  } else if (testFiles.length > 0) {
    // Non-Node stacks have an implicit runner (go test, xcodebuild test, dotnet test,
    // gradle/maven test, pytest). Recognizing the test files means the runner exists,
    // so give the same credit a package.json test script gets — don't penalize a Swift
    // or .NET suite for not having an npm script.
    score += 40;
    findings.push({ level: 'ok', msg: `Test runner implied by ${stack[0]} test files` });
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

  const hasCoverageSignal =
    has(repo, 'coverage', '.nyc_output', '.codecov.yml', 'codecov.yml') ||
    pkg?.scripts?.coverage ||
    /jacoco|-enableCodeCoverage|--cover|-cover\b/i.test(
      [read(join(repo, 'build.gradle')), read(join(repo, 'build.gradle.kts'))].filter(Boolean).join('\n'),
    );
  if (hasCoverageSignal) {
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

const CI_RUNS_TESTS = /test|pytest|node --test|vitest|jest|xcodebuild|go test|dotnet test|gradlew? (test|check)/i;

function checkCI(repo) {
  const findings = [];
  const fixes = [];
  let score = 0;
  const ghDir = join(repo, '.github', 'workflows');
  let workflows = [];
  try { workflows = readdirSync(ghDir).filter((f) => /\.ya?ml$/.test(f)); } catch {}
  const ciFile = firstExisting(repo, ['Jenkinsfile', '.gitlab-ci.yml', 'azure-pipelines.yml']);
  let ciText = null;
  if (workflows.length) {
    findings.push({ level: 'ok', msg: `${workflows.length} GitHub Actions workflow(s)` });
    ciText = workflows.map((w) => read(join(ghDir, w)) || '').join('\n');
  } else if (ciFile) {
    findings.push({ level: 'ok', msg: `CI configuration present (${ciFile})` });
    ciText = read(join(repo, ciFile)) || '';
  } else if (has(repo, '.circleci')) {
    findings.push({ level: 'ok', msg: 'CI configuration present (.circleci)' });
    try { ciText = readdirSync(join(repo, '.circleci')).map((f) => read(join(repo, '.circleci', f)) || '').join('\n'); } catch { ciText = ''; }
  }
  if (ciText !== null) {
    score += 70;
    // A Jenkinsfile that delegates to a shared-library pipeline (e.g. `iosPipeline()`,
    // `androidPipeline()`, `staticPipeline()`) runs tests inside that library, which the
    // repo-local file doesn't spell out — credit those the same as an inline test step.
    const runsTests = CI_RUNS_TESTS.test(ciText) || /\b\w+Pipeline\s*\(/.test(ciText);
    if (runsTests) { score += 30; findings.push({ level: 'ok', msg: 'CI runs tests' }); }
    else { fixes.push('CI exists but does not appear to run tests — add a test stage.'); }
  } else {
    findings.push({ level: 'bad', msg: 'No CI configuration found' });
    fixes.push('Add CI (a Jenkinsfile or GitHub Actions workflow) that builds and tests on every push.');
  }
  return { score: clamp(score), findings, fixes };
}

function checkDependencies(repo, stack) {
  const findings = [];
  const fixes = [];
  let score = 50; // neutral baseline; adjust up/down
  const pkg = jsonOf(read(join(repo, 'package.json')));
  if (stack.includes('Node/JS')) {
    const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
    const total = Object.keys(deps).length;
    if (total === 0) {
      // Zero declared dependencies is the best possible supply-chain posture —
      // there is nothing to lock, float, or audit.
      score += 35;
      findings.push({ level: 'ok', msg: 'Zero declared dependencies — no supply-chain surface' });
    } else {
      const lock = firstExisting(repo, ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);
      if (lock) { score += 25; findings.push({ level: 'ok', msg: `Lockfile present (${basename(lock)})` }); }
      else { score -= 20; findings.push({ level: 'bad', msg: 'No lockfile — non-reproducible installs' }); fixes.push('Commit a lockfile (package-lock.json) for reproducible installs.'); }
      const looseRanges = Object.values(deps).filter((v) => typeof v === 'string' && /^[\^~]?\*$|^\*$|^latest$/.test(v)).length;
      if (looseRanges > 0) { score -= 15; findings.push({ level: 'warn', msg: `${looseRanges} dependency(ies) pinned to *, latest — unpredictable` }); fixes.push('Pin floating (*/latest) dependency versions to explicit ranges.'); }
      findings.push({ level: 'info', msg: `${total} declared dependencies` });
      score += 10;
    }
  } else if (stack.includes('Python')) {
    if (has(repo, 'requirements.txt', 'poetry.lock', 'Pipfile.lock', 'pyproject.toml')) { score += 35; findings.push({ level: 'ok', msg: 'Python dependency manifest present' }); }
    else { score -= 20; fixes.push('Add a requirements.txt or pyproject.toml to declare dependencies.'); }
  } else {
    findings.push({ level: 'info', msg: 'Dependency depth check skipped for this stack (static mode)' });
    score += 20;
  }
  return { score: clamp(score), findings, fixes };
}

// High-confidence provider token formats. These are self-identifying key shapes —
// a match is a finding, full stop, with no value inspection needed.
const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key id'],
  [/-----BEGIN (RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY-----/, 'Private key block'],
  [/sk-[A-Za-z0-9]{20,}/, 'OpenAI-style secret key'],
  [/sk-ant-[A-Za-z0-9_\-]{20,}/, 'Anthropic API key'],
  [/ghp_[A-Za-z0-9]{30,}/, 'GitHub personal access token'],
  [/AIza[0-9A-Za-z\-_]{30,}/, 'Google API key'],
  [/xox[baprs]-[0-9A-Za-z\-]{10,}/, 'Slack token'],
];

// Generic `keyword = "value"` credential assignment. Far lower precision than the
// prefix formats above: in real production code the same shape is overwhelmingly a
// CONFIG-KEY constant whose value is itself an identifier — `KeyLLMAPIKey =
// "llm_api_key"`, `ENV_TOKEN = "TRADIER_TOKEN"`, `Password = "password"` (an auth
// provider enum name), a `token: "X-App-Token"` header name — not a leaked secret.
// So we capture the VALUE (group 1) and, unlike the prefix patterns, only flag it
// when the value doesn't look like an identifier/env-var/reference (see
// isNonSecretValue). Global flag so every assignment in a file is inspected, not
// just the first — a file with one inert value and one real secret must still flag.
const CREDENTIAL_ASSIGNMENT =
  /(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']([^"'\s]{8,})["']/gi;
const CREDENTIAL_LABEL = 'Hardcoded credential assignment';

// Precision guard for CREDENTIAL_ASSIGNMENT. Returns true when the captured value is
// an inert shape that a real credential never takes: a config-key/env-var NAME, an
// enum/provider constant, a bare variable reference, or a template placeholder.
// Deliberately conservative so sensitivity is never lowered — ANY value carrying a
// digit, mixed-case-with-punctuation, or an embedded literal default (the shell
// `${VAR:-default}` form) falls through and is still flagged as a possible secret.
// Real leaked credentials essentially always carry entropy (digits, symbols beyond
// identifier separators); constant NAMES do not.
function isNonSecretValue(v) {
  // Bare variable / environment references and template placeholders. Note that a
  // shell default-expansion like ${CAIRO_DEMO_PG_PASSWORD:-cairo-demo} does NOT match
  // any of these (the `:-default` breaks the pure-reference shape), so its hardcoded
  // default password is preserved as a finding.
  if (/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(v)) return true;      // $PG_PASSWORD
  if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(v)) return true;  // ${OWNER_PW}
  if (/^%[A-Za-z_][A-Za-z0-9_]*%$/.test(v)) return true;      // %API_TOKEN% (Windows env)
  if (/^env:[A-Za-z_][A-Za-z0-9_.-]*$/i.test(v)) return true; // env:CAIRO_MODEL_API_KEY
  if (/^<[^>]+>$/.test(v)) return true;                       // <password> placeholder
  if (/^\{\{.+\}\}$/.test(v)) return true;                    // {{ secret }} template
  // Identifier / config-key / env-var NAME shapes: SCREAMING_SNAKE, snake_case,
  // kebab-case, camelCase, dotted namespaces — letters with only `. _ -` separators
  // and NO digit. These are constant NAMES (TRADIER_TOKEN, llm_api_key, acrisAppToken,
  // cairo-vscode.llm_api_key, X-App-Token), never credential values. The no-digit
  // requirement keeps weak literal passwords (password123, admin1) flagged.
  if (/^[A-Za-z][A-Za-z._-]*$/.test(v)) return true;
  return false;
}

function checkSecrets(repo) {
  const findings = [];
  const fixes = [];
  const files = listSourceFiles(repo).filter((f) => {
    const ext = extname(f).toLowerCase();
    return !['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.ico', '.lock', '.svg', '.woff', '.woff2', '.ttf', '.map'].includes(ext);
  });
  let hits = 0;
  const seen = new Set();
  const record = (label, f) => {
    const key = label + ':' + f;
    if (seen.has(key)) return;
    seen.add(key);
    hits++;
    const rel = f.replace(repo, '').replace(/^\//, '');
    findings.push({ level: 'bad', msg: `Possible ${label} in ${rel}` });
    fixes.push(`Rotate and remove the ${label} found in ${rel}; load it from an env var instead. (P0)`);
  };
  for (const f of files.slice(0, 2500)) {
    const txt = read(f);
    if (!txt) continue;
    for (const [re, label] of SECRET_PATTERNS) {
      if (re.test(txt)) record(label, f);
    }
    // Credential assignments are only flagged when at least one captured value looks
    // like an actual secret rather than a config-key name / env reference / placeholder.
    // (matchAll clones the regex, so the shared lastIndex is not an issue across files.)
    for (const m of txt.matchAll(CREDENTIAL_ASSIGNMENT)) {
      if (!isNonSecretValue(m[1])) { record(CREDENTIAL_LABEL, f); break; }
    }
  }
  // .env committed? Flag if a .env is actually tracked by git (the real risk —
  // it's in history), OR present-and-not-gitignored (about to be committed). A
  // .env that is BOTH tracked AND listed in .gitignore is the sneaky case: the
  // old check trusted .gitignore and missed the already-committed file.
  if (has(repo, '.env')) {
    const tracked = git(repo, ['ls-files', '--', '.env']);
    if (tracked) {
      findings.push({ level: 'bad', msg: '.env is committed to git (tracked)' });
      fixes.push('Remove .env from git (`git rm --cached .env`), rotate anything in it, and keep it gitignored. (P0)');
      hits++;
    } else if (!gitIgnored(repo, '.env')) {
      findings.push({ level: 'bad', msg: '.env present and not gitignored' });
      fixes.push('Add .env to .gitignore and ensure no real secrets are committed.');
      hits++;
    }
  }
  // Any exposed secret is serious — one hit drops to red, more zeroes it out.
  const score = hits === 0 ? 100 : Math.max(0, 100 - hits * 50);
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
  if (has(repo, '.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs', 'eslint.config.js', '.ruff.toml', 'ruff.toml', '.flake8', '.golangci.yml', '.golangci.yaml', '.swiftlint.yml', '.swiftformat', 'detekt.yml', 'detekt.yaml', '.rubocop.yml', '.stylelintrc', '.stylelintrc.json') || pkg?.eslintConfig) {
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
