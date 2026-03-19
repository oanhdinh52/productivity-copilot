'use strict';

// Structured JSON logger — fields: timestamp, level, event, user_id, action, outcome
// Never pass message content, tokens, or PII as field values.

function log(level, event, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  (level === 'error' ? console.error : console.log)(JSON.stringify(entry));
}

module.exports = {
  info:  (event, fields) => log('info',  event, fields),
  warn:  (event, fields) => log('warn',  event, fields),
  error: (event, fields) => log('error', event, fields),
};
