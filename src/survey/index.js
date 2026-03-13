'use strict';

const fs   = require('fs');
const path = require('path');
const { getWeekString } = require('../collector');

const SUBMISSIONS_DIR = path.join(__dirname, '../../data/submissions');

// ── Storage helpers ───────────────────────────────────────────────────────────

function hasSubmitted(userId) {
  const file = path.join(SUBMISSIONS_DIR, `${userId}.json`);
  if (!fs.existsSync(file)) return false;
  return JSON.parse(fs.readFileSync(file, 'utf8')).week === getWeekString();
}

function saveSubmission(userId, answers) {
  fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });
  const submission = {
    userId,
    week:        getWeekString(),
    submittedAt: new Date().toISOString(),
    q1:          answers.q1,
    q2:          answers.q2,
    q3:          answers.q3,
  };
  fs.writeFileSync(
    path.join(SUBMISSIONS_DIR, `${userId}.json`),
    JSON.stringify(submission, null, 2),
  );
  return submission;
}

// ── Draft DM ──────────────────────────────────────────────────────────────────

async function sendDraft(app, userId, draft) {
  await app.client.chat.postMessage({
    channel: userId,
    text:    'Your weekly survey draft is ready for review.',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Your Weekly Survey Draft', emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Q1 — Progress this week*\n' + draft.q1 },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Q2 — Blockers*\n' + draft.q2 },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Q3 — Support needed*\n' + draft.q3 },
      },
      { type: 'divider' },
      {
        type: 'actions',
        elements: [
          {
            type:      'button',
            text:      { type: 'plain_text', text: 'Edit & Submit', emoji: true },
            style:     'primary',
            action_id: 'open_edit_modal',
            value:     JSON.stringify(draft),
          },
          {
            type:      'button',
            text:      { type: 'plain_text', text: 'Submit As-Is', emoji: true },
            action_id: 'submit_as_is',
            value:     JSON.stringify(draft),
          },
        ],
      },
    ],
  });
  console.log(`[survey] Draft DM sent to ${userId}`);
}

// ── 5 PM reminder ─────────────────────────────────────────────────────────────

async function sendReminders(app) {
  const messagesDir = path.join(__dirname, '../../data/messages');
  if (!fs.existsSync(messagesDir)) return;

  const userIds = fs.readdirSync(messagesDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));

  for (const userId of userIds) {
    if (!hasSubmitted(userId)) {
      await app.client.chat.postMessage({
        channel: userId,
        text:    ':bell: Friendly reminder — your weekly survey draft is waiting. Please submit before EOD today.',
      });
      console.log(`[survey] Reminder sent to ${userId}`);
    }
  }
}

// ── Block Kit action handlers ─────────────────────────────────────────────────

function confirmedBlocks() {
  return [{
    type: 'section',
    text: { type: 'mrkdwn', text: ':white_check_mark: *Survey submitted — thank you!*' },
  }];
}

function registerSurveyActions(app) {
  // Submit As-Is button
  app.action('submit_as_is', async ({ ack, body, client }) => {
    await ack();
    const userId = body.user.id;
    const draft  = JSON.parse(body.actions[0].value);
    saveSubmission(userId, draft);

    await client.chat.update({
      channel: body.container.channel_id,
      ts:      body.container.message_ts,
      text:    'Survey submitted — thank you!',
      blocks:  confirmedBlocks(),
    });
    console.log(`[survey] ${userId} submitted as-is`);
  });

  // Edit & Submit button — opens modal
  app.action('open_edit_modal', async ({ ack, body, client }) => {
    await ack();
    const draft = JSON.parse(body.actions[0].value);

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type:             'modal',
        callback_id:      'submit_survey_modal',
        title:            { type: 'plain_text', text: 'Edit Your Survey' },
        submit:           { type: 'plain_text', text: 'Submit' },
        close:            { type: 'plain_text', text: 'Cancel' },
        private_metadata: JSON.stringify({
          channel: body.container.channel_id,
          ts:      body.container.message_ts,
        }),
        blocks: [
          {
            type:     'input',
            block_id: 'q1_block',
            label:    { type: 'plain_text', text: 'Q1 — What progress did you make this week?' },
            element: {
              type:          'plain_text_input',
              action_id:     'q1',
              multiline:     true,
              initial_value: draft.q1,
            },
          },
          {
            type:     'input',
            block_id: 'q2_block',
            label:    { type: 'plain_text', text: 'Q2 — Anything blocking you this week?' },
            element: {
              type:          'plain_text_input',
              action_id:     'q2',
              multiline:     true,
              initial_value: draft.q2,
            },
          },
          {
            type:     'input',
            block_id: 'q3_block',
            label:    { type: 'plain_text', text: 'Q3 — What support do you need?' },
            element: {
              type:          'plain_text_input',
              action_id:     'q3',
              multiline:     true,
              initial_value: draft.q3,
            },
          },
        ],
      },
    });
  });

  // Modal submission
  app.view('submit_survey_modal', async ({ ack, body, view, client }) => {
    await ack();
    const userId = body.user.id;
    const values = view.state.values;

    const answers = {
      q1: values.q1_block.q1.value,
      q2: values.q2_block.q2.value,
      q3: values.q3_block.q3.value,
    };

    saveSubmission(userId, answers);

    const { channel, ts } = JSON.parse(view.private_metadata);
    await client.chat.update({
      channel,
      ts,
      text:   'Survey submitted — thank you!',
      blocks: confirmedBlocks(),
    });
    console.log(`[survey] ${userId} submitted via modal`);
  });

  console.log('[survey] Block Kit action handlers registered');
}

module.exports = { sendDraft, sendReminders, registerSurveyActions, hasSubmitted, saveSubmission };
