'use strict';

const { AzureOpenAI } = require('openai');
const fs              = require('fs');
const path            = require('path');
const { getWeekString } = require('../collector');

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

// "Mar 16, 2026" from "2026-W12"
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

// Resolve display names from Slack API for all member IDs
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

function buildSurveyText(submissions, displayNameById) {
  return submissions.map(s => [
    `Member (userId: ${s.userId}, displayName: ${displayNameById[s.userId] || s.userId}):`,
    `  Progress:       ${s.progress}`,
    `  Blockers:       ${s.blocker}`,
    `  Support needed: ${s.support}`,
  ].join('\n')).join('\n\n');
}

async function generateAndSendLeadReport(app) {
  const teamLeadId = process.env.TEAM_LEAD_ID;
  const memberIds  = (process.env.TEAM_MEMBER_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  if (!teamLeadId) {
    console.log('[report] TEAM_LEAD_ID not set — skipping report');
    return;
  }

  const week      = getWeekString();
  const priorWeek = getPriorWeekString();

  const submissions      = loadSubmissionsForWeek(memberIds, week);
  const priorSubmissions = loadSubmissionsForWeek(memberIds, priorWeek);

  if (!submissions.length) {
    console.log('[report] No team submissions this week — skipping report');
    return;
  }

  const submittedIds    = new Set(submissions.map(s => s.userId));
  const notSubmittedIds = memberIds.filter(id => !submittedIds.has(id));
  const displayNameById = await resolveDisplayNames(app, memberIds);

  const client                      = buildClient();
  const surveyText                  = buildSurveyText(submissions, displayNameById);
  const { weekNum, monStr, friStr } = getWeekDateRange(week);

  // Build prior week context for trend
  const hasPriorData = priorSubmissions.length > 0;
  const priorContext = hasPriorData
    ? `Prior week (${priorWeek}) had ${priorSubmissions.length} submission(s) from ${new Set(priorSubmissions.map(s => s.userId)).size} member(s).
Prior week blocker summary:
${priorSubmissions.map(s => `  ${displayNameById[s.userId] || s.userId}: blockers: ${s.blocker}`).join('\n')}`
    : null;

  const res = await client.chat.completions.create({
    model:    process.env.AZURE_OPENAI_DEPLOYMENT_DEFAULT,
    messages: [
      {
        role:    'system',
        content: `You are a JSON generator. You must return ONLY a valid raw JSON object. Rules that cannot be broken:
1. No markdown, no code fences, no backticks
2. No literal newline characters inside string values — use \\n instead
3. All JSON properties separated by commas
4. No trailing commas
5. No explanation, no preamble, no postamble
Violation of any rule produces unusable output.`,
      },
      {
        role:    'user',
        content: `You are generating a Team Lead Report — a trusted advisor briefing, not a data dump.

AI mindset:
- You have read every submission in full
- You have formed a clear opinion — not a summary
- You speak with authority to someone who trusts your judgment
- You surface only what matters — everything else is noise
- You connect patterns the lead might not see themselves
- You use <@userId> format for every person mentioned — never plain text names anywhere in the report

This week: ${submittedIds.size} of ${memberIds.length} members submitted.
${priorContext ? `\n${priorContext}\n` : ''}
Based on the submissions below, return a JSON object with exactly these fields:

- "opening": one sentence that combines delivery signal and risk signal — written with the precision of someone who has read every submission and formed a clear opinion
- "highlights": array of 3 to 5 sentences — select the wins that actually moved the team forward. Write outcomes not activities — the why, not the what. AI decides what is meaningful — not everything qualifies. Attribution optional — only tag a person when it adds meaningful context, not for every win.
- "trend": one sentence telling the lead whether the team is improving, stable, or declining — and why it matters for next week${hasPriorData ? '' : ' — set to null because no prior week data is available; never fabricate'}
- "needsAttention": string — 1 to 3 short paragraphs, each covering one person or one root cause. Group multiple blockers from the same person or same root cause into one paragraph. Each paragraph ends with the single most impactful action the lead can take. Written conversationally, direct address to the lead (e.g. "You should..."). Use <@userId> for names. Paragraphs separated by \\n\\n. If no high-severity blockers: set to "No blockers requiring your attention this week."
- "monitor": string or null — one conversational paragraph covering all medium blockers together. Tells the lead what to watch, not what to do urgently. Use <@userId> for names. If no medium blockers: set to null.

When referring to a person always use the Slack mention format <@userId> using the userId from the submission data. No emoji anywhere.

This week's submissions:
${surveyText}`,
      },
    ],
  });

  function sanitiseJson(str) {
    return str.replace(/("(?:[^"\\]|\\.)*")/gs, match =>
      match.replace(/\n/g, '\\n')
           .replace(/\r/g, '\\r')
           .replace(/\t/g, '\\t')
    );
  }

  let report;
  try {
    const raw = sanitiseJson(
      res.choices[0].message.content
        .replace(/^```json|^```|```$/gm, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .trim()
    );
    report = JSON.parse(raw);
  } catch (err) {
    console.error('[report] Failed to parse AI response:', err.message);
    console.error('[report] Raw response:', res.choices[0].message.content);
    throw err;
  }

  // ── Block Kit blocks ──────────────────────────────────────────────────────
  const blocks = [];

  // 1. Header
  const headerTitle = `Team Pulse — Week ${weekNum} · ${monStr} to ${friStr}`;
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: headerTitle, emoji: false },
  });
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${memberIds.length} members · ${submittedIds.size} submitted · ${notSubmittedIds.length} not submitted`,
    },
  });

  // 2. Not Submitted (conditional — omit if all submitted)
  if (notSubmittedIds.length > 0) {
    const mentions = notSubmittedIds.map(id => `<@${id}>`).join(', ');
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `Not submitted: ${mentions}` },
    });
  }

  // 3. This Week — opening + highlights + trend
  blocks.push({ type: 'divider' });
  const highlightLines = (report.highlights || []).map(h => `• ${h}`).join('\n');
  const trendLine      = report.trend ? `\n\n${report.trend}` : '';
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*This Week*\n${report.opening}\n\n${highlightLines}${trendLine}`,
    },
  });

  // 4. Needs Your Attention
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Needs Your Attention*\n${report.needsAttention || 'No blockers requiring your attention this week.'}`,
    },
  });

  // 5. Monitor (omit if none)
  if (report.monitor) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Monitor*\n${report.monitor}` },
    });
  }

  await app.client.chat.postMessage({
    channel: teamLeadId,
    text:    headerTitle,
    blocks,
  });

  console.log(`[report] Team lead report sent to ${teamLeadId}`);
}

module.exports = { generateAndSendLeadReport };
