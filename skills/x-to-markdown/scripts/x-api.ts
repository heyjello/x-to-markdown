import process from "node:process";
import type { V2Response, V2Tweet, V2User, V2Media, FetchedTweet } from "./types.js";

const API_BASE = "https://api.x.com/2";

const TWEET_FIELDS = [
  "id",
  "text",
  "author_id",
  "conversation_id",
  "created_at",
  "attachments",
  "referenced_tweets",
  "article",
].join(",");

const USER_FIELDS = ["id", "name", "username"].join(",");

const MEDIA_FIELDS = [
  "media_key",
  "type",
  "url",
  "preview_image_url",
  "alt_text",
  "variants",
].join(",");

const EXPANSIONS = [
  "author_id",
  "attachments.media_keys",
  "referenced_tweets.id",
  "referenced_tweets.id.author_id",
].join(",");

function getBearer(): string {
  const token = process.env.X_BEARER_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "X_BEARER_TOKEN env var is not set. Get one at https://console.x.com — pay-per-request pricing, no subscription."
    );
  }
  return token;
}

async function call<T = V2Response>(pathAndQuery: string): Promise<T> {
  const url = `${API_BASE}${pathAndQuery}`;
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${getBearer()}` },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const snippet = body.slice(0, 400);
    throw new Error(`X API ${response.status} ${response.statusText} for ${pathAndQuery}\n${snippet}`);
  }

  const json = (await response.json()) as T;
  const errors = (json as V2Response).errors;
  if (errors?.length) {
    const summary = errors.map((e) => `${e.title}: ${e.detail ?? ""}`).join("; ");
    throw new Error(`X API returned errors: ${summary}`);
  }
  return json;
}

function indexUsers(users: V2User[] | undefined): Map<string, V2User> {
  const map = new Map<string, V2User>();
  for (const u of users ?? []) map.set(u.id, u);
  return map;
}

function indexMedia(media: V2Media[] | undefined): Map<string, V2Media> {
  const map = new Map<string, V2Media>();
  for (const m of media ?? []) map.set(m.media_key, m);
  return map;
}

function resolveMedia(tweet: V2Tweet, mediaIndex: Map<string, V2Media>): V2Media[] {
  const keys = tweet.attachments?.media_keys ?? [];
  return keys.map((k) => mediaIndex.get(k)).filter((m): m is V2Media => Boolean(m));
}

export async function fetchTweet(
  tweetId: string,
  knownUsername?: string
): Promise<FetchedTweet> {
  const params = new URLSearchParams({
    "tweet.fields": TWEET_FIELDS,
    "media.fields": MEDIA_FIELDS,
    expansions: knownUsername
      ? "attachments.media_keys,referenced_tweets.id"
      : EXPANSIONS,
  });
  if (!knownUsername) params.set("user.fields", USER_FIELDS);

  const json = await call<V2Response>(`/tweets/${tweetId}?${params}`);
  const tweet = json.data as V2Tweet;
  const users = indexUsers(json.includes?.users);
  const mediaIdx = indexMedia(json.includes?.media);

  const author: V2User | undefined = knownUsername
    ? { id: tweet.author_id, name: knownUsername, username: knownUsername }
    : users.get(tweet.author_id);
  if (!author) throw new Error(`Author user not returned in includes for tweet ${tweetId}`);

  const quotedRef = tweet.referenced_tweets?.find((r) => r.type === "quoted");
  const quotedTweet = quotedRef ? json.includes?.tweets?.find((t) => t.id === quotedRef.id) : undefined;
  let quoted: FetchedTweet["quoted"];
  if (quotedTweet) {
    const quotedAuthor = users.get(quotedTweet.author_id);
    if (quotedAuthor) {
      quoted = {
        tweet: quotedTweet,
        author: quotedAuthor,
        media: resolveMedia(quotedTweet, mediaIdx),
      };
    }
  }

  return { tweet, author, media: resolveMedia(tweet, mediaIdx), quoted };
}

export async function fetchThread(rootTweetId: string, authorUsername: string): Promise<FetchedTweet[]> {
  const root = await fetchTweet(rootTweetId);
  const conversationId = root.tweet.conversation_id ?? rootTweetId;

  const query = `conversation_id:${conversationId} from:${authorUsername} to:${authorUsername}`;
  const params = new URLSearchParams({
    query,
    max_results: "100",
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
    expansions: EXPANSIONS,
  });

  const json = await call<V2Response>(`/tweets/search/recent?${params}`);
  const replies: V2Tweet[] = Array.isArray(json.data) ? json.data : [];
  const users = indexUsers(json.includes?.users);
  const mediaIdx = indexMedia(json.includes?.media);

  const replyTweets: FetchedTweet[] = replies.flatMap((t) => {
    if (t.id === rootTweetId) return [];
    const author = users.get(t.author_id);
    if (!author) return [];
    return [{ tweet: t, author, media: resolveMedia(t, mediaIdx) }];
  });

  replyTweets.sort((a, b) => {
    const ta = a.tweet.created_at ? Date.parse(a.tweet.created_at) : 0;
    const tb = b.tweet.created_at ? Date.parse(b.tweet.created_at) : 0;
    return ta - tb;
  });

  return [root, ...replyTweets];
}
