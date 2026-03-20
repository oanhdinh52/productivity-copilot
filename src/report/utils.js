'use strict';

const fs   = require('fs');
const path = require('path');

// Strip control chars and truncate to guard against prompt injection
function sanitiseInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, 2000);
}

function sanitiseJson(str) {
  return str.replace(/("(?:[^"\\]|\\.)*")/gs, match =>
    match.replace(/\n/g, '\\n')
         .replace(/\r/g, '\\r')
         .replace(/\t/g, '\\t')
  );
}

function parseAiJson(content) {
  const cleaned = sanitiseJson(
    content
      .replace(/^```json|^```|```$/gm, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim()
  );
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`AI response is not valid JSON: ${err.message}\n---\n${cleaned.slice(0, 300)}`);
  }
}

function buildSystemPrompt(skillFile) {
  const skill = fs.readFileSync(skillFile, 'utf8');
  return `You are a JSON generator. You must return ONLY a valid raw JSON object. Rules that cannot be broken:
1. No markdown, no code fences, no backticks
2. No literal newline characters inside string values — use \\n instead
3. All JSON properties separated by commas
4. No trailing commas
5. No explanation, no preamble, no postamble
Violation of any rule produces unusable output.

---

${skill}`;
}

const plural = (n, word) => `${n} ${n === 1 ? word : word + 's'}`;

module.exports = { sanitiseInput, sanitiseJson, parseAiJson, buildSystemPrompt, plural };
