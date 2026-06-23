# X/Twitter to Markdown

A Claude Code and OpenAI Codex agent skill that converts X/Twitter posts, threads, and long-form X Articles into clean Markdown files with YAML frontmatter.

Use it to archive tweets, save X Articles to Obsidian or other PKM systems, preserve research threads, and feed social posts into AI workflows. It uses the **official X API v2** with your own Bearer token: no scraping, no browser cookies, no account session, no telemetry, and no third-party extraction service.

```bash
$ bun scripts/main.ts https://x.com/jack/status/20
[x-to-markdown] Fetching tweet 20 (cost: $0.005, URL input)...
[x-to-markdown] Wrote ./x-to-markdown/jack/20.md
```

## Features

- **Posts, threads, and X Articles** — auto-detected from a single URL.
- **YAML frontmatter** with author, source URL, cover image, timestamps.
- **Optional media download** — images and videos saved alongside the markdown, with a hostname allowlist (`pbs.twimg.com`, `video.twimg.com`), 100 MB cap, 30 s timeout, and `redirect: "manual"` for SSRF resistance.
- **Cost-aware** — URL inputs skip the User resource expansion ($0.005/article); bare-ID inputs pay full price ($0.015) for display-name resolution.
- **No telemetry**, no third-party hosts, no credentials persisted to disk.

## Why this instead of scraping-based Twitter/X readers?

- Uses the official X API v2.
- Does not read browser cookies.
- Does not touch your logged-in account session.
- Does not send content to third-party extraction services.
- Writes local Markdown with YAML frontmatter.
- Includes a documented output threat model for untrusted social content.

## Install

### No-clone skill install

After the npm package is published, install the skill into Claude Code, Codex, Cursor, or all three without cloning the repo:

```bash
npx x-to-markdown install --platform claude
npx x-to-markdown install --platform codex
npx x-to-markdown install --platform cursor
npx x-to-markdown install --platform all
```

Use `--force` to replace an existing installed copy:

```bash
npx x-to-markdown install --platform all --force
```

The installer writes the skill to user-level agent skill directories:

| Platform | Destination |
|---|---|
| Claude Code | `~/.claude/skills/x-to-markdown` |
| OpenAI Codex | `~/.agents/skills/x-to-markdown` |
| Cursor | `~/.cursor/skills/x-to-markdown` |

### Claude Code plugin marketplace

After this repo is registered as a Claude Code marketplace, install the namespaced plugin skill:

```text
/plugin marketplace add heyjello/x-to-markdown
/plugin install x-to-markdown@x-to-markdown
```

The skill is then available as `/x-to-markdown:x-to-markdown`.

### OpenAI Codex plugin marketplace

Register this repo as a Codex marketplace:

```bash
codex plugin marketplace add heyjello/x-to-markdown
```

Then open the plugin browser and install `x-to-markdown`:

```text
/plugins
```

### Cursor GitHub import or plugin

Cursor can import agent skills from GitHub repository links:

1. Open **Cursor Settings -> Rules**.
2. In **Project Rules**, choose **Add Rule**.
3. Select **Remote Rule (Github)**.
4. Enter `https://github.com/heyjello/x-to-markdown`.

This repo also includes `.cursor-plugin/plugin.json` so it can be submitted to the Cursor plugin marketplace or imported into a team marketplace.

### Direct clone fallback

If you want a local editable copy instead of a package or marketplace install:

```bash
git clone https://github.com/heyjello/x-to-markdown ~/.agents/skills/x-to-markdown
```

### Standalone CLI

After the npm package is published, run the converter without cloning:

```bash
npx x-to-markdown <url>
```

