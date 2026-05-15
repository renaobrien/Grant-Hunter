const nodemailer = require('nodemailer');
const { formatDeadlineDisplay, daysUntil } = require('./grants');

function makeTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function recommendationColor(recommendation) {
  if (recommendation === 'pursue') return '#15803d';
  if (recommendation === 'maybe') return '#b45309';
  return '#7f1d1d';
}

function deadlineLabel(grant) {
  const display = formatDeadlineDisplay(grant.deadline);
  if (!display || display === 'unknown') return 'Deadline unknown';
  if (display === 'rolling') return 'Rolling';
  const days = daysUntil(grant.deadline);
  if (days === null) return display;
  if (days < 0) return `${display} (past)`;
  if (days === 0) return `${display} (today)`;
  if (days === 1) return `${display} (1 day)`;
  return `${display} (${days} days)`;
}

function renderGrantHtml(grant, sheetUrl) {
  const link = grant.applicationUrl && grant.applicationUrl !== 'unknown'
    ? grant.applicationUrl
    : (grant.sourceUrl && grant.sourceUrl !== 'unknown' ? grant.sourceUrl : null);

  const recColor = recommendationColor(grant.recommendation);
  const idTag = grant.id ? `<code style="color:#6b7280;font-size:12px;">${escapeHtml(grant.id)}</code>` : '';

  return `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px;background:#ffffff;">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">${escapeHtml(deadlineLabel(grant))} ${idTag}</div>
      <div style="font-size:16px;font-weight:600;margin-bottom:8px;">
        ${escapeHtml(grant.funder)} — ${escapeHtml(grant.program)}
      </div>
      <div style="font-size:14px;margin-bottom:8px;">
        <span style="color:${recColor};font-weight:600;text-transform:uppercase;">${escapeHtml(grant.recommendation)}</span>
        <span style="color:#6b7280;"> (${escapeHtml(grant.confidence)} confidence) · Fit ${grant.fitScore}/5 · ${escapeHtml(grant.amount)}</span>
      </div>
      <div style="font-size:14px;color:#374151;margin-bottom:8px;">
        <strong>Angle:</strong> ${escapeHtml(grant.framingAngle)}
      </div>
      ${grant.notes ? `<div style="font-size:14px;color:#374151;margin-bottom:8px;">${escapeHtml(grant.notes)}</div>` : ''}
      ${grant.eligibilityNotes && grant.eligibilityNotes !== 'Unknown' ? `<div style="font-size:13px;color:#6b7280;margin-bottom:4px;"><strong>Eligibility:</strong> ${escapeHtml(grant.eligibilityNotes)}</div>` : ''}
      ${grant.blockers && grant.blockers !== 'Unknown' ? `<div style="font-size:13px;color:#6b7280;margin-bottom:4px;"><strong>Blockers:</strong> ${escapeHtml(grant.blockers)}</div>` : ''}
      ${grant.contacts ? `<div style="font-size:13px;color:#6b7280;margin-bottom:4px;"><strong>Contacts:</strong> ${escapeHtml(grant.contacts)}</div>` : ''}
      ${link ? `<div style="margin-top:8px;"><a href="${escapeHtml(link)}" style="color:#2563eb;text-decoration:none;">Open program page →</a></div>` : ''}
    </div>
  `;
}

function renderGrantText(grant) {
  const link = grant.applicationUrl && grant.applicationUrl !== 'unknown'
    ? grant.applicationUrl
    : (grant.sourceUrl && grant.sourceUrl !== 'unknown' ? grant.sourceUrl : '(no link)');

  return [
    `${deadlineLabel(grant)}${grant.id ? `  [${grant.id}]` : ''}`,
    `${grant.funder} — ${grant.program}`,
    `${grant.recommendation.toUpperCase()} (${grant.confidence}) · Fit ${grant.fitScore}/5 · ${grant.amount}`,
    `Angle: ${grant.framingAngle}`,
    grant.notes ? grant.notes : null,
    grant.eligibilityNotes && grant.eligibilityNotes !== 'Unknown' ? `Eligibility: ${grant.eligibilityNotes}` : null,
    grant.blockers && grant.blockers !== 'Unknown' ? `Blockers: ${grant.blockers}` : null,
    grant.contacts ? `Contacts: ${grant.contacts}` : null,
    link,
  ].filter(Boolean).join('\n');
}

