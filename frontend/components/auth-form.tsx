"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleNotch, CheckCircle } from "@phosphor-icons/react";

export type AuthMode = "login" | "signup" | "forgot" | "reset" | "confirm";
export function AuthForm({
  mode,
  admin = false,
  next = "/account",
  token = "",
  initialError = "",
  notice = "",
  invitation = false,
}: {
  mode: AuthMode;
  admin?: boolean;
  next?: string;
  token?: string;
  initialError?: string;
  notice?: string;
  invitation?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState(notice);
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    if (mode !== "login" && mode !== "signup") return;
    let live = true;
    fetch("/api/auth/options")
      .then((response) => response.json())
      .then((data) => {
        if (live) setGoogle(data.googleEnabled === true);
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
    forgot: "We’ll send a secure reset link if the address is eligible.",
    reset: "Use at least 12 characters, with uppercase, lowercase and a number.",
    confirm: "Press Continue to use this link. Links expire after 30 minutes and work once.",
  };
  async function request(endpoint: string, payload: unknown) {
    const response = await fetch(`/api/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
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
      if (result.redirect) window.location.assign(result.redirect);
      else setMessage(result.message || "Check your inbox to continue.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please try again.");
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
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "login" ? 1 : 12}
              maxLength={128}
              placeholder={mode === "login" ? "Your password" : "At least 12 characters"}
            />
          </label>
        )}
        {mode === "reset" && (
          <label htmlFor="confirmation">
            Confirm new password
            <input
              id="confirmation"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
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
          {!google && (
            <p className="auth-field-help auth-google-note">
              Google sign-in is not configured yet. You can use email and password.
            </p>
          )}
        </>
      )}
      <div className="auth-card-footer">
        {mode === "login" ? (
          <p>
            New to Market Method?{" "}
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
