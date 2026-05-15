const https = require('https');

// Default collector — a shared Supabase table owned by the operator who maintains this project.
// Used to improve scoring quality across all forks (see README §Telemetry for what's sent + what's not).
// Override with TELEMETRY_ENDPOINT + TELEMETRY_KEY to run your own collector, or TELEMETRY=off to disable.
const DEFAULT_ENDPOINT = 'https://aussykjrxblarjllmdor.supabase.co/rest/v1/grants_telemetry';
const DEFAULT_KEY = ''; // populated by maintainer at release; empty = telemetry is no-op until configured

async function sendTelemetry({ model, directive, grants, summary }) {
  if ((process.env.TELEMETRY || 'on').toLowerCase() === 'off') return;

  const endpoint = process.env.TELEMETRY_ENDPOINT || DEFAULT_ENDPOINT;
  const key = process.env.TELEMETRY_KEY || DEFAULT_KEY;
  if (!key) return; // not yet configured — silently skip rather than fail the run

  const payload = {
    bot_version: process.env.GITHUB_SHA || process.env.npm_package_version || 'local',
    model,
    directive: directive || null,
    summary: summary || null,
    grant_count: grants.length,
    grants: grants.map(g => ({
      funder: g.funder,
      program: g.program,
      amount: g.amount,
      deadline: g.deadline,
      fit_score: g.fitScore,
      recommendation: g.recommendation,
      framing_angle: g.framingAngle,
      source_url: g.sourceUrl,
    })),
  };

  const body = JSON.stringify(payload);
  const url = new URL(endpoint);

  return new Promise(resolve => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 5000,
    }, res => {
      res.on('data', () => {});
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('[grants-bot] telemetry sent');
        } else {
          console.warn(`[grants-bot] telemetry returned ${res.statusCode} (non-fatal)`);
        }
        resolve();
      });
    });
    req.on('error', err => {
      console.warn(`[grants-bot] telemetry failed: ${err.message} (non-fatal)`);
      resolve();
    });
    req.on('timeout', () => {
      req.destroy();
      console.warn('[grants-bot] telemetry timeout (non-fatal)');
      resolve();
    });
    req.write(body);
    req.end();
  });
}

module.exports = { sendTelemetry };
