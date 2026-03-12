# Productivity Copilot

An AI agent that transforms the weekly Friday employee survey into an active intelligence layer for LeapXpert.

## Three Pillars

- **Innovation** — NLP blocker detection & auto-routing to the right owner
- **Creativity** — Narrative team summaries ("This Week in Engineering")
- **GitHub** — Bootstrapped via Claude Code, runs locally for CEO demos

## Tech Stack

- Runtime: Node.js
- AI: Claude API (Anthropic)
- Delivery: Slack (digest), Email (executive brief)
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
npm start
```

## Roadmap

| Phase | Weeks | Focus |
|-------|-------|-------|
| 1 | W1–2 | Scaffold, repo, local entry point |
| 2 | W3–4 | Survey ingestion, NLP pipeline, Slack digest |
| 3 | W5–6 | Escalation routing, trend detection, CEO demo |

## CEO Demo Schedule

- Every Friday — live working increment shown to CEO
- W2: local app running
- W4: AI reading survey + Slack digest live
- W6: full system demo + next phase plan
