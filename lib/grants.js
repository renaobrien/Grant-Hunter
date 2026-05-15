const { appendRow, getRows, updateRow } = require('./sheets');

const GRANTS_TAB = 'Grants';
const GRANTS_HEADERS = [
  'Scoring',
  'Rejection Reason',
  'ID',
  'Date Added',
  'Funder',
  'Program Name',
  'Amount',
  'Deadline',
  'Fit Score',
  'Recommendation',
  'Confidence',
  'Status',
  'Framing Angle',
  'Eligibility Notes',
  'Blockers',
  'Notes',
  'Contacts',
  'Source URL',
  'Application URL',
  'Last Verified',
  'Last Weekly Digest',
];

const CLOSED_STATUSES = new Set(['applied', 'submitted', 'awarded', 'passed', 'discarded', 'dead']);
const ACTIVE_STATUSES = new Set(['found', 'researching', 'drafting']);

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

function cleanText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function cleanUrl(value) {
  const text = cleanText(value);
  if (!text) return 'unknown';
  return /^https?:\/\//i.test(text) ? text : 'unknown';
}

function normalizeStatus(status) {
  return cleanText(status, 'found').toLowerCase();
}

function normalizeRecommendation(value) {
  const normalized = cleanText(value, 'maybe').toLowerCase();
  return ['pursue', 'maybe', 'pass'].includes(normalized) ? normalized : 'maybe';
}

function normalizeConfidence(value) {
  const normalized = cleanText(value, 'medium').toLowerCase();
  return ['low', 'medium', 'high'].includes(normalized) ? normalized : 'medium';
}

function normalizeFitScore(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 3;
  return Math.min(5, Math.max(1, parsed));
}

function normalizeDeadline(value) {
  const text = cleanText(value, 'unknown').toLowerCase();
  if (!text) return 'unknown';
  if (text === 'rolling' || text === 'unknown') return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toISOString().split('T')[0];
}

function normalizeScoring(value) {
  const text = cleanText(value);
  if (!text) return '';
  const numeric = Number.parseFloat(text);
  if (!Number.isNaN(numeric)) {
    return String(Math.min(5, Math.max(1, numeric)));
  }
  return text;
}

function daysUntil(deadlineStr) {
  if (!deadlineStr || deadlineStr === 'rolling' || deadlineStr === 'unknown') return null;
  const deadline = new Date(deadlineStr);
  if (Number.isNaN(deadline.getTime())) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
}

function isClosedGrant(grant) {
  return CLOSED_STATUSES.has(normalizeStatus(grant.status));
}

function isPastDeadline(grant) {
  const days = daysUntil(grant.deadline);
  return days !== null && days < 0;
}

function rowToGrant(row, rowNumber) {
  return {
    rowNumber,
    scoring: normalizeScoring(row[0]),
    rejectionReason: cleanText(row[1]),
    id: cleanText(row[2]),
    dateAdded: cleanText(row[3]),
    funder: cleanText(row[4], 'Unknown funder'),
    program: cleanText(row[5], 'Unknown program'),
    amount: cleanText(row[6], 'unknown'),
    deadline: normalizeDeadline(row[7]),
    fitScore: normalizeFitScore(row[8]),
    recommendation: normalizeRecommendation(row[9]),
    confidence: normalizeConfidence(row[10]),
    status: normalizeStatus(row[11]),
    framingAngle: cleanText(row[12], 'Mixed'),
    eligibilityNotes: cleanText(row[13], 'Unknown'),
    blockers: cleanText(row[14], 'Unknown'),
    notes: cleanText(row[15], ''),
    contacts: cleanText(row[16]),
    sourceUrl: cleanUrl(row[17]),
    applicationUrl: cleanUrl(row[18]),
    lastVerified: cleanText(row[19], row[3] || ''),
    lastWeeklyDigest: cleanText(row[20]),
    daysUntilDeadline: daysUntil(row[7]),
  };
}

