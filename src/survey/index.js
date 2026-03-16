'use strict';

const fs   = require('fs');
const path = require('path');
const { getWeekString } = require('../collector');

const SUBMISSIONS_DIR = path.join(__dirname, '../../data/submissions');

// ── Storage helpers ───────────────────────────────────────────────────────────

function hasSubmitted(userId) {
  const filePath = path.join(SUBMISSIONS_DIR, `${userId}.json`);
  if (!fs.existsSync(filePath)) return false;
  const week = getWeekString();
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    .some(entry => entry.week === week);
}

function saveSubmission(userId, answers) {
  fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });
  const now   = new Date();
  const entry = {
    userId,
    week:        getWeekString(),
    submittedAt: now.toISOString(),
    progress:    answers.progress,
    blocker:     answers.blocker,
    support:     answers.support,
  };
  const filePath = path.join(SUBMISSIONS_DIR, `${userId}-${new Date().toISOString().slice(0, 10)}.json`);
  const parsed  = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
    : [];
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  entries.push(entry);
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2));
  return entry;
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
        text: { type: 'mrkdwn', text: '*Progress this week*\n' + draft.progress },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Blockers*\n' + draft.blocker },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Support needed*\n' + draft.support },
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
    saveSubmission(userId, {
      progress: draft.progress,
      blocker:  draft.blocker,
      support:  draft.support,
    });

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
            block_id: 'progress_block',
            label:    { type: 'plain_text', text: 'What progress did you make this week?' },
            element: {
              type:          'plain_text_input',
              action_id:     'progress',
              multiline:     true,
              initial_value: draft.progress,
            },
          },
          {
            type:     'input',
            block_id: 'blocker_block',
            label:    { type: 'plain_text', text: 'Anything blocking you this week?' },
            element: {
              type:          'plain_text_input',
              action_id:     'blocker',
              multiline:     true,
              initial_value: draft.blocker,
            },
          },
          {
            type:     'input',
            block_id: 'support_block',
            label:    { type: 'plain_text', text: 'What support do you need?' },
            element: {
              type:          'plain_text_input',
              action_id:     'support',
              multiline:     true,
              initial_value: draft.support,
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
      progress: values.progress_block.progress.value,
      blocker:  values.blocker_block.blocker.value,
      support:  values.support_block.support.value,
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

module.exports = { sendDraft, registerSurveyActions, hasSubmitted, saveSubmission };