The converter itself runs on [Bun](https://bun.sh). If you prefer a local checkout:

```bash
git clone https://github.com/heyjello/x-to-markdown
cd x-to-markdown
bun scripts/main.ts <url>
```

The scripts are TypeScript and run directly under Bun. Node 20+ users will need `tsx` or a build step for the converter; the `install` subcommand is Node-based.

## Common uses

- Convert a tweet to Markdown.
- Convert a Twitter/X thread to Markdown.
- Save a long-form X Article to Markdown.
- Archive X posts for Obsidian, Logseq, or another PKM workflow.
- Create clean source notes for research, content curation, or AI-agent context.

## Optional URL Discovery With TweetClaw

`x-to-markdown` works best after you already have the exact public X/Twitter status URL to archive. If you use OpenClaw and need to find candidate URLs first, you can install TweetClaw as a separate source-discovery plugin:

```bash
openclaw plugins install npm:@xquik/tweetclaw@1.6.31
```

Use TweetClaw only to search tweets, search tweet replies, inspect public user timelines, or collect public media context. Review the returned public URLs, choose the posts you want to preserve, then pass each `https://x.com/<user>/status/<id>` URL to `x-to-markdown` for Markdown conversion. Keep this skill responsible for archiving the selected post, thread, article, and media. Do not use TweetClaw from this workflow for posting, replying, direct messages, account changes, monitors, webhooks, or credential handling.

## Setup

Get a Bearer token at <https://console.x.com>. The X API v2 is pay-per-request:

| Input shape | Cost per call | Why |
|---|---|---|
| `https://x.com/<user>/status/<id>` | **$0.005** | Username extracted from URL; no User resource fetched. |
| Bare numeric ID (e.g. `1234567890`) | **$0.015** | Full User expansion required for display name. |

```bash
export X_BEARER_TOKEN="AAAA..."
```

## Usage

```bash
x-to-markdown <url> [options]
```

**Options:**
- `--output <path>` / `-o` — output path (file or dir). Default: `./x-to-markdown/<username>/<id>.md`
- `--thread` — also fetch the reply chain. Uses `search/recent`, so threads older than 7 days fall back to the root tweet only (a Pro-tier API limitation).
- `--download-media` — save images/videos under `imgs/` and `videos/` next to the markdown.
- `--json` — emit JSON metadata to stdout instead of markdown.
- `--help` / `-h`

## Examples

```bash
# Single tweet
bun scripts/main.ts https://x.com/jack/status/20

# Thread with local media
bun scripts/main.ts https://x.com/elonmusk/status/... --thread --download-media -o ./out/

# Bare ID (costs $0.015)
bun scripts/main.ts 1234567890123456789

# JSON metadata for piping
bun scripts/main.ts https://x.com/jack/status/20 --json | jq -r '.markdownPath'
```

## What it does NOT do

- **Article media URLs** — v2 returns media keys for articles but does not expand them to URLs. The Media section lists keys with a note pointing back to the source tweet.
- **Threads older than 7 days** — `search/recent` is 7-day-bound on the standard tier. The root tweet is fetched and a warning is logged.
- **Quoted-tweet author resolution on URL inputs** — when the cost-saving URL path is used, the User resource isn't fetched, so quoted-tweet author display names aren't resolved. Articles don't surface this; tweets render the quoted block without the author parenthetical.

## Output threat model

This output contains attacker-controlled content from public X posts. Treat it as untrusted text:

- **Safe with strict markdown renderers** — no raw-HTML pass-through, no `javascript:` URL allowlist. The skill escapes HTML metacharacters, markdown control chars (` ` `, `[`, `]`, `(`, `)`, `\`), and emits YAML frontmatter via JSON-string encoding.
- **Code-block fences auto-extend** when content contains triple backticks.
- **Not safe** to render with `--unsafe` markdown engines (e.g., GFM raw-HTML, marked w/ `sanitize: false`, MDX with HTML pass-through).
- **Not safe** to pipe into an LLM that acts on instructions in content (out-of-scope: prompt injection).
- **Not safe** to use as the source of truth for filenames, paths, or shell args without further validation.

## Security

The Bearer token is read from `X_BEARER_TOKEN` once per invocation and never logged or written to disk. The only outbound hosts are `api.x.com` and (with `--download-media`) `pbs.twimg.com` / `video.twimg.com`.

Security posture:

- Official X API v2 Bearer token only — no scraping, no session cookies, no account-suspension risk.
- Media downloader hardened with hostname allowlist (`pbs.twimg.com`, `video.twimg.com`), manual redirect handling, response-size cap, and per-request timeout.
- No credential persistence to disk.
- No telemetry or third-party network calls.

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Runtime

Default: [Bun](https://bun.sh). Node 20+ also works, but on machines with corporate TLS interception (e.g., Cisco Secure Access) you may need `NODE_EXTRA_CA_CERTS` pointing at the corporate CA bundle. Bun honors the system keychain on macOS and avoids this entirely.

## Suggested GitHub topics

`claude-skill`, `codex-skill`, `agent-skills`, `ai-agent`, `twitter`, `x-api`, `x-api-v2`, `x-articles`, `markdown`, `obsidian`, `pkm`, `content-archiving`, `typescript`, `bun`, `claude-code`, `openai-codex`

## License

MIT — see [LICENSE](LICENSE).
