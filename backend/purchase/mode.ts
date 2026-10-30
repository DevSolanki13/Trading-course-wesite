import type { Environment } from "../config/environment.ts";
/** Local sample data never replaces a configured production database implicitly. */
export function localDemoEnabled(env: Environment = process.env) {
  if (env.LOCAL_DEMO === "false") return false;
  if (
    env.NODE_ENV === "production" &&
    env.PAYMENT_PROVIDER === "razorpay" &&
    env.RAZORPAY_KEY_ID &&
    env.RAZORPAY_KEY_SECRET
  )
    return false;
  if (env.NODE_ENV === "production")
    return env.LOCAL_DEMO === "true" && env.ALLOW_MOCK_PAYMENTS === "true";
  if (env.LOCAL_DEMO === "true") return true;
  return !env.NEXT_PUBLIC_SUPABASE_URL && !env.DATABASE_URL;
}
