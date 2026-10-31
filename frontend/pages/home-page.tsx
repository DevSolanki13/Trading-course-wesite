import Link from "next/link";
import { CourseCard } from "../components/course-card";
import { RiskExercise } from "../components/risk-exercise";
import { Faq } from "../components/faq";
import { ArrowRight, ArrowUpRight, Play, ShieldCheck } from "../components/icons";
import { Star } from "@phosphor-icons/react/dist/ssr";
import { courses as sampleCourses, type Course } from "../content/courses";
import type { SiteDocument } from "../../shared/admin";
import "../styles/landing.css";

const ticker = ["NIFTY 50", "BANKNIFTY", "BTC/USD", "ETH/USD", "GOLD", "USD/INR"];
const marqueeCards = [
  { type: "chart", label: "NIFTY 50", value: "22,487.65", change: "+2.84%", tone: "up" },
  { type: "line", label: "Portfolio growth", value: "+24.8%", change: "90 days", tone: "up" },
  { type: "dark", label: "The market rewards", value: "process", change: "not prediction" },
  { type: "portfolio", label: "Watchlist", value: "03 assets", change: "live sample" },
  { type: "stat", label: "Students trained", value: "5,000+", change: "and counting" },
  { type: "live", label: "Live sessions", value: "Every week", change: "Join the room" },
  { type: "risk", label: "Risk / reward", value: "1 : 3", change: "defined first" },
  { type: "order", label: "Market depth", value: "Balanced", change: "sample data" },
];

function MiniVisual({ type }: { type: string }) {
  if (type === "chart") return <div className="mini-candles" aria-hidden="true">{[1, 3, 2, 5, 4, 7, 6, 8].map((height, index) => <i key={index} className={index === 2 || index === 5 ? "down" : "up"} style={{ height: `${height * 8 + 12}px` }} />)}</div>;
  if (type === "line") return <svg className="mini-line" viewBox="0 0 220 80" aria-hidden="true"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#16c784" stopOpacity=".35" /><stop offset="1" stopColor="#16c784" stopOpacity="0" /></linearGradient></defs><path d="M0 66 C28 62 28 39 56 48 S92 30 118 42 S151 14 174 26 S194 10 220 4 V80 H0Z" fill="url(#area)" /><path d="M0 66 C28 62 28 39 56 48 S92 30 118 42 S151 14 174 26 S194 10 220 4" fill="none" stroke="#16c784" strokeWidth="2.5" /></svg>;
  if (type === "portfolio") return <div className="watchlist"><span>NIFTY 50 <b>+2.4%</b></span><span>BANKNIFTY <em>-0.8%</em></span><span>BTC / USD <b>+4.1%</b></span></div>;
  if (type === "live") return <div className="live-mark"><span><Play size={15} weight="fill" /></span><small>LIVE</small></div>;
  if (type === "risk") return <div className="risk-ratio"><span>RISK</span><strong>1:3</strong><span>REWARD</span></div>;
  if (type === "order") return <div className="order-book"><span><i style={{ width: "78%" }} />BUY 78%</span><span><i style={{ width: "42%" }} />SELL 42%</span></div>;
  return null;
}

function MarqueeCard({ card, index }: { card: (typeof marqueeCards)[number]; index: number }) {
  return <article className={`marquee-card marquee-${card.type}`} style={{ transform: `translateY(${index % 2 ? 16 : 0}px) rotate(${index % 3 === 0 ? "-1deg" : "1deg"})` }}>
    <div className="marquee-card-top"><span>{card.label}</span><span className={card.tone === "up" ? "positive" : "gold-dot"}>{card.tone === "up" ? "●" : "✦"}</span></div>
    <MiniVisual type={card.type} />
    <strong>{card.value}</strong><small>{card.change}</small>
  </article>;
}

function CardMarquee() {
  return <section className="marquee-wrap" aria-label="Sample market visuals"><div className="sample-label">SAMPLE MARKET DATA · FOR EDUCATION ONLY</div><div className="marquee-mask"><div className="marquee-track">{[...marqueeCards, ...marqueeCards].map((card, index) => <MarqueeCard key={`${card.type}-${index}`} card={card} index={index % marqueeCards.length} />)}</div></div></section>;
}

function StatsGrid() {
  return <section className="about-section container" id="about" aria-labelledby="about-heading"><div className="eyebrow">• ABOUT US</div><div className="about-heading"><h2 id="about-heading">A trading education built for <span>disciplined,</span> consistent traders.</h2><p>Less noise. More context. A structured way to build the habits that last beyond a single setup.</p></div><div className="stats-grid"><article className="stat-large"><div><span className="card-label">THE CURRICULUM</span><h3>120+ Hours of<br /><em>video lessons</em></h3><p>From market foundations to risk and psychology, learn at a pace that respects your process.</p></div><div className="stat-chart" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div></article><article className="stat-practical"><span className="card-label">THE APPROACH</span><h3>100%<br />Practical</h3><blockquote>“The best lesson was learning what <em>not</em> to do.”</blockquote><div className="avatar-row"><i>AK</i><i>RS</i><i>MN</i><span>+2k learners</span></div></article><article className="stat-green"><span className="card-label">THE WORK</span><strong>10k+</strong><h3>Trades analyzed<br />in class.</h3><span className="card-arrow">↗</span></article><article className="stat-dark"><span className="card-label">THE SCOPE</span><strong>15+</strong><h3>Markets covered</h3><p>Stocks · Forex · Crypto · Options</p><div className="dark-wave" aria-hidden="true" /></article></div></section>;
}

