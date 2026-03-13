# Productivity Copilot — Flow Guide

A reference for how the system is structured, who owns each piece, and when every step happens.

---

## Overview

The Productivity Copilot turns a weekly Friday employee survey into actionable intelligence:
- Detected blockers are auto-routed to the right owner
- Narrative team summaries are generated and delivered via Slack
- Executives receive a high-level brief by email

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRIGGER: Every Friday                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
                   ┌──────────────────┐
                   │  src/survey/     │  Survey Ingestion & Parsing
                   │  (ingestion)     │  Reads raw responses → structured data
                   └────────┬─────────┘
                            │  { employeeId, progress, blockers, supportNeeded }
                            ▼
                   ┌──────────────────┐
                   │  src/nlp/        │  Blocker Detection & Classification
                   │  (analysis)      │  Labels type, severity, owner
                   └────────┬─────────┘
                            │  { blocker, type, severity, routeTo }
                            ▼
                   ┌──────────────────┐
                   │  src/summary/    │  Narrative Generation via Claude API
                   │  (generation)    │  Produces team + executive summaries
                   └────────┬─────────┘
                            │
               ┌────────────┼────────────┐
               ▼            ▼            ▼
          [Slack]        [Email]    [Escalation]
        Team digest   Exec brief   Manager alert
```

---

## Module Ownership

| Module | Path | Responsibility | Phase |
|--------|------|----------------|-------|
| Entry point | `src/index.js` | Bootstraps the app, orchestrates the pipeline | All |
| Survey | `src/survey/` | Ingests and parses raw survey responses | 2 |
| NLP | `src/nlp/` | Detects blockers, classifies them, assigns routing | 2 |
| Summary | `src/summary/` | Generates narrative output via Claude API | 2 |
| Scripts | `scripts/` | Automation utilities (e.g. trigger, test data seeder) | 2–3 |
| Data | `data/` | Sample/fixture survey response files | 2 |
| Docs | `docs/` | All documentation including this file | All |

---

## Data Flow — Step by Step

### Step 1 — Survey Ingestion (`src/survey/`)

- **Input:** Raw survey responses (file, API, or manual input)
- **Process:** Parse and normalize each employee's 3 answers
- **Output:** Structured array of response objects

```js
// Expected shape out of survey/
{
  employeeId: "eng-042",
  week: "2026-W11",
  progress: "Finished auth module, started on notifications",
  blockers: "Waiting on design sign-off for the new onboarding screen",
  supportNeeded: "Need a decision from product by Wednesday"
}
```

### Step 2 — NLP Analysis (`src/nlp/`)

- **Input:** Structured survey data from Step 1
- **Process:** Claude API classifies each blocker by type and severity, and determines who should receive it
- **Output:** Enriched blocker objects ready for routing and summary

```js
// Expected shape out of nlp/
{
  employeeId: "eng-042",
  blocker: "Waiting on design sign-off for the new onboarding screen",
  type: "dependency",        // dependency | resource | technical | process
  severity: "medium",        // low | medium | high | critical
  routeTo: "product-lead",   // slack handle or role
  escalate: false
}
```

### Step 3 — Narrative Generation (`src/summary/`)

- **Input:** All structured responses + enriched blockers
- **Process:** Claude API generates a human-readable narrative per team and an executive-level brief
- **Output:** Formatted text blocks ready for delivery

**Per-team digest example:**
> "This Week in Engineering — 8 of 10 engineers submitted updates. Auth work is complete.
> One medium blocker flagged: design sign-off is pending for onboarding. Routed to @product-lead."

**Executive brief example:**
> "Week 11 — 3 blockers across Engineering and Product. One high-severity item needs your attention.
> Overall sentiment: on track for Q2 milestone."

### Step 4 — Delivery

| Channel | Audience | Content | Timing |
|---------|----------|---------|--------|
| Slack (#team-digest) | All teams | Per-team narrative + blocker list | Friday EOD |
| Email | CEO / Exec | High-level brief + escalations | Friday EOD |
| Slack DM | Manager | Monday morning alert for unresolved blockers | Monday 8am |
| Dashboard *(Phase 3)* | Leadership | Trend view across weeks | On-demand |

---

## Timing — When Each Step Happens

```
FRIDAY
  12:00 PM  Survey sent to all employees (external trigger)
  05:00 PM  Survey responses collected (deadline)
  05:05 PM  Pipeline triggered (manual in Phase 2, automated in Phase 3)
              └─ Step 1: Survey ingestion         (~seconds)
              └─ Step 2: NLP classification       (~seconds via Claude API)
              └─ Step 3: Narrative generation     (~seconds via Claude API)
              └─ Step 4: Slack digest delivered   (immediate)
              └─ Step 4: Email brief sent         (immediate)

MONDAY
  08:00 AM  Manager alert sent for any unresolved high/critical blockers (Phase 3)
```

---

## Phase Rollout

### Phase 1 — Scaffold (W1–2) — COMPLETE
- [x] Repo initialized
- [x] Folder structure created
- [x] `src/index.js` entry point running locally
- [x] `package.json` with Anthropic SDK

### Phase 2 — Core Pipeline (W3–4)
- [ ] `src/survey/` — connect Friday survey data source
- [ ] `src/nlp/` — blocker detection and classification
- [ ] `src/summary/` — narrative generation via Claude API
- [ ] Slack digest sender
- [ ] Auto-route blockers to correct owner

### Phase 3 — Intelligence Layer (W5–6)
- [ ] Severity-based escalation routing
- [ ] Monday manager alerts for unresolved blockers
- [ ] Trend and pattern detection across weeks
- [ ] Executive dashboard view
- [ ] End-to-end QA and CEO full demo

---

## CEO Demo Checkpoints

| Demo | Week | What to Show |
|------|------|-------------|
| Demo 1 | W2 | Local app running, project structure, entry point live |
| Demo 2 | W4 | AI reading survey data + Slack digest delivered live |
| Demo 3 | W6 | Full end-to-end system + trend report + next phase plan |

---

## Survey Questions (Source Data)

Every Friday, employees answer 3 questions:

1. **Progress** — What did you accomplish this week?
2. **Blockers** — What is blocking you right now?
3. **Support needed** — What do you need from leadership or teammates?

---

## Key Decisions & Constraints

| Topic | Decision |
|-------|----------|
| Deployment | Local-first; no cloud infrastructure until Phase 3+ |
| AI model | Claude API (Anthropic) for both NLP and narrative generation |
| Privacy | AI reads all survey responses — confirm boundaries with CEO before Phase 2 |
| Trigger | Manual pipeline trigger in Phase 2; automated scheduler in Phase 3 |
| Delivery | Slack for teams, Email for executives |
