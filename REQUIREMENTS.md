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
- AI: Azure OpenAI (endpoint + key in .env.local)
- Survey Collection: Slack (bot sends Friday survey to all employees)
- Feedback Collection: Slack (employees respond directly in Slack)
- Reporting: Slack (weekly digest posted to designated channel)
- Deployment: Local for now, cloud later

## Slack Channels
- Survey delivery: bot posts 3 questions every Friday
- Employee responses: collected as Slack replies/DMs
- Manager digest: blocker summary posted Monday morning
- Executive report: CEO brief posted to leadership channel

## Project Structure
src/
nlp/        → blocker detection & classification logic
summary/    → narrative summary generator
survey/     → survey ingestion & parsing
data/         → sample survey response data
docs/         → documentation
scripts/      → utility & automation scripts

## Features — Phase 1 (W1–2)
- [x] Git repo initialized via Claude Code
- [x] Project scaffolded with folder structure above
- [x] README.md, .gitignore, package.json created
- [x] src/index.js entry point running locally
- [x] First commit pushed to GitHub
- [x] Switch to Azure OpenAI + Slack-only delivery (no email)
- [x] env templates (.env.example, .env.local.example) committed
- [x] Flow guide added to docs/flow-guide.md

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