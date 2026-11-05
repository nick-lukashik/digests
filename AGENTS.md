# AGENTS.md

digests: a Kubernetes CronJob that sends a daily Google Analytics digest to a Telegram forum topic and exits. No framework, no server, no database, no state. Human docs: `README.md`.

## Commands

`pnpm install`, `pnpm format`, `pnpm verify` (lint, typecheck, build, tests). `pnpm verify` must be green before you hand work over. Tests only through `vitest run`, with `fetch` stubbed: nothing calls the real Google or Telegram.

## Structure

- `src/main.ts`: entry point, sets the exit code. `src/run.ts`: one run, returns the code.
- `src/dates.ts`, `src/format.ts`, `src/reports.ts`: pure logic (days, the Russian message, report requests and parsing). Unit tests sit next to the code.
- `src/env.ts`: the Zod env schema. Nothing else reads the environment.
- `src/google.ts`, `src/telegram.ts`, `src/http.ts`: `fetch` and `node:crypto`, no client libraries.

## Rules

- Any failure ends in a non-zero exit, so the Job retries. Telegram is the last step of a run.
- A token, the key, the Telegram URL or the message's contents never reach a log or an error. Errors of `fetch` stay in `src/http.ts`, only their kind leaves it.
- Every value from Google goes through `safe()` in `src/format.ts`: it comes from visitors' URLs and must never become markup.
- A report with no rows means nobody came; anything malformed throws. Never read a failure as an empty day.
- All dates are in `Asia/Tbilisi`, the constant in `src/dates.ts`.
- Runtime dependencies stay at Zod, for the env only.
- The image runs as uid `10001` with a read-only root filesystem: write nothing.
- Code style is Biome's (`biome.json`). English in code, comments and docs; Russian only in the message.
- No secrets, real IPs or e-mail addresses in files.
