'use strict';

require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const { App } = require('@slack/bolt');
const { generateAndSendLeadReport } = require('../src/report');

const app = new App({
  token:      process.env.SLACK_BOT_TOKEN,
  appToken:   process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

(async () => {
  await app.start();
  try {
    await generateAndSendLeadReport(app);
  } finally {
    await app.stop();
  }
})().catch(err => {
  console.error('[fatal]', err.message);
  process.exit(1);
});