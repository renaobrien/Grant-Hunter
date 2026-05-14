require('dotenv').config();

const readline = require('readline');
const { runDigest } = require('./agents/digest');
const {
  listTrackedGrants,
  upsertGrant,
  matchesGrant,
  isPastDeadline,
  discardPastDeadlineGrants,
} = require('./lib/grants');
const { sendDigestEmail } = require('./lib/email');
const { MODEL } = require('./lib/claude');

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
}

function parseCliDirective() {
  const args = process.argv.slice(2);
  const flag = args.find(a => a.startsWith('--input=') || a.startsWith('--directive='));
  if (flag) return flag.split('=').slice(1).join('=').trim();
  const idx = args.findIndex(a => a === '--input' || a === '--directive');
  if (idx >= 0 && args[idx + 1]) return args[idx + 1].trim();
  return null;
}

async function promptDirective() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(resolve => {
    rl.question('Steering note for this run (optional, press Enter to skip): ', resolve);
  });
  rl.close();
  return answer.trim();
}

async function resolveDirective() {
  const cli = parseCliDirective();
  if (cli) return cli;
  const env = (process.env.DIRECTIVE || '').trim();
  if (env) return env;
  if (process.stdin.isTTY && process.stdout.isTTY) return await promptDirective();
  return '';
}

async function main() {
  for (const key of ['ANTHROPIC_API_KEY', 'SHEET_ID', 'GOOGLE_KEY_FILE', 'RECIPIENT_EMAIL', 'SMTP_USER', 'SMTP_PASSWORD']) {
    requireEnv(key);
  }

  const directive = await resolveDirective();
  console.log(`[swb-grants] starting weekly digest (model: ${MODEL})`);
  if (directive) console.log(`[swb-grants] directive: ${directive}`);

  // 1. Auto-discard tracked grants whose deadlines have passed
  const expired = await discardPastDeadlineGrants();
  console.log(`[swb-grants] auto-discarded ${expired.length} expired grants`);

  // 2. Search for new opportunities
  const digest = await runDigest({ directive });
  console.log(`[swb-grants] search returned ${digest.opportunities.length} opportunities`);
  if (digest.usage) {
    console.log(`[swb-grants] tokens — input: ${digest.usage.input_tokens}, output: ${digest.usage.output_tokens}`);
  }

  // 3. Filter, dedupe, persist
  const existing = await listTrackedGrants();
  const newGrants = [];
  let alreadyTracked = 0;
  let skippedPastDeadline = 0;

  for (const opp of digest.opportunities) {
    if (opp.recommendation === 'pass' || Number(opp.fitScore) < 3) continue;
    if (isPastDeadline(opp)) {
      skippedPastDeadline += 1;
      continue;
    }

    const existingMatch = existing.find(g => matchesGrant(g, opp));
    if (existingMatch && Number(existingMatch.scoring) <= 2) continue; // Jesse rejected, never re-surface
    if (existingMatch) {
      alreadyTracked += 1;
      continue; // already in sheet, don't re-email
    }

    const result = await upsertGrant({ ...opp, status: 'found' }, existing);
    if (result.action === 'created') {
      existing.push({ ...result.grant, rowNumber: existing.length + 1 });
      newGrants.push(result.grant);
    }
  }

  // Sort: pursue first, then by fit score, then by deadline urgency
  newGrants.sort((a, b) => {
    const recRank = { pursue: 0, maybe: 1, pass: 2 };
    if (recRank[a.recommendation] !== recRank[b.recommendation]) {
      return recRank[a.recommendation] - recRank[b.recommendation];
    }
    if (a.fitScore !== b.fitScore) return b.fitScore - a.fitScore;
    const aDays = a.daysUntilDeadline ?? Number.MAX_SAFE_INTEGER;
    const bDays = b.daysUntilDeadline ?? Number.MAX_SAFE_INTEGER;
    return aDays - bDays;
  });

  console.log(`[swb-grants] new: ${newGrants.length}, already tracked: ${alreadyTracked}, past deadline: ${skippedPastDeadline}, discarded expired: ${expired.length}`);

  // 4. Email Jesse
  const { messageId, recipients } = await sendDigestEmail({
    grants: newGrants,
    summary: digest.summary,
    stats: {
      created: newGrants.length,
      alreadyTracked,
      skippedPastDeadline,
      discardedExpired: expired.length,
    },
    sheetId: process.env.SHEET_ID,
  });

  console.log(`[swb-grants] email sent to ${recipients.join(', ')} (id: ${messageId})`);
}

main().catch(err => {
  console.error('[swb-grants] FATAL:', err);
  process.exit(1);
});
