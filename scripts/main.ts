#!/usr/bin/env bun
import path from "node:path";
import process from "node:process";
import { mkdir, writeFile } from "node:fs/promises";

import { fetchTweet, fetchThread } from "./x-api.js";
import { renderMarkdown, renderArticleMarkdown } from "./markdown.js";
import { localizeMedia } from "./media-localizer.js";
import type { FetchedTweet } from "./types.js";

type CliArgs = {
  url: string | null;
  output: string | null;
  json: boolean;
  thread: boolean;
  downloadMedia: boolean;
  help: boolean;
};

function printUsage(exitCode: number): never {
  const usage = `X (Twitter) to Markdown

Usage:
  x-to-markdown <url> [options]

Options:
  --output <path>, -o    Output path (file or dir). Default: ./x-to-markdown/<username>/<id>.md
  --thread               Fetch reply chain (recent threads only; 7-day lookback via search/recent)
  --download-media       Save images/videos to ./imgs/ and ./videos/ next to markdown
  --json                 Print JSON metadata to stdout instead of writing markdown
  --help, -h

Env:
  X_BEARER_TOKEN         Required. Bearer token from https://console.x.com (pay-per-request).

Examples:
  x-to-markdown https://x.com/jack/status/20
  x-to-markdown https://x.com/elonmusk/status/... --thread --download-media -o ./out/
`;
  console.log(usage);
  process.exit(exitCode);
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    url: null,
    output: null,
    json: false,
    thread: false,
    downloadMedia: false,
    help: false,
  };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") { out.help = true; continue; }
    if (a === "--json") { out.json = true; continue; }
    if (a === "--thread") { out.thread = true; continue; }
    if (a === "--download-media") { out.downloadMedia = true; continue; }
    if (a === "--url") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --url");
      out.url = v; continue;
    }
    if (a === "--output" || a === "-o") {
      const v = argv[++i];
      if (!v) throw new Error(`Missing value for ${a}`);
      out.output = v; continue;
    }
    if (a.startsWith("-")) throw new Error(`Unknown option: ${a}`);
    positional.push(a);
  }

  if (!out.url && positional.length > 0) out.url = positional[0]!;
  return out;
}

type ParsedInput = { tweetId: string; username: string | null };

function parseInput(input: string): ParsedInput | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return { tweetId: trimmed, username: null };
  try {
    const url = new URL(trimmed);
    const m = url.pathname.match(/^\/([A-Za-z0-9_]+)\/status(?:es)?\/(\d+)/);
    if (!m) return null;
    return { tweetId: m[2]!, username: m[1]! };
  } catch {
    return null;
  }
}

function sanitizeSegment(input: string): string {
  return input
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 120);
}

async function resolveOutputPath(
  rootTweet: FetchedTweet,
  argsOutput: string | null
): Promise<{ markdownPath: string; outputDir: string }> {
  const username = sanitizeSegment(rootTweet.author.username);
  const id = rootTweet.tweet.id;
  const fileName = `${id}.md`;

  if (!argsOutput) {
    const dir = path.resolve(process.cwd(), "x-to-markdown", username);
    await mkdir(dir, { recursive: true });
    return { markdownPath: path.join(dir, fileName), outputDir: dir };
  }

  const wantsDir = argsOutput.endsWith("/") || argsOutput.endsWith(path.sep);
  const resolved = path.resolve(argsOutput);

  if (wantsDir || !path.extname(resolved)) {
    await mkdir(resolved, { recursive: true });
    return { markdownPath: path.join(resolved, fileName), outputDir: resolved };
  }

  const dir = path.dirname(resolved);
  await mkdir(dir, { recursive: true });
  return { markdownPath: resolved, outputDir: dir };
}

async function run(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  if (args.help) printUsage(0);

  const inputUrl = args.url;
  if (!inputUrl) {
    console.error("Error: missing URL.\n");
    printUsage(2);
  }

  const parsed = parseInput(inputUrl);
  if (!parsed) {
    console.error(`Error: could not parse tweet ID from: ${inputUrl}`);
    process.exit(2);
  }
  const { tweetId, username: urlUsername } = parsed;

  const log = (msg: string) => console.error(msg);

  log(`[x-to-markdown] Fetching tweet ${tweetId}${urlUsername ? ` (cost: $0.005, URL input)` : ` (cost: $0.015, bare-ID input)`}...`);
  const root = await fetchTweet(tweetId, urlUsername ?? undefined);

  const article = root.tweet.article;
  let tweets: FetchedTweet[] = [root];

  if (article) {
    log(`[x-to-markdown] Detected X Article: "${article.title ?? "(untitled)"}"`);
  } else if (args.thread) {
    log(`[x-to-markdown] Fetching thread from @${root.author.username}...`);
    try {
      tweets = await fetchThread(tweetId, root.author.username);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[x-to-markdown] Thread fetch failed (${msg}). Falling back to single tweet.`);
      tweets = [root];
    }
  }

  let markdown = article
    ? renderArticleMarkdown(root, article)
    : renderMarkdown(tweets);
  const { markdownPath, outputDir } = await resolveOutputPath(root, args.output);

  if (args.downloadMedia) {
    log(`[x-to-markdown] Downloading media to ${outputDir}...`);
    const result = await localizeMedia(markdown, markdownPath, log);
    markdown = result.markdown;
    log(`[x-to-markdown] Downloaded ${result.downloadedImages} image(s), ${result.downloadedVideos} video(s).`);
  }

  await writeFile(markdownPath, markdown, "utf-8");

  if (args.json) {
    console.log(JSON.stringify({
      markdownPath,
      outputDir,
      tweetCount: tweets.length,
      author: root.author.username,
      rootId: root.tweet.id,
    }, null, 2));
  } else {
    log(`[x-to-markdown] Wrote ${markdownPath}`);
  }
}

run(process.argv.slice(2)).catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[x-to-markdown] ${msg}`);
  process.exit(1);
});
