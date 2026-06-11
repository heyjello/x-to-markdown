export type V2ArticleCodeBlock = {
  language?: string;
  code: string;
};

export type V2Article = {
  title?: string;
  plain_text?: string;
  preview_text?: string;
  cover_media?: string;
  media_entities?: string[];
  entities?: {
    code?: V2ArticleCodeBlock[];
    mentions?: Array<{ start: number; end: number; username: string }>;
    tweets?: Array<{ id: string }>;
    urls?: Array<{ text: string }>;
  };
};

export type V2Tweet = {
  id: string;
  text: string;
  author_id: string;
  conversation_id?: string;
  created_at?: string;
  attachments?: { media_keys?: string[] };
  referenced_tweets?: Array<{ type: "replied_to" | "quoted" | "retweeted"; id: string }>;
  article?: V2Article;
};

export type V2User = {
  id: string;
  name: string;
  username: string;
};

export type V2Media = {
  media_key: string;
  type: "photo" | "video" | "animated_gif";
  url?: string;
  preview_image_url?: string;
  alt_text?: string;
  variants?: Array<{ content_type: string; url: string; bit_rate?: number }>;
};

export type V2Response = {
  data: V2Tweet | V2Tweet[];
  includes?: {
    users?: V2User[];
    media?: V2Media[];
    tweets?: V2Tweet[];
  };
  errors?: Array<{ title: string; detail?: string; type?: string }>;
};

export type FetchedTweet = {
  tweet: V2Tweet;
  author: V2User;
  media: V2Media[];
  quoted?: { tweet: V2Tweet; author: V2User; media: V2Media[] };
};
