/** Synthetic runtime overrides shared by browser and performance verification. */
export function releaseEnvironment(origin: string): Record<string, string> {
  return {
    NEXT_PUBLIC_APP_URL: origin,
    PROJECT_STAGE: "local",
    PAYMENT_MODE: "",
    NEXT_PUBLIC_PAYMENT_MODE: "",
    DEMO_PAYMENT_SECRET: "",
    NEXT_PUBLIC_SUPABASE_URL: "https://release-check.invalid",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "release-check-public-key",
    SUPABASE_SERVICE_ROLE_KEY: "",
    DATABASE_URL: "",
    CASHFREE_CLIENT_ID: "",
    CASHFREE_CLIENT_SECRET: "",
    VDOCIPHER_API_SECRET: "",
    RESEND_API_KEY: "",
    GOOGLE_OAUTH_CONFIGURED: "false",
    OPERATIONS_ENABLED: "false",
    NOTIFICATION_DELIVERY_ENABLED: "false",
    CRON_SECRET: "",
  };
}
