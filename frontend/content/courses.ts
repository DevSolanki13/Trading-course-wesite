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
  accessPeriod?: number;
  accessUnit?: "days" | "months";
  lessons: number;
  price: number;
  artwork: string;
  color: string;
  outcomes: string[];
  audience: string;
  prerequisites: string;
  prerequisiteList?: string[];
  created_at?: string;
  updated_at?: string;
  version?: number;
  status?: string;
  modules: {
    title: string;
    lessons: { id?: string; title: string; duration: string; preview?: boolean }[];
  }[];
};

/** Illustrative public catalogue only. Never use these values to create a payment. */
export const courses: Course[] = [
  {
    slug: "basic-to-advance",
    title: "Basic to Advance",
    shortTitle: "From market foundations to complete price action mastery.",
    summary:
      "Understand how markets move, read charts with confidence, and develop a rule-based trading edge in Hindi.",
    level: "Beginner",
    duration: "6h 30m",
    lessons: 8,
    price: 1999,
    artwork: "foundations",
    color: "mint",
    outcomes: [
      "Master stock market foundations and chart reading context",
      "Identify market trends, swing highs/lows, and key support & resistance",
      "Learn high-probability entry & exit price action setups",
      "Develop strict risk management, position sizing, and pre-trade rules",
    ],
    audience:
      "For new and intermediate learners wanting a structured, end-to-end curriculum without confusing jargon.",
    prerequisites:
      "No prior trading experience required. An open mind and dedication to practice.",
    prerequisiteList: [
      "No prior stock market or financial trading experience required — starts from ground zero",
      "A smartphone, tablet, or laptop with internet access to study charts and streaming lessons",
      "Free TradingView account (or your broker's charting terminal) to practice identifying price action",
      "Commitment to follow disciplined risk management, capital protection, and pre-trade rules",
    ],
    modules: [
      {
        title: "Market Foundations & Candlestick Anatomy",
        lessons: [
          { title: "Market Mechanics & Market Participants", duration: "12:00", preview: true },
          { title: "Reading Candlesticks & Price Action Context", duration: "15:00" },
        ],
      },
      {
        title: "Market Structure, Support & Resistance",
        lessons: [
          { title: "Trend Identification & Swing Analysis", duration: "14:00" },
          { title: "Drawing Key Support & Resistance Levels", duration: "16:00" },
        ],
      },
      {
        title: "High-Probability Setups & Breakouts",
        lessons: [
          { title: "True Breakouts vs False Traps", duration: "18:00" },
          { title: "Entry Timing, Stop-Loss & Target Rules", duration: "19:00" },
        ],
      },
      {
        title: "Risk Management & Trading Checklist",
        lessons: [
          { title: "Capital Protection & Position Sizing", duration: "15:00" },
          { title: "Creating Your Daily Pre-Trade Checklist", duration: "14:00" },
        ],
      },
    ],
  },
  {
    slug: "advance-course-with-live-qna",
    title: "Advance course with Live QNA",
    shortTitle: "Institutional order flow, liquidity dynamics, and interactive live mentoring.",
    summary:
      "Deep-dive into smart money concepts, multi-timeframe confluence, and live Q&A trade review sessions in Hindi.",
    level: "Advanced",
    duration: "8h 45m",
    lessons: 8,
    price: 2999,
    artwork: "structure",
    color: "sand",
    outcomes: [
      "Decode institutional order flow and liquidity sweep concepts",
      "Spot supply-demand imbalances and premium/discount valuation",
      "Execute multi-timeframe top-down trading strategies",
      "Interactive Live Q&A sessions to review live trades and clarify doubts",
    ],
    audience:
      "For active traders looking to elevate their edge with institutional strategies and live mentorship.",
    prerequisites:
      "Basic candlestick knowledge and familiarity with support & resistance.",
    prerequisiteList: [
      "Familiarity with basic candlestick anatomy (bullish/bearish bodies, wicks, pinbars)",
      "Understanding of market trends, swing highs/lows, and basic support & resistance levels",
      "Experience executing basic market orders and setting protective stop-loss limits",
      "Readiness to transition from retail indicator noise to institutional order flow & liquidity logic",
    ],
    modules: [
      {
        title: "Institutional Market Dynamics & Liquidity",
        lessons: [
          { title: "Liquidity Sweeps, Stop Hunts & Trapped Traders", duration: "14:00", preview: true },
          { title: "Order Blocks & Fair Value Gaps", duration: "17:00" },
        ],
      },
      {
        title: "Multi-Timeframe Institutional Analysis",
        lessons: [
          { title: "Multi-Timeframe Alignment & Daily Directional Bias", duration: "19:00" },
          { title: "Wyckoff Accumulation & Distribution In Practice", duration: "20:00" },
        ],
      },
      {
        title: "Precision Execution & Trade Management",
        lessons: [
          { title: "Precision Entries at Premium & Discount Zones", duration: "18:00" },
          { title: "Advanced Trailing Stops & Scaling Out", duration: "16:00" },
        ],
      },
      {
        title: "Live Mentorship & Q&A Sessions",
        lessons: [
          { title: "Live Q&A 1: Chart Analysis & Real Market Breakdown", duration: "30:00" },
          { title: "Live Q&A 2: Doubt Clearing & Trader Psychology", duration: "30:00" },
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
