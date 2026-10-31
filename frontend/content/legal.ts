export const legalPages = {
  terms: {
    title: "Terms of use",
    intro: "The proposed terms for learning with Market Method.",
    sections: [
      {
        title: "Preview status",
        body: "This website is a development preview. The brand, course outlines and prices are provisional. Enrolment and payments are not available. The business identity, support contact and final contractual terms must be confirmed before sales begin.",
      },
      {
        title: "Educational purpose",
        body: "Course content is intended for education. It is not personalised investment advice, a trading-call service or a guarantee of financial outcomes. Trading can lead to substantial losses.",
      },
      {
        title: "Accounts and access",
        body: "Verified accounts are available in staging, with at most two admitted devices. You can review and revoke devices from your account. Purchases remain disabled. Future purchased courses are intended to include online access for the period shown at checkout, subject to final terms and lawful availability. Sharing or reselling account access is not permitted.",
      },
      {
        title: "Course content and intellectual property",
        body: "Videos are intended for streaming within the platform, with DRM and a personalised watermark. Downloading, redistributing or publicly sharing protected lessons is not permitted. No technical measure can guarantee prevention of screen recording.",
      },
      {
        title: "Prices, tax and payment",
        body: "Illustrative prices shown in this preview are not offers for sale. Final prices, discounts, applicable GST and the full payable amount will be displayed before a future payment. Access will be granted only after server-side payment confirmation.",
      },
      {
        title: "Refunds and support",
        body: "The proposed refund policy is a seven-day window with less than 10% of course content watched. Review the dedicated refund policy for its boundaries. Applicable consumer rights are not excluded by this draft. Business contact, dispute procedure and jurisdiction remain pending owner review.",
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    intro:
      "A clear view of the information this preview uses, and the services planned for launch.",
    sections: [
      {
        title: "Current preview",
        body: "This staging preview supports account registration, email verification, password recovery, profile editing and device management. Payments, contact-message submission and mailing-list signup remain unavailable. The risk exercise runs locally; its input is not submitted. Hosting infrastructure may process routine request information such as IP address, browser details and error logs.",
      },
      {
        title: "Cookies and local preferences",
        body: "The theme switch stores your choice in local storage. Necessary HttpOnly cookies maintain authentication, remember-me, OAuth and short-lived password recovery. Remember-me can persist for up to 30 days; without it, authentication cookies last for the browser session and server admission expires after 12 hours. Sign out or clear site data to remove local credentials; use Sign out all devices to revoke other sessions. This preview has no advertising pixels or third-party marketing analytics.",
      },
      {
        title: "Account and future purchase information",
        body: "Accounts process your name, email, optional phone, authentication details, device labels, session timestamps and security audit events. Enrolled learning records include resume positions, completion checkmarks and bounded unique watched ranges. Rate limiting uses keyed hashes of request identifiers. Email-action verifiers are encrypted and links expire after 30 minutes. Payments remain unavailable; future card or UPI credentials will be handled by the payment provider.",
      },
      {
        title: "Service providers",
        body: "Staging accounts use Supabase for database and authentication, Resend for account messages when the sender is authorised, and VdoCipher for protected lessons. Google sign-in uses the configured identity provider. Cashfree payments remain a future integration; Vercel is the planned host. Final processor arrangements, retention periods, international transfers and lawful processing grounds require owner review before public release.",
      },
      {
        title: "Video protection",
        body: "When an authenticated learner starts a lesson, their account email is sent to VdoCipher to display a moving personalised watermark. Guests viewing published previews receive a public-preview watermark. VdoCipher also processes the browser and playback information needed for protected streaming. Progress is recorded separately in this application's database. DRM reduces copying but cannot guarantee prevention of screen recording.",
      },
      {
        title: "Your choices and requests",
        body: "Final account correction, deletion, retention and grievance procedures must be confirmed with the business owner. The privacy contact has not yet been supplied. Do not provide sensitive or personal information through unofficial channels. Material changes to processing should be reflected in this policy before release.",
      },
    ],
  },
  "refund-policy": {
    title: "Refund policy",
    intro: "A seven-day window, with a clear limit on course consumption.",
    sections: [
      {
        title: "No purchases in this preview",
        body: "New enrolment and payment are disabled in this staging preview. An existing confirmed paid order, if present, may have a request reviewed, but actual money cannot be returned through this preview until the payment provider is connected. The policy below describes planned launch rules and requires business approval before sales begin.",
      },
      {
        title: "Eligibility",
        body: "A refund request must be made before seven full days have elapsed from confirmed payment, and less than 10% of the purchased course must have been watched. Exactly 10% watched is outside the limit. Exactly seven days after payment is outside the proposed window. Account screens will display relevant times in IST.",
      },
      {
        title: "How viewing is measured",
        body: "Consumption is based on watched duration divided by the purchased course’s total duration. A completion checkbox is not the measure. Repeated viewing of the same content should not count twice, and public previews are excluded from paid-course consumption. The final player and measurement process will be verified before launch.",
      },
      {
        title: "Request and review",
        body: "Eligible students will request a refund from their order history and provide a reason. Support staff or the administrator will review it and communicate approval or rejection. Exceptional goodwill refunds may be made by the administrator with a recorded explanation.",
      },
      {
        title: "Processing and access",
        body: "Approved refunds will be submitted through Cashfree. An accepted API request does not mean the money has reached the original payment method; provider-confirmed status will be shown. Access to the refunded purchase will be revoked, and private-community eligibility will be reassessed. Other valid course purchases are not cancelled by one refund.",
      },
      {
        title: "Timing and applicable rights",
        body: "Refund settlement time depends on the payment provider and payment method; no guaranteed settlement time is stated in this preview. Final support details and policy terms will be published before enrolment. This draft does not remove rights available under applicable consumer law.",
      },
    ],
  },
  disclaimer: {
    title: "Trading disclaimer",
    intro: "Education helps you understand a subject. It cannot remove market risk.",
    sections: [
      {
        title: "Education, not personalised advice",
        body: "Content on this website and its proposed courses is for educational purposes. It is not a recommendation to buy, sell or hold any security or financial instrument, nor a substitute for advice from a qualified professional familiar with your circumstances.",
      },
      {
        title: "Trading involves risk",
        body: "Market prices can move unpredictably. Trading, particularly leveraged and derivative products, can result in substantial losses. A planned risk budget or a stop order does not guarantee that losses will be limited to that amount.",
      },
      {
        title: "No promised results",
        body: "There is no assurance that a strategy, example or course will produce profit. Past performance, hypothetical calculations and examples do not predict future outcomes. The illustrative risk calculator demonstrates arithmetic, not a position recommendation.",
      },
      {
        title: "Examples and preview material",
        body: "Some preview catalogue material, prices and conceptual imagery are illustrative. Published course records and genuine owner-approved content are identified separately. Neither kind of material is evidence of real trades, student results or guaranteed returns. No invented testimonials or credentials are presented.",
      },
      {
        title: "Registration and business review",
        body: "The instructor’s identity and regulatory registration status have not been supplied. Nothing in this preview should be read as SEBI approval or a claim of registration. The business owner must verify relevant current rules and disclosures before publishing or selling regulated content. A disclaimer alone does not establish compliance.",
      },
    ],
  },
} as const;
export type LegalSlug = keyof typeof legalPages;
