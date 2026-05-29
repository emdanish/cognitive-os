export interface CreatorSource {
  name: string;
  handle: string;
  topics: string[];
}

export interface TopicSearch {
  label: string;
  query: string;
  topics: string[];
}

export const CREATOR_SOURCES: CreatorSource[] = [
  // 22 Owner-provided creators
  { name: "Alex Hormozi",        handle: "@AlexHormozi",       topics: ["sales", "business-psychology", "wealth-building", "entrepreneurship"] },
  { name: "Mark Tilbury",        handle: "@marktilbury",       topics: ["wealth-building", "business-psychology", "money-making"] },
  { name: "Codie Sanchez",       handle: "@CodieSanchezCT",    topics: ["wealth-building", "entrepreneurship", "business-psychology", "leverage"] },
  { name: "Diary of a CEO",      handle: "@TheDiaryOfACEO",    topics: ["entrepreneurship", "psychology", "mindset", "motivation"] },
  { name: "Iman Gadzhi",         handle: "@ImanGadzhi",        topics: ["entrepreneurship", "wealth-building", "marketing", "mindset"] },
  { name: "Daniel Priestley",    handle: "@DanielPriestley",   topics: ["entrepreneurship", "wealth-building", "strategic-thinking", "leverage"] },
  { name: "Valuetainment",       handle: "@VALUETAINMENT",     topics: ["entrepreneurship", "business-psychology", "wealth-building", "mindset"] },
  { name: "Graham Stephan",      handle: "@GrahamStephan",     topics: ["wealth-building", "money-making", "investing", "habits"] },
  { name: "Nate O'Brien",        handle: "@NateOBrien",        topics: ["wealth-building", "productivity", "habits", "life-design"] },
  { name: "Greg Isenberg",       handle: "@GregIsenberg",      topics: ["saas", "indie-hacking", "marketing", "entrepreneurship", "startup-ideas"] },
  { name: "Ali Abdaal",          handle: "@aliabdaal",         topics: ["productivity", "creator-economy", "life-design", "habits"] },
  { name: "Thomas Frank",        handle: "@Thomasfrank",       topics: ["productivity", "time-management", "focus", "habits"] },
  { name: "Matt D'Avella",       handle: "@mattdavella",       topics: ["productivity", "habits", "life-design", "self-mastery"] },
  { name: "Cal Newport",         handle: "@CalNewportMedia",   topics: ["focus", "productivity", "discipline", "life-design"] },
  { name: "Andrew Huberman",     handle: "@hubermanlab",       topics: ["focus", "habits", "productivity", "self-mastery"] },
  { name: "Chris Williamson",    handle: "@ChrisWillx",        topics: ["mindset", "self-mastery", "psychology", "philosophy"] },
  { name: "Hamza Ahmed",         handle: "@Hamza97",           topics: ["self-mastery", "discipline", "focus", "motivation"] },
  { name: "Tom Bilyeu",          handle: "@TomBilyeu",         topics: ["mindset", "motivation", "entrepreneurship", "self-mastery"] },
  { name: "Jordan Peterson",     handle: "@JordanBPeterson",   topics: ["motivation", "discipline", "psychology", "mindset"] },
  { name: "Mufti Menk",          handle: "@muftimenkofficial", topics: ["islamic-motivation", "life-design", "mindset"] },
  { name: "Yasir Qadhi",         handle: "@YasirQadhi",        topics: ["islamic-motivation", "learning", "mindset"] },
  { name: "Bilal Assad",         handle: "@belal.assaad",      topics: ["islamic-motivation", "self-mastery", "life-design"] },

  // Additional web-researched and verified creators
  { name: "Pieter Levels",       handle: "@levelsio",          topics: ["indie-hacking", "saas", "execution"] },
  { name: "Marc Lou",            handle: "@marc-lou",          topics: ["indie-hacking", "saas", "execution"] },
  { name: "Y Combinator",        handle: "@ycombinator",       topics: ["startup-ideas", "entrepreneurship", "strategic-thinking"] },
  { name: "Garry Tan",           handle: "@GarryTan",          topics: ["startup-ideas", "entrepreneurship", "leverage"] },
  { name: "Lenny Rachitsky",     handle: "@LennysPodcast",     topics: ["saas", "entrepreneurship", "learning"] },
  { name: "Starter Story",       handle: "@StarterStory",      topics: ["entrepreneurship", "money-making", "learning"] },
  { name: "Myron Golden",        handle: "@MyronGolden",       topics: ["sales", "wealth-building", "persuasion"] },
  { name: "The Futur / Chris Do", handle: "@thefutur",         topics: ["sales", "persuasion", "marketing", "business-psychology"] },
  { name: "Russell Brunson",     handle: "@russellbrunson",    topics: ["sales", "marketing", "persuasion"] },
  { name: "Justin Welsh",        handle: "@JustinWelsh",       topics: ["creator-economy", "leverage", "writing"] },
  { name: "Robert Greene",       handle: "@RobertGreeneOfficial", topics: ["dark-psychology", "persuasion", "strategic-thinking", "psychology"] },
  { name: "Charisma on Command",  handle: "@Charismaoncommand", topics: ["persuasion", "psychology", "communication"] },
  { name: "Dan Koe",             handle: "@DanKoeTalks",       topics: ["creator-economy", "mindset", "focus", "writing"] },
  { name: "Andrei Jikh",         handle: "@AndreiJikh",        topics: ["wealth-building", "investing", "money-making"] },
  { name: "Jocko Willink",       handle: "@JockoPodcastOfficial", topics: ["discipline", "execution", "self-mastery", "motivation"] },
  { name: "Lex Fridman",         handle: "@lexfridman",        topics: ["philosophy", "learning", "mindset", "self-mastery"] },
  { name: "Ryan Holiday",        handle: "@DailyStoic",        topics: ["philosophy", "mindset", "self-mastery", "discipline"] },
  { name: "Nouman Ali Khan",     handle: "@bayyinah",          topics: ["islamic-motivation", "learning", "mindset"] },
  { name: "Omar Suleiman",       handle: "@yaqeeninstitute",   topics: ["islamic-motivation", "life-design", "mindset"] },
];

