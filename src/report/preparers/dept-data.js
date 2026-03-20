'use strict';

const { sanitiseInput } = require('../utils');

// Signal-grouped format — submissions are aggregated by type (delivery / blockers /
// support) rather than listed per member. Individual task details are stripped;
// the AI receives cross-member signal clusters and must identify systemic themes.
function prepareDeptData(submissions, displayNameById) {
  const hasBlocker  = s => s.blocker  && !/^no\b/i.test(s.blocker.trim())  && s.blocker.trim().length > 0;
  const hasProgress = s => s.progress && s.progress.trim().length > 0;
  const hasSupport  = s => s.support  && s.support.trim().length > 0;

  const delivery = submissions.filter(hasProgress);
  const blockers = submissions.filter(hasBlocker);
  const support  = submissions.filter(hasSupport);

  const mention = s => `<@${s.userId}> (${displayNameById[s.userId] || s.userId})`;

  const lines = [
    `Department signals — ${submissions.length} submission(s) this week.`,
    '',
    `--- Delivery signals (${delivery.length} of ${submissions.length} reporting progress) ---`,
    delivery.length > 0
      ? delivery.map(s => `${mention(s)}: ${sanitiseInput(s.progress)}`).join('\n')
      : 'No progress reported.',
    '',
    `--- Blocker signals (${blockers.length} of ${submissions.length} blocked) ---`,
    blockers.length > 0
      ? blockers.map(s => `${mention(s)}: ${sanitiseInput(s.blocker)}`).join('\n')
      : 'No blockers reported.',
    '',
    `--- Support signals (${support.length} of ${submissions.length} requesting support) ---`,
    support.length > 0
      ? support.map(s => `${mention(s)}: ${sanitiseInput(s.support)}`).join('\n')
      : 'No support needs reported.',
  ];

  return lines.join('\n');
}

module.exports = { prepareDeptData };