'use strict';

const { AzureOpenAI }       = require('openai');
const { getWeekString, loadMessages } = require('../collector');

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
    console.log(`[nlp] No messages for ${userId} — skipping`);
    return null;
  }

  const client = buildClient();

  const messageLog = data.messages
    .map(m => `${m.priority ? '[FLAGGED] ' : ''}${m.text}`)
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
{"q1": "...", "q2": "...", "q3": "..."}`;

  const response = await client.chat.completions.create({
    model:           process.env.AZURE_OPENAI_DEPLOYMENT_DEFAULT,
    messages:        [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const draft = JSON.parse(response.choices[0].message.content);

  return { userId, week: getWeekString(), draft };
}

module.exports = { generateDraft };
