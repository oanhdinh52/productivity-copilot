'use strict';

const { AzureOpenAI } = require('openai');
const fs              = require('fs');
const path            = require('path');
const { getWeekString } = require('../collector');
const log = require('../logger');
const { parseAiJson, buildSystemPrompt, plural } = require('./utils');
const { prepareDeptData } = require('./preparers/dept-data');

const SKILL_FILE = path.join(__dirname, '../../reports/dept-report.md');

const SUBMISSIONS_DIR = path.join(__dirname, '../../data/submissions');

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];


function buildClient() {
  return new AzureOpenAI({
    endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
    apiKey:     process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT_DEFAULT,
  });
}

function getWeekDateRange(weekStr) {
  const [yearStr, weekPart] = weekStr.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekPart, 10);
  const jan4      = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday    = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  const fmt = d => `${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  return { weekNum: week, monStr: fmt(monday), friStr: fmt(friday) };
}

function getPriorWeekString() {
  const now     = new Date();
  const date    = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 7));
  const day     = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week      = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function loadSubmissionsForWeek(memberIds, weekStr) {
  if (!fs.existsSync(SUBMISSIONS_DIR)) return [];
  const results = [];
  for (const userId of memberIds) {
    const files = fs.readdirSync(SUBMISSIONS_DIR)
      .filter(f => f.startsWith(`${userId}-`) && f.endsWith('.json'));
    for (const f of files) {
      const parsed  = JSON.parse(fs.readFileSync(path.join(SUBMISSIONS_DIR, f), 'utf8'));
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of entries) {
        if (entry.week === weekStr) results.push(entry);
      }
    }
  }
  return results;
}

async function resolveDisplayNames(app, memberIds) {
  const map = {};
  await Promise.all(memberIds.map(async id => {
    try {
      const res = await app.client.users.info({ user: id });
      const u   = res.user;
      map[id]   = u.profile?.display_name || u.real_name || u.name || id;
    } catch {
      map[id] = id;
    }
  }));
  return map;
}


async function generateAndSendDeptReport(app) {
  const deptManagerId = process.env.DEPT_MANAGER_ID;
  const memberIds     = (process.env.DEPT_MEMBER_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  if (!deptManagerId) {
    log.warn('dept_report.skipped', { action: 'generate_dept_report', outcome: 'no_dept_manager_id' });
    return;
  }

  const week      = getWeekString();
  const priorWeek = getPriorWeekString();

  const submissions      = loadSubmissionsForWeek(memberIds, week);
  const priorSubmissions = loadSubmissionsForWeek(memberIds, priorWeek);

  if (!submissions.length) {
    log.info('dept_report.skipped', { action: 'generate_dept_report', outcome: 'no_submissions' });
    return;
  }

  const submittedIds    = new Set(submissions.map(s => s.userId));
  const notSubmittedIds = memberIds.filter(id => !submittedIds.has(id));
  const displayNameById = await resolveDisplayNames(app, memberIds);

  const client                      = buildClient();
  const surveyText                  = prepareDeptData(submissions, displayNameById);
  const { weekNum, monStr, friStr } = getWeekDateRange(week);

  const hasPriorData = priorSubmissions.length > 0;
  const priorContext = hasPriorData
    ? (() => {
        const priorBlockerCount = priorSubmissions.filter(s =>
          s.blocker && !/^no\b/i.test(s.blocker.trim())
        ).length;
        const priorWinsCount = priorSubmissions.filter(s =>
          s.progress && s.progress.trim().length > 0
        ).length;
        return `Prior week (${priorWeek}):
- Submission rate: ${priorSubmissions.length} of ${plural(memberIds.length, 'member')}
- Members with progress/wins: ${priorWinsCount}
- Members with blockers: ${priorBlockerCount}
- Blocker detail: ${priorSubmissions.map(s => `${displayNameById[s.userId] || s.userId}: ${s.blocker}`).join(' | ')}`;
      })()
    : null;

  const res = await client.chat.completions.create({
    model:    process.env.AZURE_OPENAI_DEPLOYMENT_DEFAULT,
    messages: [
      {
        role:    'system',
        content: buildSystemPrompt(SKILL_FILE),
      },
      {
        role:    'user',
        content: `You are generating a Department Manager Report. Your altitude is strategic — patterns, trajectory, decisions.

AI mindset:
- This is a strategic narrative, not an operational list — every word must earn its place
- The manager thinks in sprints and quarters, manages through team leads, acts on systemic risks
- You are answering one question: "Is this department building momentum or losing it?"
- Systemic themes only — never individual task details
- Connect this week to the bigger picture
- Nothing a team lead can handle belongs here
- Use <@userId> for every person — never plain text names
- No emoji anywhere in the report

This week: ${submittedIds.size} of ${plural(memberIds.length, 'member')} submitted.
${priorContext ? `\n${priorContext}\n` : ''}
Based on the submissions below, return a JSON object with exactly these fields:

- "story": string — one to two paragraphs. The heart of the report. Tell the department head what kind of week it was and what it means for where the department is heading. Never reference specific activities even as context — that is task-level detail belonging in the team lead report. If progress happened, speak about its strategic implication, not the activity itself. Speak about team capability, momentum, and systemic patterns. This report speaks one level above the team lead. Connect this week to the bigger picture. Paragraphs separated by \\n\\n.

- "yourDecision": string or null — one strategic decision or cross-department escalation that requires the manager's authority. Maximum 3 sentences: first the situation, then why it requires the manager specifically, then the action. Omit entirely (set to null) if nothing genuinely qualifies — do not force an escalation.

- "trajectory": string or null — exactly 2 sentences. First sentence: direction (improving, stable, or declining) with real numbers from this week vs prior week — blocker count and delivery momentum only, never submission rate. Second sentence: implication for the manager's focus next week.${hasPriorData ? '' : ' Set to null because no prior week data is available — never fabricate.'}

When referring to a person always use the Slack mention format <@userId> using the userId from the submission data.

This week's submissions:
${surveyText}`,
      },
    ],
  });

  let report;
  try {
    report = parseAiJson(res.choices[0].message.content);
  } catch (err) {
    log.error('dept_report.parse_failed', { action: 'parse_ai_response', outcome: 'error' });
    throw err;
  }

  const blocks = [];

  // 1. Header
  const headerTitle = `Department Pulse — Week ${weekNum} · ${monStr} to ${friStr}`;
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: headerTitle, emoji: false },
  });

  // 2. The Story
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: `*The Story*\n${report.story}` },
  });

  // 3. Your Decision (conditional — omit if null)
  if (report.yourDecision) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Your Decision*\n${report.yourDecision}` },
    });
  }

  // 4. The Trajectory (conditional — omit if null)
  if (report.trajectory) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*The Trajectory*\n${report.trajectory}` },
    });
  }

  await app.client.chat.postMessage({
    channel: deptManagerId,
    text:    headerTitle,
    blocks,
  });

  log.info('dept_report.sent', { action: 'send_dept_report', outcome: 'success' });
}

module.exports = { generateAndSendDeptReport };
