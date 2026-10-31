/** Pure validation, shared by the application and operator scripts. Never return secret values. */
export type Environment = Record<string, string | undefined>;
export type ConfigurationCheck = {
  service: string;
  configured: boolean;
  missing: string[];
  invalid: string[];
};

const required = {
  supabase: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ],
  database: ["DATABASE_URL"],
  cashfree: ["CASHFREE_CLIENT_ID", "CASHFREE_CLIENT_SECRET", "CASHFREE_API_VERSION"],
  video: ["VDOCIPHER_API_SECRET", "VDOCIPHER_TEST_VIDEO_ID"],
  email: ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "PROVIDER_TEST_EMAIL"],
  google: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "GOOGLE_OAUTH_CONFIGURED",
  ],
} as const;

export type Service = keyof typeof required;

export function configuredValue(value: string | undefined): boolean {
  const text = value?.trim();
  return !!text && !/^(your[-_ ]|replace|example|change[-_ ]?me|<)/i.test(text);
}

export function isHttpsUrl(value: string | undefined): boolean {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function checkConfiguration(service: Service, env: Environment): ConfigurationCheck {
  const missing = required[service].filter((key) => !configuredValue(env[key]));
  const invalid: string[] = [];
  if (
    (service === "supabase" || service === "google") &&
    env.NEXT_PUBLIC_SUPABASE_URL &&
    !isHttpsUrl(env.NEXT_PUBLIC_SUPABASE_URL)
  ) {
    invalid.push("NEXT_PUBLIC_SUPABASE_URL must be an HTTPS project URL");
  }
  if (service === "database" && env.DATABASE_URL) {
    try {
      const url = new URL(env.DATABASE_URL);
      if (!["postgres:", "postgresql:"].includes(url.protocol))
        invalid.push("DATABASE_URL must be a PostgreSQL URL");
    } catch {
      invalid.push("DATABASE_URL must be a PostgreSQL URL");
    }
  }
  if (service === "cashfree" && env.CASHFREE_ENV !== "sandbox")
    invalid.push("CASHFREE_ENV must remain sandbox until live acceptance is implemented");
  if (
    service === "cashfree" &&
    env.CASHFREE_API_VERSION &&
    env.CASHFREE_API_VERSION !== "2026-01-01"
  )
    invalid.push("CASHFREE_API_VERSION must be 2026-01-01 for this adapter");
  if (service === "email") {
    for (const key of ["RESEND_FROM_EMAIL", "PROVIDER_TEST_EMAIL"]) {
      if (env[key] && !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(env[key]!))
        invalid.push(`${key} must be a plain email address`);
    }
  }
  if (service === "google" && env.GOOGLE_OAUTH_CONFIGURED !== "true")
    invalid.push("GOOGLE_OAUTH_CONFIGURED must be true after dashboard configuration");
  return { service, configured: !missing.length && !invalid.length, missing, invalid };
}

export function readiness(env: Environment): ConfigurationCheck[] {
  return (Object.keys(required) as Service[]).map((service) => checkConfiguration(service, env));
}
