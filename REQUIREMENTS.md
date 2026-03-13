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

### Mon – Thu: Passive Collection
- Bot is invited to one or more Slack channels
- It silently reads and stores all messages per user (by Slack user ID)
- It does NOT respond, react, or interrupt any conversations
- Messages are saved locally: data/messages/[userID].json

### Any Time: On-Demand Flagging
- Any user can mention @copilot in any message or thread
- Bot reacts with ✅ only — no text response, no channel noise
- That message is stored with tagged: true — given higher weight in the AI draft generation

### Friday 4PM: Draft Generation
- Bot reads data/messages/[userID].json for each active user
- Calls Azure OpenAI with a structured prompt:
  · Identify progress signals → maps to Q1
  · Identify blocker signals (stuck, waiting, blocked, pending) → maps to Q2
  · Identify support/resource requests → maps to Q3
  · @copilot tagged messages treated as high-priority signals
- Returns structured JSON draft per user: { q1, q2, q3, blockers[] }

### Friday 4:05PM: Draft DM to Each User
- Bot DMs each active user their personalised draft via Slack Block Kit
- Draft shows 3 clearly labelled sections (Q1, Q2, Q3)
- Each section has an Edit button
- Bottom of message has Submit and Regenerate buttons
- Bot never submits on behalf of the user

### User Action: Review and Submit
- User reads the draft in their DM
- Optionally edits any answer by clicking Edit and typing a correction
- Clicks Submit to finalise — saved to data/submissions/[userID]-[date].json

## Tech Stack
- Runtime: Node.js
- AI: Azure OpenAI GPT-4 (credentials in .env.local)
- Bot Framework: @slack/bolt (Slack Events API + Block Kit)
- Scheduler: node-cron (Friday 4PM trigger)
- Storage: JSON files locally (POC only)
- Deployment: Local for POC

## Project Structure
src/
collector/   → passive message collection + @copilot mention handler
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
- Friday 4PM: Azure OpenAI drafts report for each active user
- Bot DMs draft to each user with Edit + Submit buttons (Block Kit)

## Out of Scope for POC
- Multi-channel management dashboard
- Database persistence (JSON files only)
- Cloud deployment (local only)
- Dashboard and analytics