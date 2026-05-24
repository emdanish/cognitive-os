export const XP = {
  summary: 50,
  reflection: 25,
  swipe_right: 5,
  swipe_super: 15,
  saved: 10,
};

export function levelFromXp(xp: number): { level: number; label: string; toNext: number; progress: number } {
  const tiers = [
    { min: 0, label: "Initiate" },
    { min: 200, label: "Operator" },
    { min: 600, label: "Builder" },
    { min: 1500, label: "Strategist" },
    { min: 3500, label: "Compounder" },
    { min: 7500, label: "Polymath" },
    { min: 15000, label: "Architect" },
    { min: 30000, label: "Sage" },
  ];
  let level = 1;
  let label = tiers[0].label;
  let nextMin = tiers[1].min;
  let prevMin = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (xp >= tiers[i].min) {
      level = i + 1;
      label = tiers[i].label;
      prevMin = tiers[i].min;
      nextMin = tiers[i + 1]?.min ?? tiers[i].min * 2;
    }
  }
  const span = Math.max(1, nextMin - prevMin);
  const progress = Math.min(1, Math.max(0, (xp - prevMin) / span));
  return { level, label, toNext: Math.max(0, nextMin - xp), progress };
}
