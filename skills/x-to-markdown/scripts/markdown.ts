import type { FetchedTweet, V2Article, V2Media, V2User } from "./types.js";

function escapeMarkdownInline(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/[\[\]()]/g, "\\$&")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function yamlString(s: string): string {
  return JSON.stringify(s);
}

function formatHandleWithName(author: V2User): string {
  const { username, name } = author;
  if (name && name !== username) {
    return `@${username} (${escapeMarkdownInline(name)})`;
  }
  return `@${username}`;
}

function escapeMarkdownAlt(text: string): string {
  return text.replace(/[\[\]()]/g, "\\$&");
}

function tweetUrl(username: string, id: string): string {
  return `https://x.com/${username}/status/${id}`;
}

function selectVideoUrl(media: V2Media): string | null {
  const variants = (media.variants ?? []).filter((v) => v.url && v.content_type);
  if (variants.length === 0) return null;
  const videos = variants.filter((v) => v.content_type.startsWith("video/"));
  const pool = videos.length > 0 ? videos : variants;
  const best = [...pool].sort((a, b) => (b.bit_rate ?? 0) - (a.bit_rate ?? 0))[0]!;
  return best.url;
}

function renderMediaLines(media: V2Media[]): string[] {
  const lines: string[] = [];
  for (const m of media) {
    const alt = m.alt_text ? escapeMarkdownAlt(m.alt_text) : "";
    if (m.type === "photo") {
      if (m.url) lines.push(`![${alt}](${m.url})`);
    } else {
      if (m.preview_image_url) {
        lines.push(`![${alt || "video poster"}](${m.preview_image_url})`);
      }
      const url = selectVideoUrl(m);
      if (url) lines.push(`[${m.type}](${url})`);
    }
  }
  return lines;
}

function renderQuotedBlock(quoted: NonNullable<FetchedTweet["quoted"]>): string[] {
  const author = `${quoted.author.name} (@${quoted.author.username})`;
  const url = tweetUrl(quoted.author.username, quoted.tweet.id);
  const lines: string[] = [];
  lines.push(`Author: ${escapeMarkdownInline(author)}`);
  lines.push(`URL: ${url}`);
  lines.push("");
  if (quoted.tweet.text) {
    lines.push(...escapeMarkdownInline(quoted.tweet.text).split(/\r?\n/));
  } else {
    lines.push("(no content)");
  }
  return lines.map((line) => `> ${line}`.trimEnd());
}

function renderTweetBody(t: FetchedTweet, index: number): string[] {
  const lines: string[] = [];
  lines.push(`## ${index}`);
  lines.push(tweetUrl(t.author.username, t.tweet.id));
  lines.push("");

  const body: string[] = [];
  if (t.tweet.text) {
    body.push(...escapeMarkdownInline(t.tweet.text).split(/\r?\n/));
  }

  if (t.quoted) {
    if (body.length > 0) body.push("");
    body.push(...renderQuotedBlock(t.quoted));
  }

  const mediaLines = renderMediaLines(t.media);
  if (mediaLines.length > 0) {
    if (body.length > 0) body.push("");
    body.push(...mediaLines);
  }

  if (body.length === 0) body.push("_No text or media._");

  lines.push(...body);
  return lines;
}

function frontmatter(root: FetchedTweet, count: number): string[] {
  const cover = root.media.find((m) => m.type === "photo")?.url
    ?? root.media[0]?.preview_image_url
    ?? "";
  const lines = [
    "---",
    `url: ${yamlString(tweetUrl(root.author.username, root.tweet.id))}`,
    `author: ${yamlString(root.author.username)}`,
    `authorName: ${yamlString(root.author.name)}`,
    `tweetCount: ${count}`,
  ];
  if (root.tweet.created_at) lines.push(`createdAt: ${yamlString(root.tweet.created_at)}`);
  if (cover) lines.push(`coverImage: ${yamlString(cover)}`);
  lines.push("---");
  return lines;
}

export function renderMarkdown(tweets: FetchedTweet[]): string {
  if (tweets.length === 0) return "";
  const root = tweets[0]!;
  const lines: string[] = [];
  lines.push(...frontmatter(root, tweets.length));
  lines.push("");
  lines.push(`# Thread by ${formatHandleWithName(root.author)}`);
  lines.push(`Source: ${tweetUrl(root.author.username, root.tweet.id)}`);
  lines.push(`Tweets: ${tweets.length}`);
  lines.push("");

  tweets.forEach((t, i) => {
    if (i > 0) lines.push("");
    lines.push(...renderTweetBody(t, i + 1));
  });

  return lines.join("\n").trimEnd() + "\n";
}

export function renderArticleMarkdown(root: FetchedTweet, article: V2Article): string {
  const lines: string[] = [
    "---",
    `type: "article"`,
    `url: ${yamlString(tweetUrl(root.author.username, root.tweet.id))}`,
    `author: ${yamlString(root.author.username)}`,
    `authorName: ${yamlString(root.author.name)}`,
  ];
  if (article.title) lines.push(`title: ${yamlString(article.title)}`);
  if (root.tweet.created_at) lines.push(`createdAt: ${yamlString(root.tweet.created_at)}`);
  if (article.cover_media) lines.push(`coverMediaKey: ${yamlString(article.cover_media)}`);
  lines.push("---");
  lines.push("");
  if (article.title) {
    lines.push(`# ${escapeMarkdownInline(article.title)}`);
    lines.push("");
  }
  lines.push(`By ${formatHandleWithName(root.author)} — [source](${tweetUrl(root.author.username, root.tweet.id)})`);
  lines.push("");

  if (article.preview_text && article.preview_text !== article.plain_text) {
    lines.push(`> ${escapeMarkdownInline(article.preview_text)}`);
    lines.push("");
  }

  if (article.plain_text) {
    lines.push(...escapeMarkdownInline(article.plain_text).split(/\r?\n/));
    lines.push("");
  }

  const codeBlocks = article.entities?.code ?? [];
  if (codeBlocks.length > 0) {
    lines.push("## Code blocks");
    lines.push("");
    codeBlocks.forEach((cb, i) => {
      const lang = cb.language ?? "";
      lines.push(`### ${i + 1}${lang ? ` (${lang})` : ""}`);
      lines.push("");
      const longestRun = (cb.code.match(/`+/g) ?? []).reduce((m, s) => Math.max(m, s.length), 2);
      const fence = "`".repeat(longestRun + 1);
      lines.push(fence + lang);
      lines.push(...cb.code.split(/\r?\n/));
      lines.push(fence);
      lines.push("");
    });
  }

  const tweets = article.entities?.tweets ?? [];
  const urls = article.entities?.urls ?? [];
  if (tweets.length > 0 || urls.length > 0) {
    lines.push("## References");
    lines.push("");
    for (const t of tweets) {
      lines.push(`- Embedded tweet: https://x.com/i/web/status/${t.id}`);
    }
    for (const u of urls) {
      lines.push(`- ${u.text}`);
    }
    lines.push("");
  }

  const mediaKeys = article.media_entities ?? [];
  if (mediaKeys.length > 0 || article.cover_media) {
    lines.push("## Media");
    lines.push("");
    if (article.cover_media) lines.push(`- cover: \`${article.cover_media}\``);
    for (const k of mediaKeys) lines.push(`- \`${k}\``);
    lines.push("");
    lines.push("_Note: X API v2 returns media keys for articles but does not expand them to URLs. Open the source tweet to view media._");
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
