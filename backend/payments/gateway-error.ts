import type { PurchaseOrder } from "../../shared/purchase.ts";

const failures = {
  GATEWAY_CONFIGURATION: [503, false, "Payment collection is unavailable. Contact support."],
  GATEWAY_UNAVAILABLE: [
    503,
    true,
    "The payment service is unavailable. Resume your saved order shortly.",
  ],
  GATEWAY_RESPONSE: [
    502,
    true,
    "Payment instructions could not be verified. Resume your saved order or contact support.",
  ],
  QR_EXTRACTION: [
    502,
    true,
    "Payment instructions could not be read. Resume your saved order or contact support.",
  ],
  UPI_PARAMETERS: [
    502,
    false,
    "Payment instructions could not be verified. Contact support with your order reference.",
  ],
  AMOUNT_FORMAT: [
    502,
    false,
    "The payment amount could not be verified. Contact support with your order reference.",
  ],
  CURRENCY_MISMATCH: [
    502,
    false,
    "The payment currency could not be verified. Contact support with your order reference.",
  ],
  AMOUNT_MISMATCH: [
    502,
    false,
    "The payment amount does not match your saved order. Contact support with your order reference.",
  ],
  ACCOUNT_MISMATCH: [
    502,
    false,
    "The receiving account could not be verified. Contact support with your order reference.",
  ],
  TOTAL_UNSUPPORTED: [
    400,
    false,
    "UPI checkout requires a total between INR 510 and INR 10,00,000.",
  ],
  SETUP_PENDING: [409, true, "Payment setup is in progress. Resume your saved order shortly."],
  CREATION_UNKNOWN: [
    409,
    true,
    "Payment setup is being checked. Resume your saved order later; avoid creating another payment.",
  ],
  SETUP_EXPIRED: [
    409,
    false,
    "This payment setup needs review. Contact support with your order reference before paying.",
  ],
  SETUP_STORAGE: [503, true, "Payment setup could not be saved. Resume your saved order shortly."],
} as const;

export type GatewayErrorCode = keyof typeof failures;
export class GatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  orderId?: string;
  order?: PurchaseOrder;
  retryAfter?: number;
  safeToRetryCreation = false;
  readonly details: {
    expectedAmount?: number;
    amount?: number;
    currency?: string;
    accountHash?: string;
  };

  constructor(code: GatewayErrorCode, details: GatewayError["details"] = {}) {
    super(failures[code][2]);
    this.name = "GatewayError";
    this.code = code;
    this.status = failures[code][0];
    this.retryable = failures[code][1];
    this.details = details;
  }
}
