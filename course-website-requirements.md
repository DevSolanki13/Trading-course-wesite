# Trading Course Website — Requirements

**Version:** 0.1 (draft) · **Date:** 2026-10-27

## 1. Overview

An online course site where an instructor sells trading-strategy and trading-basics courses. Visitors land on a marketing page, sign up or log in, buy a course through **Cashfree**, and watch it **online only, with no downloads**. The site launches with **2–3 courses** and must make it easy to add more. An **admin panel** tracks sales, refunds, users, and content. A **community section** sends learners to the instructor's **Telegram** and **Instagram**.

**Top priority:** best-in-class UI/UX on mobile and desktop.

### Decisions so far
| Topic | Decision |
|---|---|
| Content | Video lessons, plus community links (Telegram, Instagram) |
| Login | Email + password, Google sign-in, forgot-password emails sent through Resend |
| Payments | Cashfree payment gateway |
| Refunds | Within **7 days** of purchase, and only if **less than 10%** of the course was watched |
| GST | Added on top of the course price at checkout (prices shown exclude GST). **Admin can turn GST on/off** in settings |
| Admins | Instructor + **support staff**, with separate roles |
| Language | Website text in **English**; course videos in **Hindi** |
| Launch | Go live **Monday 2 Nov 2026**; work finished by **Sunday 1 Nov 2026** |
| Checkout | User **must log in before paying** |
| Devices | Max **2** active devices per account |
| Telegram | Public channel for everyone + **private group for paid students only** |
| Branding | **Developer decides** logo, colours, and fonts |
| Access | Access for the configured days or calendar months from successful payment; no lifetime access |
| Downloads | Not allowed. Streaming only |

---

## 2. User roles

| Role | Can do |
|---|---|
| **Visitor** | Browse landing page, course pages, free preview lessons, community links |
| **Student** | Everything a visitor can do, plus buy courses, watch purchased courses, track progress, request refunds, manage profile |
| **Admin (instructor)** | Everything, plus manage courses, users, orders, refunds, coupons, site content, settings, and staff accounts |
| **Support staff** | View orders, students, and refund requests; approve/reject refunds; grant access manually. Cannot change prices, courses, settings, or staff accounts |

---

## 3. Public site (no login needed)

### 3.1 Landing page
- Hero: instructor's promise and headline, primary CTA ("Explore courses" / "Start learning")
- Instructor intro: photo, experience, credibility (years trading, students taught)
- Course cards: thumbnail, title, short description, price (with strike-through if discounted), lesson count, total duration, level (Beginner / Intermediate / Advanced)
- "What you'll learn" highlights
- Testimonials and student results (with a disclaimer that results vary)
- **Community section:** Telegram and Instagram buttons with follower counts or a short pitch ("Join 5k+ traders on Telegram")
- FAQ (access, refunds, devices, payment methods)
- Footer: About, Contact, Terms, Privacy, Refund Policy, Disclaimer, social links

### 3.2 Course detail page
- Trailer or preview video
- Full curriculum (modules → lessons, with durations). Locked icon on paid lessons, "Preview" tag on free ones
- Price, "Buy now" button (sticky on mobile)
- Who it's for, prerequisites, what's included
- Instructor bio, reviews and ratings
- Refund policy summary near the buy button

### 3.3 Other pages
- About the instructor
- Contact / support form (or WhatsApp / email link)
- Legal pages: Terms of Service, Privacy Policy, Refund Policy
- **Trading disclaimer** (required for this niche): content is educational only and not investment advice; trading carries risk. The instructor should check whether a SEBI registration or disclaimer wording applies to them.

---

## 4. Authentication

- Sign up with **email + password** (name, email, password, optional phone)
- **Google sign-in** (one tap)
- **Email verification** on sign-up
- **Forgot password:** "Forgot password?" sends a reset link by email through **Resend**. The link expires (e.g. 30 min) and works once
- Change password from profile settings
- Rate limiting on login and reset requests (stops brute force and email spam)
- "Remember me" with secure sessions; log out from all devices
- **Device / session limit: max 2 active devices.** Logging in on a 3rd device asks the user to log out one of the others (listed by device name and last active time)

---

## 5. Purchase and payments (Cashfree)

