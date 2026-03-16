'use strict';

const fs   = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '../../data/messages');

// ── Utility ──────────────────────────────────────────────────────────────────

function getWeekString() {
  const now  = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day  = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week      = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getNextWeekString() {
  const now  = new Date();
  const next = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 7));
  const day  = next.getUTCDay() || 7;
  next.setUTCDate(next.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(next.getUTCFullYear(), 0, 1));
  const week      = Math.ceil((((next - yearStart) / 86400000) + 1) / 7);
  return `${next.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function loadMessages(userId) {
  const file = path.join(MESSAGES_DIR, `${userId}.json`);
  if (!fs.existsSync(file)) return { userId, week: getWeekString(), messages: [] };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveMessages(userId, data) {
  fs.mkdirSync(MESSAGES_DIR, { recursive: true });
  fs.writeFileSync(path.join(MESSAGES_DIR, `${userId}.json`), JSON.stringify(data, null, 2));
}

function getAllMessageUserIds() {
  if (!fs.existsSync(MESSAGES_DIR)) return [];
  return fs.readdirSync(MESSAGES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

// ── Bolt registration ─────────────────────────────────────────────────────────

function registerCollector(app, botUserId) {
  app.message(async ({ message, client }) => {
    // Ignore bot messages and non-user events
    if (!message.user || message.bot_id || message.subtype) return;

    const userId  = message.user;
    const text    = message.text || '';
    const priority = botUserId ? text.includes(`<@${botUserId}>`) : false;

    const now            = new Date();
    const isFridayCutoff = now.getDay() === 5 && now.getHours() >= 12;
    const targetWeek     = isFridayCutoff ? getNextWeekString() : getWeekString();

    if (isFridayCutoff) {
      console.log(`[collector] Friday cutoff reached — message from ${userId} stored in next week ${targetWeek}`);
    }

    const data = loadMessages(userId);

    // Reset when the stored week doesn't match the target week
    if (data.week !== targetWeek) {
      data.week     = targetWeek;
      data.messages = [];
    }

    data.messages.push({
      ts:       message.ts,
      channel:  message.channel,
      text,
      priority,
    });

    saveMessages(userId, data);

    // ✅ react only on @copilot mentions — no other channel noise
    if (priority) {
      try {
        await client.reactions.add({
          channel:   message.channel,
          timestamp: message.ts,
          name:      'white_check_mark',
        });
      } catch (err) {
        // Reaction may already exist — safe to ignore
        if (err.data?.error !== 'already_reacted') {
          console.error('[collector] reaction error:', err.message);
        }
      }
    }
  });

  console.log('[collector] Passive message collector registered');
}

module.exports = { registerCollector, getWeekString, loadMessages, getAllMessageUserIds };
