# Productivity Copilot (@prody)

A Slack-native AI agent that passively observes employee Slack activity throughout
the week and automatically drafts their Friday survey submission — so employees
just review, edit if needed, and submit instead of writing from scratch.

A second AI pipeline reads those submissions and delivers a structured Team Lead
Report as a Slack DM — a trusted advisor briefing, not a data dump.

---

## What @prody does

### Monday to Friday — passive collection
- Invited to one or more Slack channels
- Silently reads and stores every message per user — no responses, no reactions,
  no channel noise
- Any user can mention `@prody` to flag a message as high priority; prody reacts
  with ✅ only
- Collection stops at Friday 12PM (configurable); messages after that go into the
  following week's file

### Friday 12PM — draft generation
- Reads each user's collected messages
- Calls Azure OpenAI to identify progress signals, blockers, and support requests
- DMs each user a personalised draft with three sections:
  1. Progress
  2. Blockers
  3. Support needed
- Draft includes **Edit & Submit** and **Submit As-Is** buttons — prody never
  submits on behalf of the user
- Confirmation message: "✅ Your Productivity Copilot weekly has been submitted.
  See you next Friday 😊"

### Report day — team lead report
- Reads that week's submissions for all `TEAM_MEMBER_IDS`
- Calls Azure OpenAI to generate a structured JSON report
- Delivers a Slack DM to `TEAM_LEAD_ID` with five sections:
  - **Team Pulse header** — week number, date range, submission rate
  - **Not Submitted** — who hasn't reported in (omitted if everyone submitted)
  - **This Week** — opening assessment, highlights, week-over-week trend
  - **Needs Your Attention** — critical blockers with a suggested action each
  - **Monitor** — medium blockers to watch (omitted if none)

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js ≥ 18 | `node --version` to check |
| npm ≥ 9 | bundled with Node.js |
| pm2 | `npm install -g pm2` — for managed process mode |
| Slack app | Socket Mode enabled, Events API subscribed |
| Azure OpenAI | GPT-4o deployment with endpoint + API key |
| gitleaks | Optional but recommended — see [Security](#security) |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/oanhdinh52/productivity-copilot.git
cd productivity-copilot
npm install
```

### 2. Create `.env.local`

```bash
cp .env.local.example .env.local
```

Fill in all variables — see [Environment variables](#environment-variables) below.

### 3. Activate git hooks

```bash
git config core.hooksPath .githooks
```

This enables the pre-commit secret scanner. See [Security](#security).

### 4. Start the bot

**Development** (auto-restarts on file change):
```bash
npm run dev
```

**Production** (managed by pm2):
```bash
npm run prody:start
```

---

## Environment variables

All variables go in `.env.local`. Never commit this file.

### Slack

| Variable | Description |
|---|---|
| `SLACK_BOT_TOKEN` | Bot OAuth token (`xoxb-…`) |
| `SLACK_APP_TOKEN` | App-level token for Socket Mode (`xapp-…`) |
| `SLACK_SIGNING_SECRET` | From your Slack app's Basic Information page |

### Azure OpenAI

| Variable | Description |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | Full endpoint URL from Azure portal |
| `AZURE_OPENAI_API_KEY` | API key from Azure portal |
| `AZURE_OPENAI_API_VERSION` | e.g. `2024-02-01` |
| `AZURE_OPENAI_DEPLOYMENT_DEFAULT` | Your GPT-4o deployment name |

### Team configuration

| Variable | Description | Example |
|---|---|---|
| `TEAM_LEAD_ID` | Slack user ID of the team lead who receives the report | `U012AB3CD` |
| `TEAM_MEMBER_IDS` | Comma-separated Slack user IDs included in the report | `U012AB3CD,U034EF5GH` |

### Scheduler

All jobs are configurable without code changes. Update `.env.local` and run
`npm run prody:restart`.

| Variable | Description | Test value | Production value |
|---|---|---|---|
| `COLLECTION_CUTOFF_DAY` | Day collection stops | `wednesday` | `friday` |
| `COLLECTION_CUTOFF_HOUR` | Hour (24h) | `10` | `12` |
| `COLLECTION_CUTOFF_MINUTE` | Minute | `52` | `0` |
| `DRAFT_DAY` | Day draft is generated | `wednesday` | `friday` |
| `DRAFT_HOUR` | Hour (24h) | `11` | `12` |
| `DRAFT_MINUTE` | Minute | `0` | `0` |
| `REPORT_DAY` | Day report runs | `wednesday` | `tuesday` |
| `REPORT_HOUR` | Hour (24h) | `11` | `9` |
| `REPORT_MINUTE` | Minute | `30` | `0` |

### Timezone

| Variable | Description | Default |
|---|---|---|
| `TZ` | IANA timezone for all cron jobs | `Asia/Ho_Chi_Minh` |

---

## npm scripts

| Script | Description |
|---|---|
| `npm start` | Start the bot (no auto-restart) |
| `npm run dev` | Start with `--watch` — restarts on file changes |
| `npm run draft` | Manually trigger draft generation for all users |
| `npm run report` | Manually trigger the team lead report |
| `npm run prody:start` | Start via pm2 (production) |
| `npm run prody:stop` | Stop the pm2 process |
| `npm run prody:restart` | Restart — picks up `.env.local` changes |
| `npm run prody:status` | Show pm2 process status |
| `npm run prody:logs` | Tail pm2 logs |

---

## Project structure

```
src/
  collector/   — passive message collection + @prody mention handler
  nlp/         — Azure OpenAI draft generation per user
  survey/      — draft DM delivery + edit/submit flow (Block Kit)
  report/      — submission reader + team lead report generator
  logger.js    — structured JSON logger (SOC 2 compliant)
  index.js     — app entry point + cron scheduler
data/
  messages/    — collected weekly messages per user (gitignored)
  submissions/ — submitted survey responses (gitignored)
scripts/
  draft.js     — manual draft trigger
  report.js    — manual report trigger
.githooks/
  pre-commit   — gitleaks secret scanner
.gitleaks.toml — gitleaks configuration
agent-security.md — full security requirements (SOC 2 + ISO 27001)
```

---

## Scheduler configuration

All jobs use node-cron with the `TZ` timezone. Day names are lowercase English
(`monday` … `friday`). To change a schedule:

1. Update the relevant variables in `.env.local`
2. Run `npm run prody:restart`

No code changes needed. The cron expression is built at startup from the env vars.

---

## Security

This project follows the requirements in [`agent-security.md`](./agent-security.md)
(SOC 2 Type 2 + ISO 27001).

### Pre-commit secret scanning

The `.githooks/pre-commit` hook runs `gitleaks protect --staged` before every commit.

**Activate on first clone:**
```bash
git config core.hooksPath .githooks
```

**Install gitleaks** (required for the hook to enforce scanning):
```bash
# macOS
brew install gitleaks

# Windows (winget)
winget install gitleaks

# Or download from https://github.com/gitleaks/gitleaks/releases
```

Without gitleaks installed the hook soft-skips with a warning — it does not block
commits. Install it before working with credentials.

### Secrets

- All credentials in `.env.local` — never committed
- `.gitignore` excludes `.env`, `*.env*`, `*.key`, `*.pem`
- If a secret is ever committed: **rotate immediately** — rewriting history is not enough

### Logging

All logs are structured JSON — fields: `timestamp`, `level`, `event`, `user_id`,
`action`, `outcome`. Message content, survey answers, tokens, and API keys are
never logged.

### Input sanitization

All user-supplied text (Slack messages, survey answers) is sanitized before being
passed to Azure OpenAI — control characters stripped, strings truncated to 2 000
characters — to defend against prompt injection.

### Dependencies

All dependencies are pinned to exact versions. To update a dependency:
1. Change the version explicitly in `package.json`
2. Run `npm install`
3. Review the changelog
4. Commit both `package.json` and `package-lock.json`

### Data

`data/messages/` and `data/submissions/` contain Slack user IDs and survey text.
Both directories are gitignored. Do not commit them. For production use, replace
JSON file storage with an encrypted database.

---

## Out of scope (POC)

- Multi-channel management dashboard
- Database persistence (JSON files only for now)
- Cloud deployment (local only)
- Dashboard and analytics

---

*Exceptions to security requirements need written approval from Head of IT Security
+ Head of Engineering. Contact: stephane.sara@leapxpert.com | #it-compliance*