export const TOPIC_SEARCHES: TopicSearch[] = [
  // SaaS & Indie Hacking
  { label: "SaaS Blueprint", query: "SaaS startup MVP build launch founder", topics: ["saas", "indie-hacking", "entrepreneurship"] },
  { label: "Indie Hacking", query: "indie hacker solo developer bootstrap business", topics: ["indie-hacking", "execution", "entrepreneurship"] },
  { label: "Micro-SaaS Ideas", query: "micro-saas business ideas software builder", topics: ["saas", "startup-ideas", "indie-hacking"] },
  
  // Entrepreneurship & Startup Ideas
  { label: "Startup Strategies", query: "startup validation business model customer acquisition", topics: ["entrepreneurship", "strategic-thinking", "execution"] },
  { label: "Side Hustles", query: "side hustle business ideas beginner guide", topics: ["entrepreneurship", "wealth-building", "mindset"] },
  { label: "Founder Lessons", query: "startup founder lessons mistakes advice YCombinator", topics: ["entrepreneurship", "learning", "strategic-thinking"] },
  
  // Wealth & Money
  { label: "Wealth Building", query: "naval ravikant how to get rich wealth leverage", topics: ["wealth-building", "leverage", "mindset"] },
  { label: "Money Psychology", query: "psychology of money financial freedom investing rules", topics: ["wealth-building", "mindset", "business-psychology"] },
  { label: "Business Pricing", query: "alex hormozi business pricing model offers", topics: ["pricing", "sales", "wealth-building"] },
  
  // Productivity & Focus
  { label: "Productivity Systems", query: "productivity systems deep work time management", topics: ["productivity", "focus", "time-management"] },
  { label: "Focus and Flow", query: "how to focus deep work eliminate distractions", topics: ["focus", "productivity", "discipline"] },
  { label: "Daily Habits", query: "atomic habits james clear habit design routine", topics: ["habits", "productivity", "discipline"] },
  
  // Personal Development & Self-Mastery
  { label: "Self-Mastery", query: "self mastery discipline mental toughness", topics: ["self-mastery", "discipline", "mindset"] },
  { label: "Discipline Rules", query: "jocko willink discipline motivation execution", topics: ["discipline", "execution", "self-mastery"] },
  { label: "Huberman Performance", query: "andrew huberman focus dopamine productivity routine", topics: ["focus", "habits", "productivity", "self-mastery"] },
  
  // Psychology & Dark Psychology
  { label: "Dark Psychology", query: "robert greene laws of power dark psychology persuasion", topics: ["dark-psychology", "persuasion", "business-psychology"] },
  { label: "Human Psychology", query: "jordan peterson rules for life psychology advice", topics: ["psychology", "mindset", "learning"] },
  { label: "Negotiation Tactics", query: "negotiation skills persuasion dark psychology", topics: ["negotiation", "persuasion", "communication"] },
  
  // Sales & Marketing
  { label: "Sales Persuasion", query: "how to sell high ticket closing sales pitch", topics: ["sales", "persuasion", "marketing"] },
  { label: "Marketing Flywheels", query: "growth marketing strategy customer flywheel", topics: ["marketing", "creator-economy", "leverage"] },
  { label: "Copywriting Secrets", query: "copywriting tips landing page sales letter writing", topics: ["copywriting", "writing", "marketing"] },
  
  // Creator Economy
  { label: "Creator Economy", query: "creator economy build audience online writing brand", topics: ["creator-economy", "writing", "content"] },
  { label: "Content Leverage", query: "dan koe content creation business model leverage", topics: ["content", "creator-economy", "leverage"] },
  
  // Islamic Motivation
  { label: "Islamic Discipline", query: "islamic motivation discipline focus self improvement", topics: ["islamic-motivation", "discipline", "self-mastery"] },
  { label: "Islamic Wisdom", query: "nouman ali khan life lessons islamic motivation advice", topics: ["islamic-motivation", "life-design", "mindset"] },
  { label: "Islamic Self Mastery", query: "mufti menk motivation spiritual discipline life design", topics: ["islamic-motivation", "self-mastery", "life-design"] },
  
  // Philosophy & Life Design
  { label: "Philosophy of Success", query: "stoic philosophy mental model wisdom success", topics: ["philosophy", "mindset", "systems-thinking"] },
  { label: "Life Design", query: "life design tim ferriss lifestyle design systems", topics: ["life-design", "systems-thinking", "productivity"] },
  
  // Book Summaries & Free Resources
  { label: "Book Summaries", query: "self improvement book summaries key ideas lessons", topics: ["book-summaries", "learning", "mindset"] },
  { label: "Free Tools & Resources", query: "free business tools resources software solo founder", topics: ["free-resources", "saas", "indie-hacking"] },

  // Productivity cluster
  { label: "Deep Work Concentration", query: "deep work concentration flow state focus training", topics: ["focus", "productivity", "discipline"] },
  { label: "Time Blocking", query: "time blocking calendar method scheduling productivity", topics: ["productivity", "time-management", "habits"] },
  { label: "Morning Routines", query: "morning routine high performers atomic habits schedule", topics: ["habits", "productivity", "life-design"] },

  // Money cluster
  { label: "Investing for Beginners", query: "investing for beginners stock market index fund guide", topics: ["wealth-building", "money-making", "learning"] },
  { label: "Financial Freedom", query: "financial freedom retire early fire movement wealth rule", topics: ["wealth-building", "life-design", "mindset"] },
  { label: "Personal Finance Habits", query: "personal finance habits budget system rich rules", topics: ["wealth-building", "habits", "productivity"] },

  // Habits cluster
  { label: "Atomic Habits Keystone", query: "atomic habits keystone habits small change results", topics: ["habits", "productivity", "learning"] },
  { label: "Discipline beats Motivation", query: "discipline beats motivation daily rules consistency", topics: ["discipline", "self-mastery", "execution"] },
  { label: "Consistency Compound", query: "consistency compound effect success system routine", topics: ["execution", "habits", "mindset"] },

  // Business psychology
  { label: "Negotiation Tactics", query: "negotiation tactics persuasion skills masterclass rules", topics: ["persuasion", "business-psychology", "communication"] },
  { label: "Behavioral Economics", query: "behavioral economics decision making psychology bias", topics: ["psychology", "learning", "business-psychology"] },

  // Indie hacking
  { label: "Solopreneur SaaS", query: "solopreneur SaaS one-person software business launch", topics: ["saas", "indie-hacking", "entrepreneurship"] },
  { label: "First 1000 Users", query: "first 1000 users startup marketing growth launch", topics: ["marketing", "execution", "entrepreneurship"] },
  { label: "Validate Startup Idea", query: "validate startup idea business validation framework MVP", topics: ["startup-ideas", "entrepreneurship", "learning"] },

  // Self-improvement
  { label: "Stoicism Modern Life", query: "stoicism modern life stoic mental toughness philosophy", topics: ["philosophy", "mindset", "self-mastery"] },
  { label: "Wisdom Self Mastery", query: "wisdom self mastery discipline mental growth rules", topics: ["self-mastery", "discipline", "mindset"] },
  { label: "Long Term Thinking", query: "long term thinking strategy infinite game mindset", topics: ["strategic-thinking", "mindset", "learning"] },

  // Communication
  { label: "Public Speaking", query: "public speaking confidence communication skills guide", topics: ["communication", "persuasion", "learning"] },
  { label: "Writing Clearly", query: "writing clearly persuasively copy business writing brand", topics: ["writing", "communication", "persuasion"] },
];

// 180s ensures no YouTube Shorts. Do not lower.
export const MIN_DURATION_SECONDS = 180;
export const MAX_DURATION_SECONDS = 4 * 3600;

// 1,000,000 minimum view count. The system will NEVER show videos below this floor. If the feed is sparse, expand the query pool, do not lower this number.
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
