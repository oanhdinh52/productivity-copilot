# Team Lead Report

## Schedule

- Triggered via REPORT_DAY and REPORT_HOUR in .env.local
- Reads submissions from data/submissions/ for current week
- Filters only TEAM_MEMBER_IDS submissions
- Delivered as Slack DM to TEAM_LEAD_ID

## Report Philosophy

A great weekly team report should feel like a trusted advisor
briefing — not a data dump. It answers five questions instantly:

1. Is the team healthy? — one honest sentence up front
2. Who needs me right now? — critical blockers only
3. Who hasn't reported in? — accountability at a glance
4. What did we ship? — celebrate momentum
5. Are we trending up or down? — week over week signal

Report must be:
- Professional — reads like a trusted advisor briefing
- Scannable in under 2 minutes for a team of 10 or more
- Outcome-oriented — every blocker has a suggested action
- Concise — no repeated information, no long paragraphs
- Meaningful — lead reads it and knows exactly what to do
- Designed to be sent weekly — builds a running picture over time
- No emoji anywhere in the report content
- Scales well — structure works for 2 members or 20 members

---

## Report Structure

Definitions:
- members: total count of user IDs in TEAM_MEMBER_IDS
- submitted: count of unique user IDs who are both in
  TEAM_MEMBER_IDS and have at least one submission entry
  matching the current week string (e.g. 2026-W12)
- not submitted: count of unique user IDs in TEAM_MEMBER_IDS
  who have no submission entry matching the current week string
- Week date range: the current week formatted as
  "MMM DD, YYYY to MMM DD, YYYY"
  e.g. "Mar 16, 2026 to Mar 20, 2026"
- userName resolution: always resolve display names before
  generating the report by calling the Slack API users.info
  for each userID in TEAM_MEMBER_IDS.
  Store as a map { userId: displayName } and use Slack mention
  format <@userId> everywhere in the report so names render
  as clickable @mentions in Slack.
- Prior week data: read data/submissions/ for entries matching
  the previous week string (e.g. 2026-W11) to enable
  week-over-week comparison. If no prior data: skip comparison.
- Azure OpenAI prompt structure for report generation:
    System prompt (strict output rules — always followed):
    "You are a JSON generator. You must return ONLY a
    valid raw JSON object. Rules that cannot be broken:
    1. No markdown, no code fences, no backticks
    2. No literal newline characters inside string values — use \n instead
    3. All JSON properties separated by commas
    4. No trailing commas
    5. No explanation, no preamble, no postamble
       Violation of any rule produces unusable output."

User prompt (report content instructions):
All report content, field definitions, submissions
data, and tone guidance go here — separate from
the output format rules above.

### 1. Header
"Team Pulse — Week [X] · MMM DD, YYYY to MMM DD, YYYY"
"[N] members · [N] submitted · [N] not submitted"

### 2. Not Submitted (conditional)
- Only shown if not submitted > 0
- Format: "Not submitted: @name1, @name2"
- Placed directly below the header
- If all members submitted: omit entirely

### 3. This Week
Three parts written as one cohesive narrative by Azure OpenAI.
AI writing guidance: see AI-SKILL.md

Opening:
 - State the single most important thing about this week
 - Name the specific team, person, or system involved
 - A reader who knows this team should recognise it instantly
 - Generic observations that apply to any team are not acceptable

Highlights:
 - Select only wins that moved the team forward
 - Write outcomes — the impact, not the activity
 - AI decides what qualifies — not everything does

Trend:
 - Draw a conclusion from comparing this week to prior week
 - State what it means for the lead's focus next week

### 4. Needs Your Attention
- Written as 1 to 3 short paragraphs by Azure OpenAI
- Each paragraph covers one person or one root cause
- Group multiple blockers from the same person or
  same root cause into one paragraph — never list separately
- Each paragraph ends with one specific high-leverage
  action the lead can take — the single most impactful
  thing to resolve the situation
- Written conversationally — direct address to the lead
- Use @mention for member names
- If none: show "No blockers requiring your attention this week."

### 5. Monitor
- One paragraph covering all medium blockers together
- Conversational — not a bullet list
- Tells the lead what to watch, not what to do urgently
- Use @mention for member names
- If none: omit entirely
