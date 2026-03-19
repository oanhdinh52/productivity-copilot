'use strict';

const { AzureOpenAI }       = require('openai');
const { getWeekString, loadMessages } = require('../collector');
const log = require('../logger');

// Strip control chars and truncate to guard against prompt injection
function sanitiseInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, 2000);
}

function buildClient() {
  return new AzureOpenAI({
    endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
    apiKey:     process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT_DEFAULT,
  });
}

async function generateDraft(userId) {
  const data = loadMessages(userId);

  if (!data.messages.length) {
    log.info('nlp.skipped', { user_id: userId, action: 'generate_draft', outcome: 'no_messages' });
    return null;
  }

  const client = buildClient();

  const messageLog = data.messages
    .map(m => `${m.priority ? '[FLAGGED] ' : ''}${sanitiseInput(m.text)}`)
    .join('\n');

  const prompt = `You are a helpful assistant summarising an employee's Slack activity into a weekly survey.

Based on the messages below, draft concise answers (2–3 sentences each) for the 3 survey questions.
Return valid JSON only — no markdown, no explanation.

Messages from this week:
${messageLog}

Survey questions:
1. What are the key things you made progress on this week?
2. Anything blocked you this week from achieving your goals?
3. Anything you need to be more productive or support you better?

Return format:
{"progress": "...", "blocker": "...", "support": "..."}`;

  const response = await client.chat.completions.create({
    model:           process.env.AZURE_OPENAI_DEPLOYMENT_DEFAULT,
    messages:        [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const draft = JSON.parse(response.choices[0].message.content);

  return { userId, week: getWeekString(), draft };
}

module.exports = { generateDraft };
