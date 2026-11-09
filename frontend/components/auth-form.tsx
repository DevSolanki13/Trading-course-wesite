"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleNotch, CheckCircle, Eye, EyeSlash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { notifyAuthChange } from "../lib/auth-events";

export type AuthMode = "login" | "signup" | "forgot" | "reset" | "confirm";
type AuthResponse = {
  error?: string;
  redirect?: string;
  message?: string;
  url?: string;
};
export function AuthForm({
  mode,
  admin = false,
  next = "/dashboard?view=explore",
  token = "",
  initialError = "",
  notice = "",
  invitation = false,
  secretKey = "",
}: {
  mode: AuthMode;
  admin?: boolean;
  next?: string;
  token?: string;
  initialError?: string;
  notice?: string;
  invitation?: boolean;
  secretKey?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState(notice);
  const [google, setGoogle] = useState(false);
  const [demoHint, setDemoHint] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  useEffect(() => {
    if (!["login", "signup", "forgot"].includes(mode)) return;
    let live = true;
    fetch("/api/auth/options")
      .then((response) => response.json())
      .then((data) => {
        if (live) setGoogle(data.googleEnabled === true);
        if (live) setDemoHint(data.demoLoginHint === true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [mode]);
  useEffect(() => {
    if (mode === "confirm" && token) window.history.replaceState(null, "", "/auth/confirm");
  }, [mode, token]);
  const titles = {
    login: admin ? "Staff sign-in" : "Welcome back",
    signup: "Create your account",
    forgot: "Forgot your password?",
    reset: invitation ? "Set up your password" : "Choose a new password",
    confirm: "Confirm your email link",
  };
  const descriptions = {
    login: "Sign in to your learning space.",
    signup: "Your first step towards a clearer learning process.",
    forgot: demoHint
      ? "Password recovery is unavailable in the local demo. Use the demo account or create a fresh test account."
      : "We’ll send a secure reset link if the address is eligible.",
    reset: "Use at least 12 characters, with uppercase, lowercase and a number.",
    confirm: "Press Continue to use this link. Links expire after 30 minutes and work once.",
  };
  async function request(endpoint: string, payload: unknown) {
    const response = await fetch(`/api/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data: AuthResponse;
    try {
      data = await response.json();
    } catch {
      throw new Error("Something went wrong. Please try again.");
    }
    if (!response.ok) throw new Error(data.error || "This action could not be completed.");
    return data;
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      let payload: Record<string, unknown>;
      let endpoint: string = mode;
      if (mode === "login")
        payload = {
          email: form.get("email"),
          password: form.get("password"),
          remember: form.get("remember") === "on",
          next,
          admin,
          ...(admin
            ? {
                secretKey:
                  secretKey ||
                  (typeof window !== "undefined"
                    ? sessionStorage.getItem("admin_secret_key") || ""
                    : ""),
              }
            : {}),
        };
      else if (mode === "signup")
        payload = {
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          phone: form.get("phone") || undefined,
          next,
        };
      else if (mode === "forgot") {
        endpoint = "forgot-password";
        payload = { email: form.get("email") };
      } else if (mode === "confirm") payload = { token, remember: form.get("remember") === "on" };
      else {
        endpoint = "password";
        if (form.get("password") !== form.get("confirmation"))
          throw new Error("The passwords do not match.");
        payload = { password: form.get("password") };
      }
      const result = await request(endpoint, payload);
      if (result.redirect) {
        notifyAuthChange();
        window.location.assign(result.redirect);
      } else setMessage(result.message || "Check your inbox to continue.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please try again.");
      toast.error(reason instanceof Error ? reason.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }
  async function googleSignIn() {
    setPending(true);
    setError("");
    try {
      const checkbox = document.querySelector<HTMLInputElement>("#remember");
      const data = await request("google", { next, admin, remember: checkbox?.checked ?? false });
      if (data.url) window.location.assign(data.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Google sign-in could not be started.");
      setPending(false);
    }
  }
  return (
    <div className="auth-card">
      <h2>{titles[mode]}</h2>
      <p className="auth-card-intro">{descriptions[mode]}</p>
      {mode === "login" && demoHint && (
        <aside className="demo-login-hint" aria-label="Demo login">
          <strong>Demo login · local development only</strong>
          <p>{admin ? "admin@example.com" : "demo@example.com"} / 1234567890</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              const email = document.getElementById("email") as HTMLInputElement;
              const password = document.getElementById("password") as HTMLInputElement;
              if (email) email.value = admin ? "admin@example.com" : "demo@example.com";
              if (password) password.value = "1234567890";
            }}
          >
            Fill demo credentials
          </button>
          <button type="button" className="text-link" onClick={() => setDemoHint(false)}>
            Dismiss
          </button>
        </aside>
      )}
      {message && (
        <div className="auth-message" role="status">
          <CheckCircle size={20} />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={submit} aria-busy={pending} className="auth-form">
        {mode === "signup" && (
          <label htmlFor="name">
            Full name
            <input
              id="name"
              name="name"
              autoComplete="name"
              required
              maxLength={80}
              placeholder="Your name"
            />
          </label>
        )}
        {["login", "signup", "forgot"].includes(mode) && (
          <label htmlFor="email">
            Email address
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="you@example.com"
            />
          </label>
        )}
        {["login", "signup", "reset"].includes(mode) && (
          <label htmlFor="password">
            {mode === "reset" ? "New password" : "Password"}
            <div className="auth-password-wrapper">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "login" ? 1 : 12}
                maxLength={demoHint ? 72 : 128}
                placeholder={mode === "login" ? "Your password" : "At least 12 characters"}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeSlash size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>
        )}
        {mode === "reset" && (
          <label htmlFor="confirmation">
            Confirm new password
            <div className="auth-password-wrapper">
              <input
                id="confirmation"
                name="confirmation"
                type={showConfirmation ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowConfirmation((prev) => !prev)}
                aria-label={showConfirmation ? "Hide password" : "Show password"}
                title={showConfirmation ? "Hide password" : "Show password"}
              >
                {showConfirmation ? <EyeSlash size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>
        )}
        {mode === "signup" && (
          <label htmlFor="phone">
            Phone <span className="field-optional">(optional)</span>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={25}
              placeholder="Your phone number"
            />
          </label>
        )}
        {(mode === "signup" || mode === "reset") && (
          <p className="auth-field-help">
            Use uppercase, lowercase and a number. Never reuse a trading-account password.
          </p>
        )}
        {(mode === "login" || mode === "confirm") && (
          <div className="auth-form-options">
            <label className="auth-checkbox" htmlFor="remember">
              <input id="remember" name="remember" type="checkbox" />
              Remember me for 30 days
            </label>
            {mode === "login" && <Link href="/forgot-password">Forgot password?</Link>}
          </div>
        )}
        <button
          className="button button-primary auth-submit"
          disabled={pending || (mode === "confirm" && !token)}
          type="submit"
        >
          {pending ? (
            <>
              <CircleNotch size={18} className="auth-spinner" />
              Please wait…
            </>
          ) : (
            <>
              {mode === "login"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : mode === "reset"
                      ? "Save password"
                      : "Continue securely"}
              <ArrowRight size={18} />
            </>
          )}
        </button>
        {mode === "confirm" && !token && (
          <p className="auth-field-help">Open the original email link, or request a new one.</p>
        )}
      </form>
      {(mode === "login" || mode === "signup") && (
        <>
          <div className="auth-divider">
            <span />
            or continue with
            <span />
          </div>
          <button
            className="button button-secondary auth-google"
            disabled={!google || pending}
            onClick={googleSignIn}
          >
            <span className="google-letter" aria-hidden="true">
              G
            </span>
            Google
          </button>
        </>
      )}
      <div className="auth-card-footer">
        {mode === "login" ? (
          <p>
            New to indianXtrade?{" "}
            <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
          </p>
        ) : (
          <Link href={admin ? "/admin/login" : "/login"}>Back to sign-in</Link>
        )}
      </div>
      <p className="auth-legal">
        Read our <Link href="/privacy">privacy policy</Link> and{" "}
        <Link href="/terms">terms of use</Link>.
      </p>
    </div>
  );
}
