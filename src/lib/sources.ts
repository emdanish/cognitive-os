export interface CreatorSource {
  name: string;
  channelId: string;
  topics: string[];
}

export interface TopicSearch {
  label: string;
  query: string;
  topics: string[];
}

export const CREATOR_SOURCES: CreatorSource[] = [
  { name: "Alex Hormozi",   channelId: "UCUyDOdBWhC1MCxEjC46d-zw", topics: ["sales", "business-psychology", "wealth-building"] },
  { name: "Ali Abdaal",     channelId: "UCoOae5nYA7VqaXzerajD0lg", topics: ["productivity", "creator-economy", "life-design"] },
  { name: "Greg Isenberg",  channelId: "UCPjNBjflYl0-HQtUZNyDKjg", topics: ["saas", "indie-hacking", "marketing"] },
  { name: "Mark Tilbury",   channelId: "UCxgAuX3XZROujMmGphN_scA", topics: ["wealth-building", "business-psychology"] },
  { name: "James Clear",    channelId: "UCRIZtPl9nb9RiXc9btSTQNw", topics: ["habits", "discipline", "focus"] },
];

export const TOPIC_SEARCHES: TopicSearch[] = [
  { label: "Productivity",         query: "productivity system focus deep work",        topics: ["productivity", "discipline", "focus", "time-management"] },
  { label: "Life lessons",         query: "life lessons wisdom advice",                 topics: ["life-design", "mindset", "learning"] },
  { label: "Money & wealth",       query: "money mindset wealth building",              topics: ["wealth-building", "mindset", "leverage"] },
  { label: "TED talks",            query: "TED talk",                                   topics: ["learning", "mindset", "communication"] },
  { label: "Book summaries",       query: "book summary self improvement",              topics: ["learning", "writing", "mindset"] },
  { label: "Business psychology",  query: "business psychology persuasion negotiation", topics: ["business-psychology", "persuasion", "sales", "negotiation"] },
  { label: "Indie hacking",        query: "indie hacker SaaS startup founder",          topics: ["saas", "indie-hacking", "execution"] },
];

export const MIN_DURATION_SECONDS = 90;
export const MAX_DURATION_SECONDS = 4 * 3600;

// Minimum view count for a video to enter the feed.
// Set to 0 to disable the floor. Lower (e.g. 100_000) if the feed is too sparse.
export const MIN_VIEW_COUNT = 1_000_000;

export interface RawCandidate {
  source_type: "youtube";
  source_url: string;
  source_id: string;
  title: string;
  author: string;
  thumbnail: string;
  description: string;
  published: string | null;
  topics: string[];
  duration_seconds?: number;
  view_count?: number;
  has_captions?: boolean;
}

const FLUFF_PATTERNS = [
  /you won['']t believe/i,
  /this changed my life/i,
  /the (one|1) (secret|trick)/i,
  /millionaire mindset/i,
  /\b\$\d+k? in \d+ days?\b/i,
  /shocking/i,
  /reaction/i,
  /\bi tried\b.{0,30}\bfor \d+ days?\b/i,
  /try not to (laugh|cry)/i,
  /^reacting to/i,
];

export function isLikelyFluff(title: string): boolean {
  return FLUFF_PATTERNS.some((p) => p.test(title));
}
