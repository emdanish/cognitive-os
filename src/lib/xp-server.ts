import { getServerSupabase } from "./supabase";
import { todayKey } from "./utils";

interface DailyDelta {
  xp?: number;
  summaries?: number;
  reflections?: number;
  swipes?: number;
}

export async function bumpDailyStats(delta: DailyDelta) {
  try {
    const supabase = getServerSupabase();
    const date = todayKey();
    const { data: existing } = await supabase
      .from("streaks")
      .select("*")
      .eq("date", date)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("streaks")
        .update({
          xp_earned: (existing.xp_earned || 0) + (delta.xp || 0),
          summaries_count: (existing.summaries_count || 0) + (delta.summaries || 0),
          reflections_count: (existing.reflections_count || 0) + (delta.reflections || 0),
          swipes_count: (existing.swipes_count || 0) + (delta.swipes || 0),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("streaks").insert({
        date,
        xp_earned: delta.xp || 0,
        summaries_count: delta.summaries || 0,
        reflections_count: delta.reflections || 0,
        swipes_count: delta.swipes || 0,
      });
    }
  } catch {
    /* never block on stats */
  }
}

export async function bumpTopicWeights(topics: string[], delta: number) {
  if (!topics?.length) return;
  try {
    const supabase = getServerSupabase();
    for (const topic of topics) {
      const t = topic.toLowerCase().trim();
      if (!t) continue;
      const { data: existing } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("topic", t)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("user_preferences")
          .update({
            weight: Math.max(-100, Math.min(1000, (existing.weight || 0) + delta)),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("user_preferences").insert({
          topic: t,
          weight: delta,
        });
      }
    }
  } catch {
    /* ignore */
  }
}