function grantToRow(grant) {
  return [
    normalizeScoring(grant.scoring),
    cleanText(grant.rejectionReason),
    cleanText(grant.id),
    cleanText(grant.dateAdded),
    cleanText(grant.funder),
    cleanText(grant.program),
    cleanText(grant.amount, 'unknown'),
    normalizeDeadline(grant.deadline),
    String(normalizeFitScore(grant.fitScore)),
    normalizeRecommendation(grant.recommendation),
    normalizeConfidence(grant.confidence),
    normalizeStatus(grant.status),
    cleanText(grant.framingAngle, 'Mixed'),
    cleanText(grant.eligibilityNotes, 'Unknown'),
    cleanText(grant.blockers, 'Unknown'),
    cleanText(grant.notes),
    cleanText(grant.contacts),
    cleanUrl(grant.sourceUrl),
    cleanUrl(grant.applicationUrl),
    cleanText(grant.lastVerified, todayIsoDate()),
    cleanText(grant.lastWeeklyDigest),
  ];
}

function matchesGrant(existingGrant, incomingGrant) {
  const existingUrls = [existingGrant.applicationUrl, existingGrant.sourceUrl].filter(u => u && u !== 'unknown');
  const incomingUrls = [incomingGrant.applicationUrl, incomingGrant.sourceUrl].filter(u => u && u !== 'unknown');

  if (incomingUrls.length && existingUrls.some(url => incomingUrls.includes(url))) {
    return true;
  }

  return cleanText(existingGrant.funder).toLowerCase() === cleanText(incomingGrant.funder).toLowerCase()
    && cleanText(existingGrant.program).toLowerCase() === cleanText(incomingGrant.program).toLowerCase();
}

function mergeGrant(existingGrant, incomingGrant) {
  const today = todayIsoDate();

  if (!existingGrant) {
    return {
      id: cleanText(incomingGrant.id, `G-${Date.now()}`),
      dateAdded: today,
      funder: cleanText(incomingGrant.funder, 'Unknown funder'),
      program: cleanText(incomingGrant.program, 'Unknown program'),
      amount: cleanText(incomingGrant.amount, 'unknown'),
      deadline: normalizeDeadline(incomingGrant.deadline),
      fitScore: normalizeFitScore(incomingGrant.fitScore),
      recommendation: normalizeRecommendation(incomingGrant.recommendation),
      confidence: normalizeConfidence(incomingGrant.confidence),
      status: normalizeStatus(incomingGrant.status),
      framingAngle: cleanText(incomingGrant.framingAngle, 'Mixed'),
      eligibilityNotes: cleanText(incomingGrant.eligibilityNotes, 'Unknown'),
      blockers: cleanText(incomingGrant.blockers, 'Unknown'),
      notes: cleanText(incomingGrant.notes),
      contacts: cleanText(incomingGrant.contacts),
      sourceUrl: cleanUrl(incomingGrant.sourceUrl),
      applicationUrl: cleanUrl(incomingGrant.applicationUrl),
      lastVerified: today,
      scoring: normalizeScoring(incomingGrant.scoring),
      lastWeeklyDigest: cleanText(incomingGrant.lastWeeklyDigest),
      rejectionReason: '',
    };
  }

  return {
    ...existingGrant,
    funder: cleanText(incomingGrant.funder, existingGrant.funder),
    program: cleanText(incomingGrant.program, existingGrant.program),
    amount: cleanText(incomingGrant.amount, existingGrant.amount),
    deadline: normalizeDeadline(incomingGrant.deadline || existingGrant.deadline),
    fitScore: normalizeFitScore(incomingGrant.fitScore || existingGrant.fitScore),
    recommendation: normalizeRecommendation(incomingGrant.recommendation || existingGrant.recommendation),
    confidence: normalizeConfidence(incomingGrant.confidence || existingGrant.confidence),
    status: normalizeStatus(incomingGrant.status || existingGrant.status || 'found'),
    framingAngle: cleanText(incomingGrant.framingAngle, existingGrant.framingAngle),
    eligibilityNotes: cleanText(incomingGrant.eligibilityNotes, existingGrant.eligibilityNotes),
    blockers: cleanText(incomingGrant.blockers, existingGrant.blockers),
    notes: cleanText(incomingGrant.notes, existingGrant.notes),
    contacts: cleanText(incomingGrant.contacts || existingGrant.contacts),
    sourceUrl: cleanUrl(incomingGrant.sourceUrl || existingGrant.sourceUrl),
    applicationUrl: cleanUrl(incomingGrant.applicationUrl || existingGrant.applicationUrl),
    lastVerified: today,
    scoring: normalizeScoring(existingGrant.scoring || incomingGrant.scoring),
    lastWeeklyDigest: cleanText(existingGrant.lastWeeklyDigest),
    rejectionReason: cleanText(existingGrant.rejectionReason),
  };
}

