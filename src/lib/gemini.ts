import { GoogleGenerativeAI } from "@google/generative-ai";
import { INSIGHT_PROMPT, SYSTEM_PERSONA } from "./prompts";
import type { StructuredInsight } from "./types";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "YOUR_GEMINI_API_KEY_HERE") {
    throw new Error("GEMINI_API_KEY is not set in env");
  }
  return new GoogleGenerativeAI(key);
}

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function stripCodeFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function extractJsonObject(s: string): string {
  const stripped = stripCodeFences(s);
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) return stripped;
  return stripped.slice(start, end + 1);
}

export async function generateStructuredInsight(
  youtubeUrl: string,
  ctx: { title?: string; author?: string } = {},
): Promise<StructuredInsight> {
  const ai = getClient();
  const model = ai.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_PERSONA,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.45,
      topP: 0.9,
      maxOutputTokens: 6144,
    },
  });

  const result = await model.generateContent([
    {
      fileData: {
        fileUri: youtubeUrl,
        mimeType: "video/mp4",
      },
    },
    {
      text: INSIGHT_PROMPT({ ...ctx, sourceUrl: youtubeUrl }),
    },
  ]);
  const raw = result.response.text();

  let parsed: StructuredInsight;
  try {
    parsed = JSON.parse(raw) as StructuredInsight;
  } catch {
    parsed = JSON.parse(extractJsonObject(raw)) as StructuredInsight;
  }
  return normalizeInsight(parsed);
}

const ALLOWED_TOPICS = new Set([
  "saas",
  "indie-hacking",
  "freelancing",
  "ai-automation",
  "business-psychology",
  "persuasion",
  "communication",
  "productivity",
  "discipline",
  "systems-thinking",
  "strategic-thinking",
  "wealth-building",
  "leverage",
  "execution",
  "habits",
  "marketing",
  "sales",
  "copywriting",
  "pricing",
  "negotiation",
  "mindset",
  "islamic-self-improvement",
  "focus",
  "time-management",
  "learning",
  "writing",
  "content",
  "creator-economy",
  "life-design",
]);

function normalizeInsight(i: Partial<StructuredInsight>): StructuredInsight {
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const cleanedTopics = arr(i.topics)
    .map((t) => t.toLowerCase().trim())
    .filter((t) => ALLOWED_TOPICS.has(t))
    .slice(0, 6);
  return {
    executive_summary: str(i.executive_summary),
    key_ideas: arr(i.key_ideas),
    most_valuable_insight: str(i.most_valuable_insight),
    strategic_lessons: arr(i.strategic_lessons),
    business_opportunities: arr(i.business_opportunities),
    behavioral_shifts: arr(i.behavioral_shifts),
    applicable_to_my_life: arr(i.applicable_to_my_life),
    tactical_advice: arr(i.tactical_advice),
    action_steps: arr(i.action_steps),
    execution_frameworks: arr(i.execution_frameworks),
    key_quotes: arr(i.key_quotes),
    mental_models: arr(i.mental_models),
    one_insight_that_changes_everything: str(i.one_insight_that_changes_everything),
    topics: cleanedTopics,
  };
}