function buildSubject(grants, weekOf) {
  const brand = process.env.BRAND_NAME || 'Grants Bot';
  const pursueCount = grants.filter(g => g.recommendation === 'pursue').length;
  if (!grants.length) return `[${brand}] ${weekOf} — no new opportunities`;
  if (pursueCount > 0) return `[${brand}] ${weekOf} — ${pursueCount} pursue, ${grants.length} total`;
  return `[${brand}] ${weekOf} — ${grants.length} new opportunities`;
}

function buildEmailBody({ grants, summary, weekOf, stats, sheetUrl }) {
  const sheetLink = sheetUrl
    ? `<a href="${escapeHtml(sheetUrl)}" style="color:#2563eb;text-decoration:none;">Open the Grants sheet →</a>`
    : 'Score grants in the Grants sheet (column B = Scoring 1–5).';

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;margin:0 auto;padding:24px;background:#f9fafb;">
      <div style="margin-bottom:24px;">
        <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(process.env.BRAND_NAME || 'Grants Bot')}</div>
        <div style="font-size:24px;font-weight:600;margin-top:4px;">Weekly Grants Digest</div>
        <div style="font-size:14px;color:#6b7280;margin-top:4px;">Week of ${escapeHtml(weekOf)}</div>
      </div>
      ${summary ? `<div style="font-size:14px;color:#374151;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:16px;">${escapeHtml(summary)}</div>` : ''}
      ${grants.length
        ? grants.map(g => renderGrantHtml(g, sheetUrl)).join('')
        : `<div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;text-align:center;color:#6b7280;">No new aligned opportunities this week.</div>`}
      <div style="margin-top:24px;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;">
        <div>${stats.created} new · ${stats.alreadyTracked} already tracked · ${stats.skippedPastDeadline} past-deadline · ${stats.discardedExpired} auto-discarded</div>
        <div style="margin-top:8px;">${sheetLink}</div>
        <div style="margin-top:8px;font-size:12px;">Score grants 1–5 in column B to teach the bot. Scores ≤2 are treated as negative signals.</div>
      </div>
    </div>
  `;

  const text = [
    `${process.env.BRAND_NAME || 'Grants Bot'} — Weekly Grants Digest`,
    `Week of ${weekOf}`,
    '',
    summary || '',
    '',
    grants.length
      ? grants.map(renderGrantText).join('\n\n---\n\n')
      : 'No new aligned opportunities this week.',
    '',
    `Stats: ${stats.created} new · ${stats.alreadyTracked} already tracked · ${stats.skippedPastDeadline} past-deadline · ${stats.discardedExpired} auto-discarded`,
    sheetUrl ? `Sheet: ${sheetUrl}` : '',
    'Score grants 1-5 in column B to teach the bot. Scores <=2 are treated as negative signals.',
  ].filter(Boolean).join('\n');

  return { html, text };
}

async function sendDigestEmail({ grants, summary, stats, sheetId }) {
  const recipients = (process.env.RECIPIENT_EMAIL || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (!recipients.length) {
    throw new Error('RECIPIENT_EMAIL is not set');
  }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be set (use a Gmail app password)');
  }

  const weekOf = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const sheetUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null;
  const { html, text } = buildEmailBody({ grants, summary, weekOf, stats, sheetUrl });
  const subject = buildSubject(grants, weekOf);

  const transport = makeTransport();
  const info = await transport.sendMail({
    from: process.env.FROM_EMAIL || process.env.SMTP_USER,
    to: recipients.join(', '),
    subject,
    text,
    html,
  });

  return { messageId: info.messageId, recipients };
}

module.exports = { sendDigestEmail };
