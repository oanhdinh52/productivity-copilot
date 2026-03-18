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