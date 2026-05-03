# prek — Git Hook Manager

**Version 1.0.0**
Manaaki
May 2026

> **Note:**
> This document is for agents and LLMs managing git hooks in this codebase.
> prek is the only hook runner used here — do not add or modify `.pre-commit-config.yaml`.

---

## Abstract

prek is a fast, Rust-based git hook manager that uses `prek.toml` as its native
config format. It is a drop-in alternative to the `pre-commit` framework but
significantly faster and with a cleaner TOML-native config. This project migrated
from `.pre-commit-config.yaml` to `prek.toml` — only `prek.toml` is authoritative.

---

## When to Load This Skill

Load this skill when:
- Adding, removing, or modifying a git hook
- Changing which stage a hook runs at (pre-commit vs pre-push)
- Debugging a hook that isn't running or is failing
- Reinstalling hooks after cloning (e.g. `npx prek install`)
- Understanding what runs automatically on commit or push

---

## This Project's Hooks

Config file: `prek.toml` at the repo root.

| Hook | Stage | Command | Purpose |
|------|-------|---------|---------|
| `biome-check` | pre-commit | `pnpm check:fix` | Lint + format with auto-fix |
| `type-check` | pre-commit | `pnpm type-check` | TypeScript type safety |
| `test` | pre-push | `pnpm test` | Full unit test suite |
| `build` | pre-push | `pnpm build` | Verify the app builds |

**Pre-commit** hooks run on every `git commit` — they are scoped to relevant
file extensions so they only run when matching files are staged.

**Pre-push** hooks run on every `git push` — they always run against the full
codebase, not just staged files.

---

## prek.toml Format

```toml
#:schema https://www.schemastore.org/prek.json
# Configuration for prek: https://prek.j178.dev

[[repos]]
repo = "local"

  [[repos.hooks]]
  id = "my-hook"
  name = "Human readable name"
  entry = "pnpm my-script"
  language = "system"
  pass_filenames = false          # almost always false for pnpm scripts
  files = '\.(ts|tsx)$'          # optional: only run when these files change
  stages = ["pre-push"]          # optional: omit to run at pre-commit (default)
```

### Key fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique identifier, used with `prek run <id>` |
| `name` | yes | Displayed in terminal output |
| `entry` | yes | Command to run |
| `language` | yes | `"system"` for commands available in PATH/node_modules |
| `pass_filenames` | no | If `true`, prek appends matched filenames as args. Almost always `false` for pnpm scripts |
| `files` | no | Regex — hook only runs when staged files match. Omit to always run |
| `stages` | no | List of git stages. Defaults to `["pre-commit"]` if omitted |

### Stages reference

| Stage value | When it runs |
|-------------|-------------|
| `"pre-commit"` | Every `git commit` (default) |
| `"pre-push"` | Every `git push` |
| `"commit-msg"` | After commit message is written |
| `"post-commit"` | After a commit completes |
| `"manual"` | Only via `prek run --hook-stage manual` |

---

## Common Commands

```bash
# List all configured hooks
npx prek list

# Install prek shims into .git/hooks (run after cloning)
npx prek install

# Reinstall and remove any legacy hooks
npx prek install --overwrite

# Install the pre-push shim specifically
npx prek install --overwrite --hook-type pre-push

# Validate prek.toml without running hooks
npx prek validate-config prek.toml

# Run a specific hook manually against all files
npx prek run biome-check --all-files

# Run all pre-commit hooks manually (dry run / manual check)
npx prek run --stage pre-commit --all-files

# Run all pre-push hooks manually
npx prek run --stage pre-push --all-files

# Skip a hook for one commit
SKIP=type-check git commit -m "wip"

# Skip multiple hooks
SKIP=biome-check,type-check git commit -m "wip"
```

---

## Adding a New Hook

1. Add a `[[repos.hooks]]` block to `prek.toml`
2. Validate: `npx prek validate-config prek.toml`
3. Verify it appears: `npx prek list`
4. Test it runs: `npx prek run <id> --all-files`

No reinstall needed — prek reads `prek.toml` at hook execution time, not at
install time. The installed shim in `.git/hooks/` just delegates to prek.

---

## Troubleshooting

**Hook not running on commit**
- Check `npx prek list` — if the hook doesn't appear, `prek.toml` has an error
- Run `npx prek validate-config prek.toml`
- Confirm `.git/hooks/pre-commit` exists and is a prek shim (`cat .git/hooks/pre-commit`)
- If it's not a prek shim, run `npx prek install --overwrite`

**Hook runs on commit but should only run on push**
- Add `stages = ["pre-push"]` to the hook in `prek.toml`

**prek not found**
- It is a devDependency (`@j178/prek`); run `pnpm install`
- Use `npx prek` rather than bare `prek` unless it is in your PATH

**Hooks were wiped after a reinstall**
- prek shims delegate to the `prek` binary; re-running `npx prek install` is safe
- The hook config lives in `prek.toml` (committed), not in `.git/hooks/` (not committed)
