export type SourceType = "youtube" | "article" | "reddit" | "newsletter" | "manual";

export interface StructuredInsight {
  executive_summary: string;
  key_ideas: string[];
  most_valuable_insight: string;
  strategic_lessons: string[];
  business_opportunities: string[];
  behavioral_shifts: string[];
  applicable_to_my_life: string[];
  tactical_advice: string[];
  action_steps: string[];
  execution_frameworks: string[];
  key_quotes: string[];
  mental_models: string[];
  one_insight_that_changes_everything: string;
  topics?: string[];
}

export interface SummaryRow {
  id: string;
  source_type: SourceType;
  source_url: string | null;
  source_id: string | null;
  title: string;
  author: string | null;
  thumbnail: string | null;
  raw_transcript: string | null;
  insight: StructuredInsight;
  tags: string[];
  topics: string[];
  is_saved: boolean;
  reflection: string | null;
  created_at: string;
}

export interface FeedItemRow {
  id: string;
  source_type: SourceType;
  source_url: string;
  source_id: string | null;
  title: string;
  author: string | null;
  thumbnail: string | null;
  description: string | null;
  topics: string[];
  score: number;
  generated_for: string;
  consumed: boolean;
  created_at: string;
}

export interface SwipeRow {
  id: string;
  feed_item_id: string | null;
  source_url: string;
  direction: "left" | "right" | "super";
  topics: string[];
  created_at: string;
}

export interface ReflectionRow {
  id: string;
  summary_id: string;
  prompt: string;
  answer: string;
  created_at: string;
}

export interface SavedInsightRow {
  id: string;
  summary_id: string | null;
  kind: "summary" | "quote" | "framework" | "idea";
  content: string;
  source_title: string | null;
  source_url: string | null;
  created_at: string;
}

export interface StreakRow {
  id: string;
  date: string;
  xp_earned: number;
  summaries_count: number;
  reflections_count: number;
  swipes_count: number;
}

export interface UserPreferenceRow {
  id: string;
  topic: string;
  weight: number;
  updated_at: string;
}
