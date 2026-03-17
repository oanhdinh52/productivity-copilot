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
MON–FRI until 12PM (passive, continuous)
┌──────────────────────────────────────────────────────────────────────┐
│  src/collector/                                                      │
│  - Listens to all channels the bot is invited to                     │
│  - Stores each user's messages to data/messages/<userId>.json        │
│  - @prody mention → reacts ✅, flags message as priority: true       │
│  - Stops collecting for current week at Friday 12PM                  │
│  - Messages after Friday 12PM stored in following week's file        │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ data/messages/<userId>.json
                                   ▼
FRIDAY 12:00 PM (node-cron trigger)
┌──────────────────────────────────────────────────────────────────────┐
│  src/nlp/                                                            │
│  - Reads each user's collected messages                              │
│  - Sends to Azure OpenAI GPT-4                                       │
│  - Receives pre-filled draft: progress, blocker, support             │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ { progress, blocker, support } draft per user
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  src/survey/                                                         │
│  - DMs each user their personalised draft via Block Kit              │
│  - Presents Edit & Submit (modal) + Submit As-Is buttons             │
│  - Bot never auto-submits — user must explicitly click Submit        │
│  - Saves approved submission to data/submissions/<userId>-<date>.json│
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ data/submissions/*.json
                                   ▼
FRIDAY 5:00 PM (node-cron trigger)
┌──────────────────────────────────────────────────────────────────────┐
│  src/report/                                                         │
│  - Reads all approved submissions for the current week               │
│  - Azure OpenAI generates Manager Digest                             │
│  - Azure OpenAI generates CEO Brief                                  │
│  - Prints both reports to terminal (POC)                             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Module Ownership

| Module | Path | Responsibility |
|--------|------|----------------|
| Entry point | `src/index.js` | Bootstraps app, registers cron jobs, starts Slack Bolt |
| Collector | `src/collector/` | Passive message listener + @prody mention handler + Friday 12PM cutoff |
| NLP | `src/nlp/` | Azure OpenAI analysis → draft progress/blocker/support per user |
| Survey | `src/survey/` | DM delivery of draft, Block Kit edit/submit flow |
| Report | `src/report/` | Manager Digest + CEO Brief generation |
| Data | `data/messages/` | Collected weekly Slack messages per user (JSON) |
| Data | `data/submissions/` | Approved survey submissions per user (JSON) |
| Docs | `docs/` | All documentation including this file |

---

## Data Flow — Step by Step

### Step 1 — Passive Collection (`src/collector/`) — Mon–Fri until 12PM, continuous

- **Trigger:** Every message posted in a channel the bot is invited to
- **Process:** Append message to that user's weekly log; if `@prody` mentioned, flag as `priority: true`
- **Cutoff:** On Friday at 12PM the cron fires — messages arriving after 12PM are stored under the following week's key
- **Side effect:** React with ✅ on flagged messages only — no other noise
- **Output:** `data/messages/<userId>.json`

```js
// data/messages/U063BKXMR3L.json
{
  userId: "U063BKXMR3L",
  week: "2026-W11",
  messages: [
    { ts: "1741234567.000100", channel: "C01ABC", text: "Shipped the auth module", priority: false },
    { ts: "1741298765.000200", channel: "C01ABC", text: "Blocked on design sign-off @prody", priority: true }
  ]
}
```

### Step 2 — Draft Generation (`src/nlp/`) — Friday 12:00 PM

- **Trigger:** node-cron at 12:00 every Friday
- **Input:** `data/messages/<userId>.json` for each active user
- **Process:** Azure OpenAI GPT-4 analyses the week's messages and fills in all 3 survey questions
- **Output:** Draft object per user

```js
// Draft shape out of nlp/
{
  userId: "U063BKXMR3L",
  week: "2026-W11",
  draft: {
    progress: "Shipped the auth module and started on the notifications feature.",
    blocker:  "Waiting on design sign-off for the onboarding screen — flagged as a blocker.",
    support:  "Need a decision from product by Wednesday to stay on track."
  }
}
```

### Step 3 — Draft Delivery & Submission (`src/survey/`) — Friday 12:00 PM

- **Trigger:** Immediately after Step 2 completes
- **Input:** Draft object per user
- **Process:** Bot DMs each user a Block Kit message titled "Productivity Copilot Weekly Draft" showing the pre-filled draft with Edit & Submit and Submit As-Is buttons
- **Sections:** 1. Progress this week / 2. Blockers this week / 3. Support needed
- **Rule:** Bot never auto-submits — user must explicitly click Submit
- **Confirmation:** "Your Productivity Copilot weekly has been submitted. See you next Friday 😊"
- **Output:** `data/submissions/<userId>-<date>.json` on approval

```js
// data/submissions/U063BKXMR3L-2026-03-13.json
[
  {
    userId: "U063BKXMR3L",
    week: "2026-W11",
    submittedAt: "2026-03-13T09:14:00Z",
    progress: "Shipped the auth module and started on the notifications feature.",
    blocker:  "Waiting on design sign-off for the onboarding screen.",
    support:  "Need a decision from product by Wednesday."
  }
]
```

### Step 4 — Report Generation (`src/report/`)

- **Trigger:** Triggered manually or after submissions are collected. Prints to terminal (POC only).
- **Input:** All `data/submissions/*.json` for the current week
- **Process:** Azure OpenAI generates two reports
- **Output:** Printed to terminal (POC)

| Report | Audience |
|--------|----------|
| Manager Digest | Team leads |
| CEO Brief | Leadership |

---

## Timing — When Each Step Happens

```
MON–FRI
  All day   Collector listens passively to all invited channels
            @prody mention → ✅ react + flag message as priority

FRIDAY
  12:00 PM  node-cron fires
              └─ Step 2: Azure OpenAI drafts progress/blocker/support per user   (~seconds)
              └─ Step 3: Bot DMs each user their draft via Block Kit
                         Collector routes any new messages to next week's file

  12:00 PM+  Submission window — users review, edit, and submit

  After submissions close
              └─ Step 4: Reports generated manually and printed to terminal
```

---

## POC Scope

| Item | Detail |
|------|--------|
| Users | Any user who messages in a channel the bot is invited to — resolved dynamically |
| Storage | JSON files only — no database |
| Deployment | Local machine only |
| Slack connection | Real bot token via Socket Mode |
| AI | Azure OpenAI GPT-4 (endpoint + key in `.env.local`) |

**Out of scope for POC:** cloud deployment, dashboard/analytics, posting reports to Slack channels

---

## Key Decisions & Constraints

| Topic | Decision |
|-------|----------|
| Collection | Passive only — bot reads channel messages, no polling or scraping |
| Cutoff | Friday 12PM — messages after that stored in following week's file |
| Submission | User-controlled — bot never auto-submits on behalf of anyone |
| Noise | Bot only reacts with ✅ in channels — zero text noise |
| Storage | JSON files for POC; swap to a database for production |
| AI provider | Azure OpenAI GPT-4 — credentials in `.env.local` |
| Scheduler | node-cron for Friday 12PM draft trigger |
| Privacy | Bot reads all channel messages it is invited to — confirm scope with CEO |
