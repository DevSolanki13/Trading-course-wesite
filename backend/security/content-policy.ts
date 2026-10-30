/** Request-specific script trust. Inline styles support React/Radix positioning. */
export function contentSecurityPolicy(nonce: string, development = false, sandboxPayments = false) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""} https://player.vdocipher.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src 'self'${sandboxPayments ? " https://sandbox.cashfree.com https://sdk.cashfree.com" : ""}${development ? " ws: wss:" : ""}`,
    `frame-src https://player.vdocipher.com${sandboxPayments ? " https://sandbox.cashfree.com" : ""}`,
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self'${sandboxPayments ? " https://sandbox.cashfree.com" : ""}`,
    "frame-ancestors 'none'",
  ].join("; ");
}
