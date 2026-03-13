# Contributing to Productivity Copilot

## Commit Message Format

```
<type>: [<ticket>] <short description>
```

- `<type>` — one of the types below (required)
- `[<ticket>]` — Jira / Linear ticket ID if applicable, e.g. `[PC-42]` (optional)
- `<short description>` — imperative, lowercase, no period at the end

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `chore` | Maintenance, config, dependency updates |
| `docs` | Documentation only |
| `refactor` | Code change that isn't a fix or feature |
| `test` | Adding or updating tests |
| `ci` | CI/CD pipeline changes |
| `format` | Formatting, whitespace, code style (no logic change) |

### Examples

```
feat: [PC-12] add NLP blocker classification pipeline
fix: [PC-34] handle empty survey response gracefully
chore: upgrade openai sdk to v4.1.0
docs: update README with Phase 2 setup steps
test: add unit tests for survey parser
ci: add coverage gate to GitHub Actions workflow
format: standardise indentation in src/survey
```

## Rules

- Never force push to `master` — history must be preserved
- One logical change per commit
- All commits to `master` must pass CI (build + 80% coverage gate)
