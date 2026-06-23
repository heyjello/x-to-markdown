---
name: x-to-markdown
description: Convert X/Twitter posts, threads, and long-form X Articles into Markdown files with YAML frontmatter. Use when the user shares an x.com or twitter.com status URL, wants to archive tweets, save an X Article to Obsidian/PKM, download post media, or turn social content into clean Markdown. Uses the official X API v2 with X_BEARER_TOKEN; no scraping, cookies, account session, telemetry, or third-party hosts.
---

# X to Markdown

Converts X/Twitter posts, threads, and X Articles into Markdown files with YAML frontmatter, optionally localizing media (images/videos) to disk.

## When to use

Use this skill when the user wants to:

- Convert a tweet, thread, or X Article to Markdown.
- Archive X/Twitter posts for research or content curation.
- Save an X Article to Obsidian, Logseq, or another PKM system.
- Download supported post media alongside the generated Markdown.
- Turn social content into clean local notes for an AI-agent workflow.

The user can paste an `x.com/<user>/status/<id>` or `twitter.com/<user>/status/<id>` URL. Bare 18-digit tweet IDs also work, but full URLs are cheaper because the username can be extracted from the path. **X Articles are auto-detected** — paste the tweet URL that contains the article (the one with `/status/<id>`, not `/i/article/<id>`); the skill detects the `article` field on the tweet and renders the full body, code blocks, and reference list.

## What it does NOT do

- **Article media URLs** — v2 returns media keys for articles but doesn't expand them to URLs. Media is listed by key with a note to view the source tweet.
- **Threads older than 7 days** require X API Pro tier ($5000/mo). The skill will fetch the root tweet only and warn.

## Setup

Requires `X_BEARER_TOKEN` env var (Bearer token from https://console.x.com). Pay-per-request, no subscription.

**Per-call cost:**
- URL input (`https://x.com/<user>/status/<id>`): **$0.005** — username extracted from URL path, no User resource fetched.
- Bare numeric ID input: **$0.015** — full User expansion required to resolve display name.

For articles, prefer pasting the full URL.

```bash
export X_BEARER_TOKEN="AAAA..."
```

## Usage

```bash
npx -y bun ${SKILL_DIR}/scripts/main.ts <url> [options]
```

**Options:**
- `--output <path>` / `-o` — output path (file or dir). Default: `./x-to-markdown/<username>/<id>.md`
- `--thread` — also fetch reply chain (recent threads only; 7-day lookback)
- `--download-media` — save images/videos under `imgs/` and `videos/` next to the markdown
- `--json` — emit JSON metadata instead of markdown to stdout
- `--help` / `-h`

## Examples

```bash
# Single tweet → markdown
npx -y bun scripts/main.ts https://x.com/jack/status/20

# Thread, with media downloaded locally
npx -y bun scripts/main.ts https://x.com/elonmusk/status/... --thread --download-media -o ./out/
```

## Optional URL discovery

This skill expects a reviewed public X/Twitter status URL. If the user needs to find candidate posts before conversion and OpenClaw has TweetClaw installed, use TweetClaw only as a separate source-discovery step:

```bash
openclaw plugins install npm:@xquik/tweetclaw@1.6.31
```

Use TweetClaw for tweet search, reply search, public user timelines, or public media context. Review the returned URLs, choose the posts to archive, then pass each `https://x.com/<user>/status/<id>` URL back to `x-to-markdown`. Do not use the discovery step for posting, replying, direct messages, account changes, monitors, webhooks, or credential handling.

## Security notes

- Uses the official X API v2 Bearer token only — no scraping, no session cookies, no account-suspension risk.
- Media downloader has a hostname allowlist (`pbs.twimg.com`, `video.twimg.com`), manual redirect handling, response size cap, and request timeout.
- No credential persistence to disk.
- No telemetry or third-party network calls.

## Threat model

The Bearer token is read from `X_BEARER_TOKEN` once per invocation and never logged or written to disk. The only outbound hosts are `api.x.com` (API) and (with `--download-media`) `pbs.twimg.com` / `video.twimg.com` (CDN).
