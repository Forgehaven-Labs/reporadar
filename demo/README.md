# RepoRadar demo fixture

`sample-repo/` is a **deliberately imperfect** Node project bundled with RepoRadar so
the scanner has something realistic to flag during demos and tests. It is not a real
service and is never installed or run.

## What is intentionally "wrong" here

- `sample-repo/src/index.js` contains two **planted, synthetic** credential strings so
  the secret scanner has a concrete hardcoded-secret to detect. These are FAKE values,
  not real keys. They are required test fixtures: do not remove or replace them with
  real credentials.
- `sample-repo/.env.sample` is a placeholder env file with obviously-fake values
  (`EXAMPLE_NOT_A_REAL_KEY...`). It is named `.env.sample` (not `.env`) on purpose so a
  clone of RepoRadar does not ship a committed `.env`. Every value in it is synthetic.
- `sample-repo/package.json` uses loose dependency ranges (`*`, `latest`) on purpose so
  the dependency-hygiene dimension has something to warn about.
- `sample-repo/README.md` is intentionally thin so the documentation dimension scores low.

## Running the demo

```bash
npm run demo   # scans demo/sample-repo and writes reports under out/
```

The expected result is a low (red) score: that is the point. The demo shows RepoRadar
correctly catching real-looking hygiene problems, using only synthetic fixtures.
