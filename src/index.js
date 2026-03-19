'use strict';

require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const { App }    = require('@slack/bolt');
const cron       = require('node-cron');

const { registerCollector, getAllMessageUserIds } = require('./collector');
const { generateDraft }                           = require('./nlp');
const { sendDraft, registerSurveyActions } = require('./survey');
const { generateAndSendLeadReport }               = require('./report');

const app = new App({
  token:      process.env.SLACK_BOT_TOKEN,
  appToken:   process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const DAY_NUMBER = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 };

function buildCron(day, hour, minute) {
  const dayNum = DAY_NUMBER[day.toLowerCase()];
  return `${minute} ${hour} * * ${dayNum}`;
}

async function runDrafts() {
  console.log('[cron] Draft time — generating drafts for all users...');
  const userIds = getAllMessageUserIds();

  for (const userId of userIds) {
    try {
      const result = await generateDraft(userId);
      if (result) await sendDraft(app, userId, result.draft);
    } catch (err) {
      console.error(`[cron] Draft error for ${userId}:`, err.message);
    }
  }
}

async function runReport() {
  console.log('[cron] Report time — generating team lead report...');
  try { await generateAndSendLeadReport(app); } catch (err) { console.error('[cron] Report error:', err.message); }
}

(async () => {
  // Resolve bot user ID dynamically
  const auth      = await app.client.auth.test({ token: process.env.SLACK_BOT_TOKEN });
  const botUserId = auth.user_id;
  console.log(`[init] Bot user ID: ${botUserId}`);

  // Register event + action handlers
  registerCollector(app, botUserId);
  registerSurveyActions(app);

  const tz = process.env.TZ || 'Asia/Ho_Chi_Minh';

  const cutoffDay    = process.env.COLLECTION_CUTOFF_DAY;
  const cutoffHour   = process.env.COLLECTION_CUTOFF_HOUR;
  const cutoffMinute = process.env.COLLECTION_CUTOFF_MINUTE;

  const draftDay    = process.env.DRAFT_DAY;
  const draftHour   = process.env.DRAFT_HOUR;
  const draftMinute = process.env.DRAFT_MINUTE;

  const reportDay    = process.env.REPORT_DAY;
  const reportHour   = process.env.REPORT_HOUR;
  const reportMinute = process.env.REPORT_MINUTE;

  console.log(`[scheduler] Cutoff: ${cutoffDay} at ${cutoffHour}:${String(cutoffMinute).padStart(2, '0')}`);
  console.log(`[scheduler] Draft:  ${draftDay} at ${draftHour}:${String(draftMinute).padStart(2, '0')}`);
  console.log(`[scheduler] Report: ${reportDay} at ${reportHour}:${String(reportMinute).padStart(2, '0')}`);

  cron.schedule(buildCron(draftDay, draftHour, draftMinute), runDrafts, { timezone: tz });
  cron.schedule(buildCron(reportDay, reportHour, reportMinute), runReport, { timezone: tz });

  await app.start();
  console.log('Productivity Copilot is running in Socket Mode');
})().catch(err => {
  console.error('[fatal]', err.message);
  process.exit(1);
});
