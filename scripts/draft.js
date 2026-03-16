'use strict';

require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const { App }                  = require('@slack/bolt');
const { getAllMessageUserIds } = require('../src/collector');
const { generateDraft }        = require('../src/nlp');
const { sendDraft }            = require('../src/survey');

const app = new App({
  token:      process.env.SLACK_BOT_TOKEN,
  appToken:   process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

(async () => {
  await app.start();
  console.log('[draft] Slack connected');

  const userIds = getAllMessageUserIds();

  if (!userIds.length) {
    console.log('[draft] No users found in data/messages/ — nothing to do');
    await app.stop();
    return;
  }

  console.log(`[draft] Running NLP + survey flow for ${userIds.length} user(s): ${userIds.join(', ')}`);

  for (const userId of userIds) {
    try {
      console.log(`[draft] Generating draft for ${userId}...`);
      const result = await generateDraft(userId);
      if (!result) {
        console.log(`[draft] No messages for ${userId} — skipped`);
        continue;
      }
      await sendDraft(app, userId, result.draft);
      console.log(`[draft] Draft DM sent to ${userId}`);
    } catch (err) {
      console.error(`[draft] Error for ${userId}:`, err.message);
    }
  }

  await app.stop();
  console.log('[draft] Done');
})().catch(err => {
  console.error('[draft] Fatal:', err.message);
  process.exit(1);
});
