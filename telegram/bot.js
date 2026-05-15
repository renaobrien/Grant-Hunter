// Telegram demo bot — lets non-technical people test the grants-bot from a DM.
// User sends /start, types their mission in one sentence, gets a sample digest back.
// In-memory state; long-polling (no webhook infra needed). Rate-limited per user/day.
//
// Run: node telegram/bot.js
// Requires: TELEGRAM_BOT_TOKEN (from @BotFather) + ANTHROPIC_API_KEY

require('dotenv').config();
const https = require('https');
const { ask } = require('../lib/claude');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN. Create a bot via @BotFather on Telegram and set the token.');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY.');
  process.exit(1);
}

const REPO_URL = process.env.REPO_URL || 'https://github.com/renaobrien/swb-grants-bot';
const MAX_TRIES_PER_DAY = Number(process.env.DEMO_MAX_TRIES || 3);

const userState = new Map();
const tryHistory = new Map();

function tg(method, params) {
  const body = JSON.stringify(params);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sendMessage(chat_id, text) {
  return tg('sendMessage', {
    chat_id,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });
}

function buildDemoPrompt(mission) {
  return `
You are a personal grants research agent running a one-shot demo.

USER'S MISSION (one sentence):
${mission}

Search the web for 3-5 currently-open grant opportunities aligned with this mission. Score each 1-5 for fit:
- 5: direct match — funder explicitly funds this mission area
- 4: strong match with credible framing angle
- 3: one clear axis of overlap, worth surfacing
- 1-2: tangential or mismatch — skip

Surface only fit_score 3+ with real future deadlines. Prefer official program pages over aggregators.

Return ONLY a JSON object (no prose before or after):
{
  "summary": "one line on what you found",
  "opportunities": [
    {
      "funder": "...",
      "program": "...",
      "amount": "$X or unknown",
      "deadline": "YYYY-MM-DD or rolling or unknown",
      "fit_score": 4,
      "framing_angle": "best angle for this user's mission",
      "source_url": "official program page"
    }
  ]
}
`;
}

function formatDigest(parsed) {
  if (!parsed.opportunities || !parsed.opportunities.length) {
    return `*No matching opportunities surfaced this run.*\n\nTry a more specific mission, or check back next week.`;
  }
  const lines = [`*${parsed.summary || 'Demo digest'}*`, ''];
  for (const o of parsed.opportunities) {
    lines.push(`*${o.funder} — ${o.program}*`);
    lines.push(`Fit ${o.fit_score}/5  ·  ${o.amount || '?'}  ·  Deadline: ${o.deadline || '?'}`);
    if (o.framing_angle) lines.push(`_${o.framing_angle}_`);
    if (o.source_url) lines.push(o.source_url);
    lines.push('');
  }
  return lines.join('\n');
}

function canTry(chatId) {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const history = (tryHistory.get(chatId) || []).filter(t => t > dayAgo);
  tryHistory.set(chatId, history);
  return history.length < MAX_TRIES_PER_DAY;
}

function recordTry(chatId) {
  const history = tryHistory.get(chatId) || [];
  history.push(Date.now());
  tryHistory.set(chatId, history);
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  if (text === '/start') {
    userState.set(chatId, { stage: 'awaiting-mission' });
    await sendMessage(chatId,
      "Welcome to the Grants Bot demo.\n\n" +
      "Tell me your organization's mission in *one sentence*. I'll search the web for grant opportunities that match it and score each 1–5.\n\n" +
      `_${MAX_TRIES_PER_DAY} tries per day. For unlimited runs + weekly cron + Sheet tracker, fork:_ ${REPO_URL}`
    );
    return;
  }

  if (text === '/help') {
    await sendMessage(chatId,
      `Send /start to try the bot. Type your mission in one sentence, get matching grants.\n\nThe full version (Google Sheet tracker, weekly cron, learning from your scores) is at ${REPO_URL}`
    );
    return;
  }

  const state = userState.get(chatId);
  if (!state || state.stage !== 'awaiting-mission') {
    await sendMessage(chatId, "Send /start to begin.");
    return;
  }

  if (text.length < 15) {
    await sendMessage(chatId, "Too short — give me a real sentence about what your org does.");
    return;
  }

  if (!canTry(chatId)) {
    await sendMessage(chatId, `You've hit the ${MAX_TRIES_PER_DAY}-try daily limit. Try again tomorrow, or fork for unlimited runs: ${REPO_URL}`);
    return;
  }

  recordTry(chatId);
  userState.delete(chatId);

  await sendMessage(chatId, "Searching… this takes about 30 seconds.");
  try {
    const { text: response } = await ask(buildDemoPrompt(text), `Run the grants search now.`, { useSearch: true });
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { opportunities: [] };
    await sendMessage(chatId, formatDigest(parsed));
    await sendMessage(chatId, `Want this every Monday with memory + a Google Sheet tracker? Fork: ${REPO_URL}`);
  } catch (err) {
    console.error('digest error:', err);
    await sendMessage(chatId, `Something broke on my end. Try /start again, or open an issue at ${REPO_URL}/issues`);
  }
}

async function pollUpdates() {
  let offset = 0;
  console.log('[grants-bot-tg] polling for updates');
  while (true) { // eslint-disable-line no-constant-condition
    try {
      const res = await tg('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
      if (res && res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          if (update.message) {
            handleMessage(update.message).catch(err => console.error('handler error:', err));
          }
        }
      }
    } catch (err) {
      console.error('poll error:', err);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

pollUpdates();
