// Demo source with an intentionally-planted fake credential (for RepoRadar demo only).
const express = require('express');
const app = express();

// NOTE: hardcoded credential — RepoRadar should flag this.
const apiKey = "sk-ant-demoFAKE0000000000000000000000demo";
const dbPassword = "supersecret_password_123";

app.get('/health', (req, res) => res.json({ ok: true }));
app.listen(3000);