- Buy-now flow: Course page → **Login / sign-up (required)** → Checkout summary → Cashfree checkout → Success page. After logging in, the user returns straight to the checkout for the same course
- Checkout summary shows: course price, coupon discount, **GST (18%) added on top** when GST is turned on, and the final total
- Cashfree supports UPI, cards, net banking, and wallets
- **Access unlocks only after the payment is verified on the server** through the Cashfree webhook, never from the browser redirect alone
- Handle every state: success, failed, pending, user cancelled. Show a clear screen and next step for each
- Stop double charges: if a user already owns a course, show "Go to course" instead of "Buy"
- **Coupons / discount codes:** % or flat amount, expiry date, usage limit, per-course
- **GST invoice** (with the business GSTIN, base price, GST amount, total) emailed automatically and downloadable from the order history
- **Admin settings → GST:** on/off switch, GST rate, and GSTIN (can be added later)
  - **GST on:** prices show "₹X + GST", checkout adds GST, invoice shows the GSTIN and GST split
  - **GST off:** prices show "₹X", no GST line at checkout, a plain receipt instead of a tax invoice
  - The switch only affects new orders; past orders keep the GST they were charged
- Order confirmation email (through Resend)

---

## 6. Course player (online only)

### 6.1 Protecting content from downloads
- Videos hosted on a **secure streaming platform with DRM** (VdoCipher, Bunny Stream with DRM, Mux, or similar), never as plain MP4 links
- **Dynamic watermark** on the video showing the student's email or phone (deters screen recording and leaks)
- Signed, short-lived video URLs, tied to the logged-in user
- Right-click and download disabled in the player
- Note: no website can fully block screen recording or a phone pointed at the screen. DRM plus a watermark is the industry standard and stops most piracy.

### 6.2 Player experience
- Left sidebar (drawer on mobile): modules and lessons, with ✓ on completed lessons
- Resume where you left off, for each lesson and each course
- Speed control (0.5×–2×), quality selection, keyboard shortcuts, picture-in-picture off (optional)
- Auto-play next lesson, with "Mark as complete"
- Lesson notes / attachments shown in the browser only (no file download)
- Progress bar per course ("42% complete")
- Optional: completion certificate (as a viewable page, not a file)
- Optional: comments or Q&A under each lesson

---

## 7. Student dashboard

- **My courses:** progress, "Continue watching" button
- **Browse courses:** courses not yet bought
- **Orders:** history, invoices, payment status
- **Refund request:** button shown only while eligible (within 7 days and under 10% watched), with a reason field and status (Requested → Approved/Rejected → Refunded). When not eligible, show why ("Refund window ended on 3 Nov" / "More than 10% of the course watched")
- **Profile:** name, email, phone, password change, active devices (max 2, with "log out" on each)
- **Community:** public Telegram channel and Instagram for everyone; the **private Telegram group** invite appears only for students who own at least one course

---

## 8. Refunds

- Refund window: **7 days** from purchase
- Watch rule: refund only if **less than 10%** of the course has been watched (measured as watched minutes ÷ total course minutes)
- The student sees how much they've watched and how many days are left on the refund request screen
- Refunded students are removed from the private Telegram group (manual step for the admin, or automated through a Telegram bot in a later phase)
- Flow: student requests → admin reviews → approve sends the refund through the **Cashfree Refunds API** → student gets an email → course access is **revoked automatically**
- Admin can also start a refund manually (outside the window, as goodwill)
- Every refund is logged with who approved it and when

---

## 9. Admin panel

### 9.1 Dashboard
- Revenue today / this week / this month / all time
- Number of sales, new sign-ups, refunds, refund rate
- Revenue chart over time, sales broken down by course
- Recent orders and pending refund requests

### 9.2 Orders and payments
- List of every order: student, course, amount, coupon, status (Paid / Failed / Pending / Refunded), Cashfree order ID, date
- Search and filter by date, course, status, student
- Order detail view, plus resend invoice
- **Export to CSV / Excel** (for accounting and GST)
- Match against Cashfree records to catch payments that went through but didn't unlock a course

### 9.3 Refunds
- Queue of refund requests with reason, % watched, and days since purchase
- Approve / reject with a note; approval triggers the Cashfree refund
- Refund history

### 9.4 Students
- List, search, and view a student's profile, purchases, progress, and devices
- Manually grant or revoke access to a course (e.g. for offline payments or giveaways)
- Block or unblock a user, log them out of all devices

### 9.5 Courses and content
- Create / edit / unpublish a course: title, slug, description, thumbnail, trailer, price, sale price, level
- Add modules and lessons, drag to reorder, upload video to the streaming host, mark lessons as free preview
- Draft vs published state
- Built so adding course #4, #5, and beyond needs no code changes

### 9.6 Marketing and site content
- Coupons: create, set limits, see usage
- Edit landing page sections, testimonials, FAQs, and the Telegram / Instagram links without a developer
- Optional: email announcement to all students or to buyers of one course

### 9.7 Settings
- GST on/off, rate, GSTIN (see 5)
- Refund window (7 days) and watch limit (10%), editable
- Device limit (2), editable
- Telegram (public channel + private group) and Instagram links