async function listTrackedGrants() {
  const rows = await getRows(GRANTS_TAB);
  return rows.map((row, index) => rowToGrant(row, index + 1));
}

async function upsertGrant(incomingGrant, existingGrants) {
  const grants = existingGrants || await listTrackedGrants();
  const existingGrant = grants.find(grant => matchesGrant(grant, incomingGrant));
  const mergedGrant = mergeGrant(existingGrant, incomingGrant);

  if (existingGrant) {
    await updateRow(GRANTS_TAB, existingGrant.rowNumber, grantToRow(mergedGrant));
    return { grant: mergedGrant, action: 'updated' };
  }

  await appendRow(GRANTS_TAB, grantToRow(mergedGrant));
  return { grant: mergedGrant, action: 'created' };
}

function buildPreferenceContext(grants) {
  const scoredGrants = grants
    .map(grant => ({ ...grant, numericScore: Number.parseFloat(grant.scoring) }))
    .filter(grant => !Number.isNaN(grant.numericScore));

  if (!scoredGrants.length) {
    return 'No human scoring feedback yet. Score honestly per the user\'s calibration scenarios in the system prompt; do not overfit.';
  }

  const liked = scoredGrants
    .filter(grant => grant.numericScore >= 4)
    .sort((a, b) => b.numericScore - a.numericScore)
    .slice(0, 5)
    .map(grant => `${grant.funder} — ${grant.program} (${grant.numericScore}/5; ${grant.framingAngle})`);

  const disliked = scoredGrants
    .filter(grant => grant.numericScore <= 2)
    .slice(0, 5)
    .map(grant => `${grant.funder} — ${grant.program}${grant.rejectionReason ? ` (${grant.rejectionReason})` : ''}`);

  const sections = [];
  if (liked.length) sections.push(`Strong fits the user confirmed — find more like these: ${liked.join(' | ')}`);
  if (disliked.length) sections.push(`Poor fits the user rejected — avoid similar programs: ${disliked.join(' | ')}`);

  return sections.length ? sections.join('\n') : 'No strong calibration signal yet.';
}

async function getPreferenceContext() {
  const grants = await listTrackedGrants();
  return buildPreferenceContext(grants);
}

function formatDeadlineDisplay(deadline) {
  if (!deadline || deadline === 'unknown' || deadline === 'rolling') return deadline;
  const parts = deadline.split('-');
  if (parts.length !== 3) return deadline;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function changedSinceWeeklyDigest(grant) {
  return !grant.lastWeeklyDigest;
}

async function discardPastDeadlineGrants() {
  const grants = await listTrackedGrants();
  const toDiscard = grants.filter(g => isPastDeadline(g) && !isClosedGrant(g));
  for (const g of toDiscard) {
    await updateRow(GRANTS_TAB, g.rowNumber, grantToRow({ ...g, status: 'discarded' }));
  }
  return toDiscard;
}

async function markWeeklyDigest(grants) {
  const today = todayIsoDate();
  for (const grant of grants) {
    if (!grant.rowNumber) continue;
    await updateRow(GRANTS_TAB, grant.rowNumber, grantToRow({ ...grant, lastWeeklyDigest: today }));
  }
}

module.exports = {
  GRANTS_TAB,
  GRANTS_HEADERS,
  CLOSED_STATUSES,
  ACTIVE_STATUSES,
  todayIsoDate,
  daysUntil,
  formatDeadlineDisplay,
  rowToGrant,
  grantToRow,
  listTrackedGrants,
  upsertGrant,
  matchesGrant,
  getPreferenceContext,
  isClosedGrant,
  isPastDeadline,
  changedSinceWeeklyDigest,
  discardPastDeadlineGrants,
  markWeeklyDigest,
};