export default function HomePage({ courses = sampleCourses, content = null, published = false }: { courses?: Course[]; content?: SiteDocument | null; telegramUrl?: string | null; instagramUrl?: string | null; published?: boolean }) {
  return <main id="main-content" className="landing-page">
    <div className="ticker-strip" aria-label="Sample market ticker"><div className="ticker-track">{[...ticker, ...ticker].map((item, index) => <span key={`${item}-${index}`}><b>{item}</b><em className={index % 3 === 0 ? "down" : "up"}>{index % 3 === 0 ? "−" : "+"}{(index % 3 + 1)}.{index + 2}%</em></span>)}</div></div>
    <section className="hero-modern container" aria-labelledby="landing-title"><div className="hero-glow" aria-hidden="true" /><div className="eyebrow">MARKET METHOD · TRADING EDUCATION</div><h1 id="landing-title">Learn to trade with <em>clarity</em><br />and confidence.</h1><p className="hero-lede">Structured trading courses on price action, risk management and market psychology, taught by working traders.</p><div className="hero-actions"><Link href="/courses" className="button button-primary">Enroll now <ArrowRight size={18} /></Link><Link href={courses[0]?.previewLessonId ? `/learn/${courses[0].slug}?lesson=${courses[0].previewLessonId}` : "/courses"} className="button button-secondary">View syllabus</Link></div><div className="trust-line"><span className="stars" aria-label="5 stars"><Star size={14} weight="fill" /><Star size={14} weight="fill" /><Star size={14} weight="fill" /><Star size={14} weight="fill" /><Star size={14} weight="fill" /></span> Rated 4.9/5 by 2,000+ students</div><CardMarquee /></section>
    <section className="logo-strip container"><span>TRUSTED BY TRADERS FROM</span><div>{["ZERODHA", "UPSTOX", "MOTILAL", "NSE ACADEMY", "BSE", "COIN DCX"].map((logo) => <b key={logo}>{logo}</b>)}</div></section>
    <StatsGrid />
    <section className="landing-section landing-courses container" id="courses"><div className="section-heading"><div><div className="eyebrow">THE LEARNING COLLECTION</div><h2>One clear path.<br /><span>Three ways to begin.</span></h2></div><p>Focused courses for wherever you are in your learning journey. No noise, no shortcuts.</p></div><div className="course-grid">{courses.slice(0, 3).map((course) => <CourseCard key={course.slug} course={course} />)}</div><p className="catalogue-note"><ShieldCheck size={15} /> {published ? "Published course details are shown. Trading involves risk." : "Preview collection. Course details and prices are illustrative."}</p></section>
    <section className="why-section container" id="why"><div className="eyebrow">WHY MARKET METHOD</div><h2>Build a process<br /><span>you can trust.</span></h2><div className="why-grid">{[{ n: "01", t: "Learn in context", d: "Understand the story behind the chart, not just the pattern in front of you." }, { n: "02", t: "Practice with purpose", d: "Work through real examples and exercises designed to sharpen your decisions." }, { n: "03", t: "Respect the risk", d: "Put position sizing, psychology and review at the centre of your process." }].map((item) => <article key={item.n}><b>{item.n}</b><h3>{item.t}</h3><p>{item.d}</p><ArrowUpRight size={18} /></article>)}</div></section>
    <section className="landing-risk-section" aria-labelledby="risk-heading"><div className="container risk-modern"><div><div className="eyebrow">PUT IT INTO PRACTICE</div><h2 id="risk-heading">Risk gets<br /><span>the first word.</span></h2><p>Before asking what a trade could make, understand what a hypothetical risk budget means.</p><Link href="/courses/risk-and-psychology" className="text-link">Explore risk & psychology <ArrowUpRight size={18} /></Link></div><RiskExercise /></div></section>
    <section className="testimonials-modern container"><div className="eyebrow">LEARNER PERSPECTIVES</div><h2>Quiet confidence<br /><span>speaks loudest.</span></h2><div className="testimonial-cards"><blockquote>“The structure helped me stop jumping between strategies and start reviewing my decisions.”<footer>— Aditi K. · Price Action</footer></blockquote><blockquote>“Clear, practical and honest about the risk. Exactly what I was looking for.”<footer>— Rohan S. · Market Foundations</footer></blockquote></div></section>
    <section className="landing-faq container" id="faq"><div><div className="eyebrow">A FEW USEFUL ANSWERS</div><h2>Clarity from<br /><span>the beginning.</span></h2><p>Language, access, refunds and everything you should know before choosing a course.</p><Link href="/contact" className="text-link">Have another question? <ArrowUpRight size={18} /></Link></div><Faq items={content?.faqs?.length ? content.faqs : undefined} /></section>
    <section className="landing-close container"><div className="eyebrow">YOUR LEARNING JOURNEY STARTS HERE</div><h2>Build your knowledge.<br /><span>Then build your process.</span></h2><p>No promised returns. No shortcuts.<br />Just a more considered place to start.</p><Link className="button button-primary" href="/courses">Find your starting point <ArrowUpRight size={19} /></Link></section>
    <p className="risk-disclaimer container">Trading involves risk. Course content is for education only. No outcome is promised or implied.</p>
  </main>;
}
