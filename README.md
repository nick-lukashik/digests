# digests

A daily Google Analytics digest in the "Digests" topic of the Telegram supergroup.

A Kubernetes CronJob at 12:00 `Asia/Tbilisi`: it starts, reads the reports, sends one message and exits. Exit code 0 on success, 1 on any failure, so the Job retries. No HTTP server, no port, no database, no state.

## Which days

Google has a day's data ready only in the afternoon of the next day. So at 12:00:

- today minus 2 days is complete: the full report;
- today minus 1 day is not: one preliminary line.

All dates are in `Asia/Tbilisi`.

## Environment

| Variable                  | Required | What                                                                                                 |
| ------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `GA_PROPERTY_ID`          | yes      | Digits                                                                                               |
| `GA_SERVICE_ACCOUNT_JSON` | yes      | The whole JSON key of a service account with read access to the property. Secret                     |
| `TELEGRAM_BOT_TOKEN`      | yes      | Secret                                                                                               |
| `TELEGRAM_CHAT_ID`        | yes      | A negative integer                                                                                   |
| `TELEGRAM_TOPIC_ID`       | yes      | `message_thread_id` of the topic                                                                     |
| `DIGEST_DATE`             | no       | `YYYY-MM-DD`, for a run by hand: the full report for that day, the preliminary line for the next one |
| `LOG_LEVEL`               | no       | `info` by default                                                                                    |

Invalid variables are named at start, with the reason, never with the value.

## The message

```
📊 Дайджест за 4 ноября
👥 9 человек · 12 визитов · в среднем 1:34
📄 31 просмотр

🔗 Откуда
linkedin / post-nextjs: 5 визитов, 2:10
прямые заходы: 4 визита, 0:40

🎯 По меткам
14:32 cover-letter / google · Berlin, компьютер · 3:20

📄 Страницы
/ 12
/privacy 2

🕐 5 ноября, предварительно: 3 человека, linkedin / profile 2
```

- **No visits:** `Никто не заходил.`, without the sections. A report with no rows means nobody came; a failed request fails the run.
- **Hidden rows:** when Google applies its privacy threshold, the message says so in one line and the log has a warning.
- **Length:** over Telegram's 4096 characters, rows go from the end of the longest list and the list says how many were left out.
- **Values from Google:** escaped for HTML and shortened to 100 characters. Page paths and campaign names come from visitors' URLs.

## Commands

```bash
pnpm install
cp .env.example .env   # then fill it
pnpm build && pnpm start
DIGEST_DATE=2026-11-04 pnpm start
pnpm verify
```
