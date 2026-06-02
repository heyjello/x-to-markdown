# x-to-markdown

Convert X (Twitter) posts, threads, and X Articles into clean markdown files using the **official X API v2**. Pay-per-request via your own Bearer token — no account session, no scraping, no cookies.

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

## Install

### As a Claude skill (recommended)

Drop the repo at `~/.claude/skills/x-to-markdown/`. Claude will discover it via `SKILL.md`.

```bash
git clone https://github.com/heyjello/x-to-markdown ~/.claude/skills/x-to-markdown
```

### As a standalone CLI

Clone anywhere and run with [Bun](https://bun.sh):

```bash
git clone https://github.com/heyjello/x-to-markdown
cd x-to-markdown
bun scripts/main.ts <url>
```

The scripts are TypeScript and run directly under Bun. Node 20+ users will need `tsx` or a build step.

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
bun scripts/main.ts <url> [options]
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

## Runtime

Default: [Bun](https://bun.sh). Node 20+ also works, but on machines with corporate TLS interception (e.g., Cisco Secure Access) you may need `NODE_EXTRA_CA_CERTS` pointing at the corporate CA bundle. Bun honors the system keychain on macOS and avoids this entirely.

## License

MIT — see [LICENSE](LICENSE).
