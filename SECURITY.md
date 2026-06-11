# Security Policy

## Reporting vulnerabilities

Please report security issues privately by opening a GitHub security advisory for this repository, or by contacting the maintainer through the repository owner profile if advisories are unavailable.

Do not open a public issue for a vulnerability until it has been reviewed.

## Security model

`x-to-markdown` uses the official X API v2 with a Bearer token supplied through `X_BEARER_TOKEN`.

- The token is read from the environment once per invocation.
- The token is never logged or written to disk.
- No browser cookies or account session are read.
- No telemetry is collected.
- The only API host is `api.x.com`.
- With `--download-media`, media downloads are limited to `pbs.twimg.com` and `video.twimg.com`.

Generated Markdown contains attacker-controlled public social content. Treat output as untrusted text and review the README threat model before rendering it with unsafe Markdown, MDX, or LLM automation pipelines.
