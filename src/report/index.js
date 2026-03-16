'use strict';

const { AzureOpenAI } = require('openai');
const fs              = require('fs');
const path            = require('path');
const { getWeekString } = require('../collector');

const SUBMISSIONS_DIR = path.join(__dirname, '../../data/submissions');

function buildClient() {
  return new AzureOpenAI({
    endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
    apiKey:     process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT_DEFAULT,
  });
}

function loadAllSubmissions() {
  if (!fs.existsSync(SUBMISSIONS_DIR)) return [];
  const week = getWeekString();
  return fs.readdirSync(SUBMISSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .flatMap(f => JSON.parse(fs.readFileSync(path.join(SUBMISSIONS_DIR, f), 'utf8')))
    .filter(s => s.week === week);
}

function buildSurveyText(submissions) {
  return submissions.map((s, i) => [
    `Employee ${i + 1}:`,
    `  Progress:       ${s.progress}`,
    `  Blockers:       ${s.blocker}`,
    `  Support needed: ${s.support}`,
  ].join('\n')).join('\n\n');
}

async function generateAndPostReports(app) {
  const submissions = loadAllSubmissions();

  if (!submissions.length) {
    console.log('[report] No submissions this week — skipping report generation');
    return;
  }

  const client     = buildClient();
  const surveyText = buildSurveyText(submissions);
  const week       = getWeekString();

  // ── Manager Digest ────────────────────────────────────────────────────────
  const managerRes = await client.chat.completions.create({
    model:    process.env.AZURE_OPENAI_DEPLOYMENT_DEFAULT,
    messages: [{
      role:    'user',
      content: `You are writing a Manager Digest for team leads.
Based on the weekly survey submissions below, produce a structured summary covering:
- Overall team progress
- Key blockers and who is affected
- Support requests that need action

Keep it under 300 words. Use bullet points where helpful.

${surveyText}`,
    }],
  });

  const managerDigest = managerRes.choices[0].message.content;

  // ── CEO Brief ─────────────────────────────────────────────────────────────
  const ceoRes = await client.chat.completions.create({
    model:    process.env.AZURE_OPENAI_DEPLOYMENT_DEFAULT,
    messages: [{
      role:    'user',
      content: `You are writing a CEO Brief for leadership.
Based on the weekly survey submissions below, produce a concise executive summary covering:
- High-level team health
- Critical blockers requiring leadership attention
- Overall momentum and confidence

Keep it under 150 words. Executive tone.

${surveyText}`,
    }],
  });

  const ceoBrief = ceoRes.choices[0].message.content;

  // ── Print to terminal (POC) ───────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log(`MANAGER DIGEST — ${week}`);
  console.log('─'.repeat(60));
  console.log(managerDigest);

  console.log('\n' + '─'.repeat(60));
  console.log(`CEO BRIEF — ${week}`);
  console.log('─'.repeat(60));
  console.log(ceoBrief);
  console.log('─'.repeat(60) + '\n');
}

module.exports = { generateAndPostReports };
