import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { SummaryRow, StructuredInsight } from "./types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: "#1a1d21",
    lineHeight: 1.55,
  },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#7a7f87",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#0f1115",
    marginBottom: 6,
    lineHeight: 1.2,
  },
  meta: { fontSize: 9.5, color: "#7a7f87", marginBottom: 24 },
  section: { marginBottom: 18 },
  sectionLabel: {
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#7a7f87",
    marginBottom: 6,
  },
  sectionText: { fontSize: 11, color: "#1a1d21" },
  bigQuote: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.3,
    backgroundColor: "#0f1115",
    color: "#fafaf6",
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  bullet: { flexDirection: "row", marginBottom: 5 },
  dot: { width: 10, color: "#7a7f87" },
  bulletText: { flex: 1, fontSize: 10.5 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    fontSize: 8,
    color: "#9aa0a8",
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1pt solid #ececec",
    paddingTop: 10,
  },
});

const SECTIONS: Array<{ key: keyof StructuredInsight; label: string; type: "text" | "list" }> = [
  { key: "executive_summary", label: "Executive summary", type: "text" },
  { key: "most_valuable_insight", label: "Most valuable insight", type: "text" },
  { key: "key_ideas", label: "Key ideas", type: "list" },
  { key: "strategic_lessons", label: "Strategic lessons", type: "list" },
  { key: "business_opportunities", label: "Business opportunities", type: "list" },
  { key: "behavioral_shifts", label: "Behavioral shifts", type: "list" },
  { key: "applicable_to_my_life", label: "Applicable to my life", type: "list" },
  { key: "tactical_advice", label: "Tactical advice", type: "list" },
  { key: "action_steps", label: "Action steps", type: "list" },
  { key: "execution_frameworks", label: "Execution frameworks", type: "list" },
  { key: "mental_models", label: "Mental models", type: "list" },
  { key: "key_quotes", label: "Key quotes", type: "list" },
];

export function InsightPdf({ summary }: { summary: SummaryRow }) {
  const i = summary.insight;
  return (
    <Document
      title={summary.title}
      author={summary.author || "Cognitive OS"}
      creator="Cognitive OS"
      subject="Structured insight"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Cognitive OS · Intelligence Brief</Text>
        <Text style={styles.title}>{summary.title}</Text>
        <Text style={styles.meta}>
          {summary.author || "Unknown"} · {new Date(summary.created_at).toDateString()}
          {summary.topics?.length ? `  ·  ${summary.topics.join(" · ")}` : ""}
        </Text>

        {i.one_insight_that_changes_everything ? (
          <Text style={styles.bigQuote}>{i.one_insight_that_changes_everything}</Text>
        ) : null}

        {SECTIONS.map((s) => {
          const value = i[s.key];
          if (s.type === "text" && typeof value === "string" && value.trim()) {
            return (
              <View key={s.key} style={styles.section}>
                <Text style={styles.sectionLabel}>{s.label}</Text>
                <Text style={styles.sectionText}>{value}</Text>
              </View>
            );
          }
          if (s.type === "list" && Array.isArray(value) && value.length) {
            return (
              <View key={s.key} style={styles.section}>
                <Text style={styles.sectionLabel}>{s.label}</Text>
                {(value as string[]).map((item, idx) => (
                  <View key={idx} style={styles.bullet}>
                    <Text style={styles.dot}>•</Text>
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            );
          }
          return null;
        })}

        <View style={styles.footer} fixed>
          <Text>Cognitive OS</Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
