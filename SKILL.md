---
name: x-to-markdown
description: Use when the user asks to convert an X (Twitter) post, thread, or X Article URL into a markdown file. Auto-detects articles. Uses the official X API v2 with a Bearer token (~$0.005/article from URL, ~$0.015 from bare ID). No account session is touched.
---

# X to Markdown

Converts X (Twitter) posts, threads, and X Articles into markdown files with YAML frontmatter, optionally localizing media (images/videos) to disk.

## When to use

User pastes an `x.com/<user>/status/<id>` or `twitter.com/<user>/status/<id>` URL and wants a markdown file. Also works on bare 18-digit tweet IDs. **X Articles are auto-detected** — paste the tweet URL that contains the article (the one with `/status/<id>`, not `/i/article/<id>`); the skill detects the `article` field on the tweet and renders the full body, code blocks, and reference list.

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

## Security notes

- Uses the official X API v2 Bearer token only — no scraping, no session cookies, no account-suspension risk.
- Media downloader has a hostname allowlist (`pbs.twimg.com`, `video.twimg.com`), manual redirect handling, response size cap, and request timeout.
- No credential persistence to disk.
- No telemetry or third-party network calls.

## Threat model

The Bearer token is read from `X_BEARER_TOKEN` once per invocation and never logged or written to disk. The only outbound hosts are `api.x.com` (API) and (with `--download-media`) `pbs.twimg.com` / `video.twimg.com` (CDN).
