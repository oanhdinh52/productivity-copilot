'use strict';

const { sanitiseInput } = require('../utils');

// Per-member format — each member is a labelled block with all three fields.
// Gives the team lead AI full individual visibility: who said what.
function prepareTeamLeadData(submissions, displayNameById) {
  return submissions.map(s => [
    `Member (userId: ${s.userId}, displayName: ${displayNameById[s.userId] || s.userId}):`,
    `  Progress:       ${sanitiseInput(s.progress)}`,
    `  Blockers:       ${sanitiseInput(s.blocker)}`,
    `  Support needed: ${sanitiseInput(s.support)}`,
  ].join('\n')).join('\n\n');
}

module.exports = { prepareTeamLeadData };