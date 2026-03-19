'use strict';

require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const { App }    = require('@slack/bolt');
const cron       = require('node-cron');

const log = require('./logger');

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
  log.info('cron.draft_started', { action: 'generate_drafts', outcome: 'started' });
  const userIds = getAllMessageUserIds();

  for (const userId of userIds) {
    try {
      const result = await generateDraft(userId);
      if (result) await sendDraft(app, userId, result.draft);
    } catch (err) {
      log.error('cron.draft_failed', { user_id: userId, action: 'generate_draft', outcome: 'error' });
    }
  }
}

async function runReport() {
  log.info('cron.report_started', { action: 'generate_report', outcome: 'started' });
  try { await generateAndSendLeadReport(app); } catch (err) { log.error('cron.report_failed', { action: 'generate_report', outcome: 'error' }); }
}

(async () => {
  // Resolve bot user ID dynamically
  const auth      = await app.client.auth.test({ token: process.env.SLACK_BOT_TOKEN });
  const botUserId = auth.user_id;
  log.info('init.bot_resolved', { action: 'resolve_bot_id', outcome: 'success' });

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

  log.info('scheduler.configured', { action: 'schedule_jobs', outcome: 'success' });

  cron.schedule(buildCron(draftDay, draftHour, draftMinute), runDrafts, { timezone: tz });
  cron.schedule(buildCron(reportDay, reportHour, reportMinute), runReport, { timezone: tz });

  await app.start();
  log.info('app.started', { action: 'start', outcome: 'success' });
})().catch(err => {
  log.error('app.fatal', { action: 'start', outcome: 'fatal_error' });
  process.exit(1);
});
