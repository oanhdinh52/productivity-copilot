# Productivity Copilot

An AI agent that transforms the weekly Friday employee survey into an active intelligence layer for LeapXpert.

## Three Pillars

- **Innovation** — NLP blocker detection & auto-routing to the right owner
- **Creativity** — Narrative team summaries ("This Week in Engineering")
- **GitHub** — Bootstrapped via Claude Code, runs locally for CEO demos

## Tech Stack

- Runtime: Node.js
- AI: Azure OpenAI (GPT-4o via Azure endpoint)
- Delivery: Slack only (team digest, manager alerts, CEO brief)
- Deployment: Local-first, cloud later

## Project Structure

```
src/
  nlp/        → blocker detection & classification logic
  summary/    → narrative summary generator
  survey/     → survey ingestion & parsing
data/         → sample survey response data
docs/         → documentation
scripts/      → utility & automation scripts
```

## Getting Started

```bash
npm install
cp .env.local.example .env.local   # fill in your Azure OpenAI + Slack credentials
npm start
```

## Roadmap

| Phase | Weeks | Status | Focus |
|-------|-------|--------|-------|
| 1 | W1–2 | Done | Scaffold, repo, Azure OpenAI + Slack-only setup |
| 2 | W3–4 | Up next | Survey ingestion, NLP pipeline, Slack digest |
| 3 | W5–6 | Planned | Escalation routing, trend detection, CEO demo |

## CEO Demo Schedule

- Every Friday — live working increment shown to CEO
- W2: local app running
- W4: AI reading survey + Slack digest live
- W6: full system demo + next phase plan
