# Productivity Copilot — Requirements

## Project Overview
A Slack-native AI agent that passively observes employee Slack
activity throughout the week and automatically drafts their Friday
survey submission — so employees just review, edit if needed,
and submit instead of writing from scratch.

## Core Concept
Employees already communicate everything through Slack all week
— progress updates, blockers, help requests, coordination.
The bot observes these signals silently, then on Friday drafts
the weekly survey on their behalf. The employee simply reviews
and submits.

## Three Pillars
- 💡 Innovation: Passive NLP message collection — no manual input
  required from employees during the week
- ✨ Creativity: AI-drafted personalised weekly summary — reads
  like it was written by the employee, not a machine
- ⚙️ GitHub: Bootstrapped via Claude Code, runs locally for CEO demos

## The 3 Survey Questions
1. What are the key things you made progress on this week?
2. Anything blocked you this week from achieving your goals?
3. Anything you need to be more productive or support you better?

## How It Works

### Monday to Friday: Passive Collection
- Bot is invited to one or more Slack channels
- It silently reads and stores all messages per user (by Slack user ID)
- It does NOT respond, react, or interrupt any conversations
- Messages are saved locally: data/messages/[userID].json
- Collection stops at Friday 12PM when draft generation triggers
- Messages received after Friday 12PM are stored in the following week's file

### Any Time: On-Demand Flagging
- Any user can mention @prody in any message or thread
- Bot reacts with ✅ only — no text response, no channel noise
- That message is stored with priority: true — given higher weight in the AI draft generation

### Friday 12PM: Draft Generation + DM
- Bot reads data/messages/[userID].json for each active user
- Calls Azure OpenAI with a structured prompt:
  · Identify progress signals → maps to progress
  · Identify blocker signals (stuck, waiting, blocked, pending) → maps to blocker
  · Identify support/resource requests → maps to support
  · @prody mentioned messages treated as high-priority signals
- Returns structured JSON draft per user: { progress, blocker, support }
- Bot immediately DMs each active user their personalised draft via Slack Block Kit
- Draft shows 3 clearly labelled sections (1. Progress, 2. Blockers, 3. Support needed)
- Bottom of message has Edit & Submit button (opens modal) and Submit As-Is button
- Bot never submits on behalf of the user
- DM title: "Productivity Copilot Weekly Draft"

### Scheduler Configuration

All scheduled jobs are configurable via .env.local.
To change: update .env.local values and run npm run prody:restart.
No code changes needed.

| Variable | Description | Current value |
|---|---|---|
| COLLECTION_CUTOFF_DAY | Day collection stops | wednesday |
| COLLECTION_CUTOFF_HOUR | Hour (24h) | 10 |
| COLLECTION_CUTOFF_MINUTE | Minute | 52 |
| DRAFT_DAY | Day draft is generated | wednesday |
| DRAFT_HOUR | Hour (24h) | 11 |
| DRAFT_MINUTE | Minute | 0 |
| REPORT_DAY | Day report runs | wednesday |
| REPORT_HOUR | Hour (24h) | 11 |
| REPORT_MINUTE | Minute | 30 |

> ⚠️ These are current test values.
> For production:
> - Collection cutoff: friday at 12:00
> - Draft generation: friday at 12:00
> - Report generation: tuesday (following week) at 09:00

### User Action: Review and Submit
- User reads the draft in their DM
- Optionally edits any answer by clicking Edit and typing a correction
- Clicks Submit to finalise — saved to data/submissions/[userID]-[date].json
- Bot confirms submission with message: "✅ Your Productivity Copilot weekly has been submitted. See you next Friday 😊"

### Team Configuration
- TEAM_LEAD_ID: Slack ID of the team lead who receives the report
- TEAM_MEMBER_IDS: Comma-separated Slack IDs of team members
  whose submissions are included in the report

### Team Lead Report — Scheduled

- Triggered via REPORT_DAY and REPORT_HOUR in .env.local
- Reads submissions from data/submissions/ for current week
- Filters only TEAM_MEMBER_IDS submissions
- Delivered as Slack DM to TEAM_LEAD_ID

#### Report Philosophy

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

#### Report Structure
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

1. Header
   "Team Pulse — Week [X] · MMM DD, YYYY to MMM DD, YYYY"
   "[N] members · [N] submitted · [N] not submitted"

2. Not Submitted (conditional)
    - Only shown if not submitted > 0
    - Format: "Not submitted: @name1, @name2"
    - Placed directly below the header
    - If all members submitted: omit entirely

3. This Week
   Three parts written as one cohesive narrative by Azure OpenAI.

AI mindset:
- You have read every submission in full
- You have formed a clear opinion — not a summary
- You speak with authority to someone who trusts your judgment
- You surface only what matters — everything else is noise
- You connect patterns the lead might not see themselves
- You use <@userId> format for every person mentioned —
  never plain text names anywhere in the report

   Opening:
    - Combines delivery signal and risk signal
    - Written with the precision of someone who has read
      every submission and formed a clear opinion

   Highlights:
    - Select the wins that actually moved the team forward
    - Write outcomes not activities — the why, not the what
    - AI decides what is meaningful — not everything qualifies
    - Attribution optional — only tag a person when it adds
        meaningful context, not for every win

   Trend:
    - Tells the lead whether the team is improving, stable,
      or declining — and why it matters for next week
    - Omit entirely if no prior week data — never fabricate

4. Needs Your Attention
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

5. Monitor
    - One paragraph covering all medium blockers together
    - Conversational — not a bullet list
    - Tells the lead what to watch, not what to do urgently
    - Use @mention for member names
    - If none: omit entirely

## Tech Stack
- Runtime: Node.js
- AI: Azure OpenAI GPT-4o (credentials in .env.local)
- Bot Framework: @slack/bolt (Slack Events API + Block Kit)
- Scheduler: node-cron (Friday 4PM trigger)
- Storage: JSON files locally (POC only)
- Deployment: Local for POC

## Project Structure
src/
collector/   → passive message collection + @prody mention handler
nlp/         → Azure OpenAI analysis + draft generation per user
survey/      → draft DM delivery + edit/submit flow (Block Kit)
report/      → submission reader + summary output
data/
messages/    → collected weekly messages per user (JSON)
submissions/ → submitted survey responses (JSON)
docs/
scripts/

## POC Scope
- Real Slack bot connection using credentials in .env.local
- Bot dynamically detects any user who messages in channels it is invited to — no hardcoded user IDs
- All users resolved dynamically from Slack events at runtime
- Bot collects messages from any active user in any invited channel
- Bot mention flags a message as high priority for that user
- Friday 12PM: Azure OpenAI drafts report for each active user
- Bot DMs draft to each user with Edit + Submit buttons (Block Kit)

## Out of Scope for POC
- Multi-channel management dashboard
- Database persistence (JSON files only)
- Cloud deployment (local only)
- Dashboard and analytics