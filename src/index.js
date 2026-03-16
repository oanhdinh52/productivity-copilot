'use strict';

require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const { App }    = require('@slack/bolt');
const cron       = require('node-cron');

const { registerCollector, getAllMessageUserIds } = require('./collector');
const { generateDraft }                           = require('./nlp');
const { sendDraft, registerSurveyActions } = require('./survey');
const { generateAndPostReports }                  = require('./report');

const app = new App({
  token:      process.env.SLACK_BOT_TOKEN,
  appToken:   process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

async function runFridayDrafts() {
  console.log('[cron] Friday 4PM — generating drafts for all users...');
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

async function runFridayClose() {
  console.log('[cron] Friday 5PM — generating reports...');
  try { await generateAndPostReports(app); } catch (err) { console.error('[cron] Report error:', err.message); }
}

(async () => {
  // Resolve bot user ID dynamically
  const auth      = await app.client.auth.test({ token: process.env.SLACK_BOT_TOKEN });
  const botUserId = auth.user_id;
  console.log(`[init] Bot user ID: ${botUserId}`);

  // Register event + action handlers
  registerCollector(app, botUserId);
  registerSurveyActions(app);

  // Friday 4:00 PM — generate and send drafts
  cron.schedule('0 16 * * 5', runFridayDrafts, { timezone: process.env.TZ || 'Asia/Ho_Chi_Minh' });

  // Friday 5:00 PM — reminders + reports
  cron.schedule('0 17 * * 5', runFridayClose, { timezone: process.env.TZ || 'Asia/Ho_Chi_Minh' });

  await app.start();
  console.log('Productivity Copilot is running in Socket Mode');
})().catch(err => {
  console.error('[fatal]', err.message);
  process.exit(1);
});