### 9.8 Staff and security
- Instructor creates and removes **support staff** accounts
- Two roles: **Admin** and **Support** (see section 2)
- Separate admin login, two-factor authentication
- Activity log (who approved which refund, who granted access, who changed what, when)

---

## 10. UI/UX requirements (top priority)

- **Mobile-first.** Most Indian buyers will come from phones. Every flow (buy, watch, refund) must be easy one-handed
- Clean, premium look; **the developer designs the logo, colours, and fonts**. Dark mode by default (with a light mode), chart-inspired details
- Website text in English. Course cards and pages show a **"Hindi" language tag** so buyers know the videos are in Hindi
- Fast: landing page loads in under 2 seconds on 4G; Lighthouse performance score of 90 or more
- Clear empty, loading, and error states (skeleton loaders, never blank screens)
- Few clicks: landing → bought → watching in under 1 minute
- Smooth, subtle animations that respect the "reduced motion" setting
- Accessible: good colour contrast, keyboard navigation, readable font sizes (WCAG 2.1 AA)
- Trust signals near payment: secure-checkout badge, refund policy, payment method logos
- Same design language across the public site, student dashboard, and admin panel

---

## 11. Emails (sent through Resend)

| Trigger | Email |
|---|---|
| Sign-up | Welcome + verify email |
| Forgot password | Reset link |
| Purchase | Order confirmation + invoice + "Start learning" link |
| Payment failed | Retry link |
| Refund requested / approved / rejected | Status update |
| Optional | "You haven't finished your course" reminder |

---

## 12. Non-functional requirements

- **Security:** HTTPS everywhere, hashed passwords, Cashfree webhook signature checks, no secret keys in the frontend, protection against common web attacks (OWASP Top 10)
- **Reliability:** automatic daily database backups; uptime monitoring
- **Scalability:** handle a launch spike (e.g. hundreds of buyers at once after a Telegram post)
- **SEO:** page titles and descriptions, share previews for Telegram / Instagram / WhatsApp, sitemap
- **Analytics:** page views and the drop-off from course page → checkout → paid (e.g. Google Analytics or PostHog, and the Meta Pixel if running Instagram ads)
- **Legal / compliance:** Terms, Privacy, Refund Policy, trading disclaimer, GST invoicing; cookie notice if using tracking

---

## 13. Suggested tech stack (for discussion)

| Part | Option |
|---|---|
| Frontend + backend | Next.js (React) |
| Database | PostgreSQL (e.g. Supabase or Neon) |
| Auth | Auth.js / Supabase Auth / Clerk (email + Google) |
| Email | Resend |
| Payments | Cashfree Payment Gateway + Refunds API + webhooks |
| Video | VdoCipher (strong DRM + watermark, popular in India) or Bunny Stream |
| Hosting | Vercel |

---

## 14. Phases

> **Timeline risk:** the deadline is Sunday 1 Nov 2026, about 5 days from 27 Oct. That is very tight for everything in this doc. Two things are outside the developer's control and should be **started today**:
> - **Cashfree account activation (KYC)** can take several days. Until it's approved, only test payments work.
> - **Video upload and processing** on the DRM host takes time; the instructor's videos must be ready and uploaded early.

**Phase 1 — launch (by Sunday 1 Nov):**
- Landing page, course pages, legal pages + trading disclaimer
- Email + password and Google login, forgot password through Resend, 2-device limit
- 2–3 courses, Cashfree purchase (login required), GST on/off
- Secure DRM player with watermark, resume, and progress
- Student dashboard: my courses, orders, refund request, community links (private Telegram for buyers)
- Admin: dashboard, orders + CSV export, refund queue (with Cashfree refund), students, course builder, settings, Admin/Support roles
- Emails: welcome/verify, reset, order confirmation, refund status

**Phase 2 — first weeks after launch:** coupons, GST invoices as PDFs viewable in the browser, activity log, 2FA for admins, testimonials/FAQ editor, analytics and Meta Pixel.

**Phase 3:** certificates, lesson Q&A / comments, reviews and ratings, email announcements, reminder emails, Telegram bot to auto-remove refunded students.

**Phase 4:** bundles (buy all courses at a discount), live classes, mobile app, affiliate / referral program.

---

## 15. Open questions

**Still open:**
1. **Video hours per course:** not known yet. Plan for a host that charges by usage (VdoCipher or Bunny Stream) so cost grows with content; confirm once videos are ready.
2. **GSTIN:** client will provide later. GST can stay off until then.
3. **Budget:** not given.

**Answered (2026-10-27):** 7-day refunds only if under 10% watched · GST added on top, with an on/off switch · public Telegram channel + private group for paid students · developer decides branding · login required before paying · max 2 devices · support staff use the admin panel · English site, Hindi videos · launch Monday 2 Nov 2026.
