export type Course = {
  id?: string;
  thumbnailUrl?: string | null;
  provisional?: boolean;
  previewLessonId?: string;
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  level: string;
  duration: string;
  lessons: number;
  price: number;
  artwork: string;
  color: string;
  outcomes: string[];
  audience: string;
  prerequisites: string;
  modules: {
    title: string;
    lessons: { id?: string; title: string; duration: string; preview?: boolean }[];
  }[];
};

/** Illustrative public catalogue only. Never use these values to create a payment. */
export const courses: Course[] = [
  {
    slug: "market-foundations",
    title: "Market Foundations",
    shortTitle: "The fundamentals. Without the noise.",
    summary: "Understand how markets work before you put your capital to work.",
    level: "Beginner",
    duration: "3h 20m",
    lessons: 20,
    price: 1499,
    artwork: "foundations",
    color: "mint",
    outcomes: [
      "Understand market structure and participants",
      "Read a candlestick in its context",
      "Recognise common order types",
      "Build a simple pre-trade checklist",
    ],
    audience:
      "For new learners who want a structured introduction before exploring trading strategies.",
    prerequisites:
      "No prior trading experience. A willingness to learn the basics and consider the risks.",
    modules: [
      {
        title: "A clearer view of the market",
        lessons: [
          { title: "What happens when you place an order?", duration: "12:00", preview: true },
          { title: "Exchanges, participants and liquidity", duration: "14:00" },
          { title: "Different ways to participate", duration: "10:00" },
        ],
      },
      {
        title: "Reading the price",
        lessons: [
          { title: "The anatomy of a candlestick", duration: "11:00" },
          { title: "Timeframes and context", duration: "13:00" },
          { title: "An introduction to market structure", duration: "15:00" },
        ],
      },
      {
        title: "Before your first trade",
        lessons: [
          { title: "Order types and execution", duration: "14:00" },
          { title: "Risk, costs and a trading checklist", duration: "16:00" },
        ],
      },
    ],
  },
  {
    slug: "price-action",
    title: "Price Action & Structure",
    shortTitle: "Read the chart. Understand the context.",
    summary: "Study structure, levels and price behaviour through worked examples.",
    level: "Intermediate",
    duration: "4h 10m",
    lessons: 24,
    price: 2999,
    artwork: "structure",
    color: "sand",
    outcomes: [
      "Distinguish trend from a trading range",
      "Identify levels within their wider context",
      "Study breakouts and failed moves",
      "Document a repeatable analysis process",
    ],
    audience:
      "For learners familiar with basic charts who want to develop a more systematic way of reading price.",
    prerequisites: "Basic candlestick knowledge and familiarity with trading terminology.",
    modules: [
      {
        title: "Context before a setup",
        lessons: [
          { title: "Reading structure across timeframes", duration: "14:00", preview: true },
          { title: "Trends, ranges and transitions", duration: "17:00" },
        ],
      },
      {
        title: "Levels and reactions",
        lessons: [
          { title: "Support and resistance in context", duration: "18:00" },
          { title: "Breakouts and failed moves", duration: "16:00" },
        ],
      },
      {
        title: "A repeatable process",
        lessons: [
          { title: "From observation to a trade hypothesis", duration: "19:00" },
          { title: "Reviewing a worked example", duration: "21:00" },
        ],
      },
    ],
  },
  {
    slug: "risk-and-psychology",
    title: "Risk & Trading Psychology",
    shortTitle: "A better process starts with risk.",
    summary: "Explore position sizing, decision habits and the value of a trading journal.",
    level: "All levels",
    duration: "2h 40m",
    lessons: 16,
    price: 1999,
    artwork: "risk",
    color: "lilac",
    outcomes: [
      "Understand risk per trade and position size",
      "Account for costs and losing sequences",
      "Recognise emotional decision patterns",
      "Create a useful trade-review routine",
    ],
    audience:
      "For learners at any stage who want to place risk and decision quality at the centre of their process.",
    prerequisites: "A basic understanding of what a trade is. No specific strategy is required.",
    modules: [
      {
        title: "Define the downside",
        lessons: [
          { title: "Risk is an input, not an afterthought", duration: "12:00", preview: true },
          { title: "An illustrative position-sizing exercise", duration: "15:00" },
        ],
      },
      {
        title: "The decisions around the trade",
        lessons: [
          { title: "Recognising emotional patterns", duration: "14:00" },
          { title: "Working with losing sequences", duration: "18:00" },
        ],
      },
      {
        title: "Learn from your process",
        lessons: [
          { title: "What belongs in a trading journal?", duration: "13:00" },
          { title: "A practical review routine", duration: "16:00" },
        ],
      },
    ],
  },
];

export function getCourse(slug: string) {
  return courses.find((course) => course.slug === slug);
}
export function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(price);
}
