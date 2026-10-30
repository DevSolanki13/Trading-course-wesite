/** Request-specific script trust. Inline styles support React/Radix positioning. */
export function contentSecurityPolicy(
  nonce: string,
  development = false,
  sandboxPayments = false,
  razorpayPayments = false,
  localDemo = false,
) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""} https://player.vdocipher.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src 'self'${razorpayPayments ? " https://api.razorpay.com https://checkout.razorpay.com https://lumberjack.razorpay.com" : ""}${sandboxPayments ? " https://sandbox.cashfree.com https://sdk.cashfree.com" : ""}${development ? " ws: wss:" : ""}`,
    `frame-src https://player.vdocipher.com${razorpayPayments ? " https://api.razorpay.com https://checkout.razorpay.com" : ""}${sandboxPayments ? " https://sandbox.cashfree.com" : ""}`,
    `media-src 'self' blob:${localDemo ? " https://interactive-examples.mdn.mozilla.net" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self'${sandboxPayments ? " https://sandbox.cashfree.com" : ""}`,
    "frame-ancestors 'none'",
  ].join("; ");
}
