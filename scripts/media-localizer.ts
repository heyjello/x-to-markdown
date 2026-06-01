import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

export type LocalizeResult = {
  markdown: string;
  downloadedImages: number;
  downloadedVideos: number;
};

const ALLOWED_HOSTS = new Set(["pbs.twimg.com", "video.twimg.com"]);
const MAX_BYTES = 100 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

const MARKDOWN_LINK_RE = /(!?\[[^\]\n]*\])\((https?:\/\/[^)\s>]+)\)/g;
const FRONTMATTER_COVER_RE = /^(coverImage:\s*")(https?:\/\/[^"]+)(")/m;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function isAllowedHost(rawUrl: string): boolean {
  try {
    return ALLOWED_HOSTS.has(new URL(rawUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function kindFromContentType(ct: string): "image" | "video" | null {
  if (ct.startsWith("image/")) return "image";
  if (ct.startsWith("video/")) return "video";
  return null;
}

function extFromUrl(rawUrl: string): string | null {
  try {
    const ext = path.posix.extname(new URL(rawUrl).pathname).replace(/^\./, "").toLowerCase();
    return ext || null;
  } catch {
    return null;
  }
}

function sanitizeStem(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 48);
}

function buildFileName(kind: "image" | "video", index: number, sourceUrl: string, ext: string): string {
  let stem = "";
  try {
    const base = path.posix.basename(new URL(sourceUrl).pathname);
    stem = sanitizeStem(base.replace(new RegExp(`\\.${ext}$`, "i"), ""));
  } catch {
    stem = "";
  }
  const prefix = kind === "image" ? "img" : "video";
  const serial = String(index).padStart(3, "0");
  return stem ? `${prefix}-${serial}-${stem}.${ext}` : `${prefix}-${serial}.${ext}`;
}

async function fetchWithCap(rawUrl: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(rawUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      return null;
    }
    if (!response.ok) return null;

    const lengthHeader = response.headers.get("content-length");
    if (lengthHeader && Number(lengthHeader) > MAX_BYTES) return null;

    const reader = response.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }

    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]!
      .trim()
      .toLowerCase();
    return { bytes: Buffer.concat(chunks), contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function collectCandidates(markdown: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  MARKDOWN_LINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MARKDOWN_LINK_RE.exec(markdown))) {
    const url = match[2];
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }

  const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
  const cover = fmMatch?.[1]?.match(FRONTMATTER_COVER_RE)?.[2];
  if (cover && !seen.has(cover)) {
    seen.add(cover);
    out.push(cover);
  }

  return out;
}

function rewrite(markdown: string, replacements: Map<string, string>): string {
  if (replacements.size === 0) return markdown;
  MARKDOWN_LINK_RE.lastIndex = 0;
  let out = markdown.replace(MARKDOWN_LINK_RE, (full, label, url) => {
    const local = replacements.get(url);
    return local ? `${label}(${local})` : full;
  });
  out = out.replace(FRONTMATTER_COVER_RE, (full, prefix, url, suffix) => {
    const local = replacements.get(url);
    return local ? `${prefix}${local}${suffix}` : full;
  });
  return out;
}

export async function localizeMedia(
  markdown: string,
  markdownPath: string,
  log: (message: string) => void = () => {}
): Promise<LocalizeResult> {
  const dir = path.dirname(markdownPath);
  const candidates = collectCandidates(markdown);
  const replacements = new Map<string, string>();
  let imgs = 0;
  let vids = 0;

  for (const url of candidates) {
    if (!isAllowedHost(url)) {
      log(`[x-to-markdown] Skipping non-allowlisted host: ${url}`);
      continue;
    }

    const fetched = await fetchWithCap(url);
    if (!fetched) {
      log(`[x-to-markdown] Skipped (failed/oversized/redirect): ${url}`);
      continue;
    }

    const kind = kindFromContentType(fetched.contentType);
    if (!kind) {
      log(`[x-to-markdown] Skipped (unknown content-type ${fetched.contentType}): ${url}`);
      continue;
    }

    const ext = MIME_EXT[fetched.contentType] ?? extFromUrl(url) ?? (kind === "video" ? "mp4" : "jpg");
    const next = kind === "image" ? imgs + 1 : vids + 1;
    const subdir = kind === "image" ? "imgs" : "videos";
    const targetDir = path.join(dir, subdir);
    await mkdir(targetDir, { recursive: true, mode: 0o700 });

    const fileName = buildFileName(kind, next, url, ext);
    const absolute = path.join(targetDir, fileName);
    await writeFile(absolute, fetched.bytes, { mode: 0o600 });

    const relative = path.posix.join(subdir, fileName);
    replacements.set(url, relative);

    if (kind === "image") imgs = next;
    else vids = next;
  }

  return {
    markdown: rewrite(markdown, replacements),
    downloadedImages: imgs,
    downloadedVideos: vids,
  };
}
