# Productivity Copilot — Requirements

## Project Overview
An AI agent that transforms the weekly Friday employee survey into an
active intelligence layer for LeapXpert.

## Three Pillars
- 💡 Innovation: NLP blocker detection & auto-routing to the right owner
- ✨ Creativity: Narrative team summaries — "This Week in Engineering"
- ⚙️ GitHub: Bootstrapped via Claude Code, runs locally for CEO demos

## Tech Stack
- Runtime: Node.js
- AI: Claude API (Anthropic)
- Delivery: Slack (digest), Email (executive brief)
- Deployment: Local for now, cloud later

## Project Structure
src/
nlp/        → blocker detection & classification logic
summary/    → narrative summary generator
survey/     → survey ingestion & parsing
data/         → sample survey response data
docs/         → documentation
scripts/      → utility & automation scripts

## Features — Phase 1 (W1–2)
- [ ] Git repo initialized via Claude Code
- [ ] Project scaffolded with folder structure above
- [ ] README.md, .gitignore, package.json created
- [ ] src/index.js entry point running locally
- [ ] First commit pushed to GitHub

## Features — Phase 2 (W3–4)
- [ ] Connect Friday survey data source
- [ ] NLP pipeline to classify blockers
- [ ] Auto-route blockers to correct owner
- [ ] Generate per-team narrative summaries
- [ ] Slack digest sender

## Features — Phase 3 (W5–6)
- [ ] Escalation routing (severity-based)
- [ ] Manager Monday morning alert
- [ ] Trend & pattern detection across weeks
- [ ] Executive dashboard view
- [ ] End-to-end QA & CEO full demo

## CEO Demo Schedule
- Every Friday — live working increment shown to CEO
- W2: local app running
- W4: AI reading survey + Slack digest live
- W6: full system demo + next phase plan

## Notes
- Survey sent every Friday to all employees
- 3 questions: progress, blockers, support needed
- Privacy: AI reads responses — confirm boundaries with CEO
- Deployment: local-first, no cloud infrastructure yet
```

---

## Step 3 — Then in Claude Code type:
```
Read requirements.md and scaffold this project: create all folders and files described, add .gitignore for Node.js, then git add all, commit "feat: initial scaffold — Productivity Copilot 🚀", and push to a new public GitHub repo named productivity-copilot