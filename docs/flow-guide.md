# Productivity Copilot — Flow Guide

A reference for how the system is structured, who owns each piece, and when every step happens.

---

## Core Concept

The bot is a passive observer. Instead of asking employees what happened at the end of the week,
it watches Slack all week and already knows — then drafts the survey for them.
Employees just review, edit if needed, and approve.

---

## System Architecture

```
MON–THU (passive, continuous)
┌──────────────────────────────────────────────────────────────────────┐
│  src/collector/                                                      │
│  - Listens to all channels the bot is invited to                     │
│  - Stores each user's messages to data/messages/<userId>.json        │
│  - @copilot mention → reacts ✅, flags message as high priority      │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ data/messages/<userId>.json
                                   ▼
FRIDAY 4:00 PM (node-cron trigger)
┌──────────────────────────────────────────────────────────────────────┐
│  src/nlp/                                                            │
│  - Reads each user's collected messages                              │
│  - Sends to Azure OpenAI GPT-4                                       │
│  - Receives pre-filled draft: Q1 progress, Q2 blockers, Q3 support   │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ { q1, q2, q3 } draft per user
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  src/survey/                                                         │
│  - DMs each user their personalised draft via Block Kit              │
│  - Presents Edit + Submit buttons (bot never auto-submits)           │
│  - Saves approved submission to data/submissions/<userId>.json       │
└──────────────────────────────────────────────────────────────────────┘
                                   │
FRIDAY 5:00 PM (reminder check)    │
┌──────────┐                       │
│ Reminder │ ← no submission yet   │
│    DM    │                       │
└──────────┘                       │
                                   │ data/submissions/*.json
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  src/report/                                                         │
│  - Reads all approved submissions                                    │
│  - Azure OpenAI generates Manager Digest                             │
│  - Azure OpenAI generates CEO Brief                                  │
│  - Posts both to designated Slack channels                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Module Ownership

| Module | Path | Responsibility |
|--------|------|----------------|
| Entry point | `src/index.js` | Bootstraps app, registers cron jobs, starts Slack Bolt |
| Collector | `src/collector/` | Passive message listener + @copilot mention handler |
| NLP | `src/nlp/` | Azure OpenAI analysis → draft Q1/Q2/Q3 per user |
| Survey | `src/survey/` | DM delivery of draft, Block Kit edit/submit flow |
| Report | `src/report/` | Manager Digest + CEO Brief generation and posting |
| Data | `data/messages/` | Collected weekly Slack messages per user (JSON) |
| Data | `data/submissions/` | Approved survey submissions per user (JSON) |
| Docs | `docs/` | All documentation including this file |

---

## Data Flow — Step by Step

### Step 1 — Passive Collection (`src/collector/`) — Mon–Thu, continuous

- **Trigger:** Every message posted in a channel the bot is invited to
- **Process:** Append message to that user's weekly log; if `@copilot` mentioned, flag as high priority
- **Side effect:** React with ✅ on flagged messages only — no other noise
- **Output:** `data/messages/<userId>.json`

```js
// data/messages/U063BKXMR3L.json
{
  userId: "U063BKXMR3L",
  week: "2026-W11",
  messages: [
    { ts: "1741234567.000100", channel: "C01ABC", text: "Shipped the auth module", priority: false },
    { ts: "1741298765.000200", channel: "C01ABC", text: "Blocked on design sign-off @copilot", priority: true }
  ]
}
```

### Step 2 — Draft Generation (`src/nlp/`) — Friday 4:00 PM

- **Trigger:** node-cron at 16:00 every Friday
- **Input:** `data/messages/<userId>.json` for each user
- **Process:** Azure OpenAI GPT-4 analyses the week's messages and fills in all 3 survey questions
- **Output:** Draft object per user

```js
// Draft shape out of nlp/
{
  userId: "U063BKXMR3L",
  week: "2026-W11",
  draft: {
    q1: "Shipped the auth module and started on the notifications feature.",
    q2: "Waiting on design sign-off for the onboarding screen — flagged as a blocker.",
    q3: "Need a decision from product by Wednesday to stay on track."
  }
}
```

### Step 3 — Draft Delivery & Submission (`src/survey/`) — Friday 4:00 PM

- **Trigger:** Immediately after Step 2 completes
- **Input:** Draft object per user
- **Process:** Bot DMs each user a Block Kit message showing the pre-filled draft with Edit + Submit buttons
- **Rule:** Bot never auto-submits — user must explicitly click Submit
- **Output:** `data/submissions/<userId>.json` on approval

```js
// data/submissions/U063BKXMR3L.json
{
  userId: "U063BKXMR3L",
  week: "2026-W11",
  submittedAt: "2026-03-13T09:14:00Z",
  q1: "Shipped the auth module and started on the notifications feature.",
  q2: "Waiting on design sign-off for the onboarding screen.",
  q3: "Need a decision from product by Wednesday."
}
```

### Step 4 — Reminder (`src/survey/`) — Friday 5:00 PM

- **Trigger:** node-cron at 17:00 every Friday
- **Process:** Check `data/submissions/` — if a user has no submission, send one DM reminder
- **Rule:** One reminder only, no further nudges

### Step 5 — Report Generation (`src/report/`) — after submissions close

- **Input:** All `data/submissions/*.json`
- **Process:** Azure OpenAI generates two reports
- **Output:** Posted directly to Slack channels

| Report | Audience | Slack Channel |
|--------|----------|---------------|
| Manager Digest | Team leads | `#manager-digest` |
| CEO Brief | Leadership | `#leadership` |

---

## Timing — When Each Step Happens

```
MON–THU
  All day   Collector listens passively to all invited channels
            @copilot mention → ✅ react + flag message

FRIDAY
  04:00 PM  node-cron fires
              └─ Step 2: Azure OpenAI drafts Q1/Q2/Q3 per user   (~seconds)
              └─ Step 3: Bot DMs each user their draft via Block Kit

  04:00–05:00 PM  Submission window — users review, edit, and submit

  05:00 PM  node-cron fires
              └─ Step 4: Reminder DM sent to anyone who hasn't submitted

  05:00 PM+  Step 5: Reports generated and posted to Slack channels
```

---

## POC Scope

| Item | Detail |
|------|--------|
| Users | Single user — Oanh Dinh (`U063BKXMR3L`) |
| Storage | JSON files only — no database |
| Deployment | Local machine only |
| Slack connection | Real bot token via Socket Mode |
| AI | Azure OpenAI GPT-4 (endpoint + key in `.env.local`) |

**Out of scope for POC:** multi-user rollout, cloud deployment, dashboard/analytics

---

## Key Decisions & Constraints

| Topic | Decision |
|-------|----------|
| Collection | Passive only — bot reads channel messages, no polling or scraping |
| Submission | User-controlled — bot never auto-submits on behalf of anyone |
| Noise | Bot only reacts with ✅ in channels — zero text noise |
| Storage | JSON files for POC; swap to a database for production |
| AI provider | Azure OpenAI GPT-4 — credentials in `.env.local` |
| Scheduler | node-cron for Friday 4PM draft trigger and 5PM reminder |
| Privacy | Bot reads all channel messages it is invited to — confirm scope with CEO |
