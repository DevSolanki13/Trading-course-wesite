"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
type Factor = { id: string; name: string };
export function MfaPanel({ onVerified }: { onVerified?: () => void }) {
  const router = useRouter();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch("/api/auth/mfa")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setFactors(data.factors);
        setFactorId(data.factors[0]?.id ?? "");
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoaded(true));
  }, []);
  async function enroll() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/mfa/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setFactorId(data.factorId);
      setSecret(data.secret);
      setQr(
        data.qrCode.startsWith("data:")
          ? data.qrCode
          : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.qrCode)}`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Setup failed.");
    } finally {
      setPending(false);
    }
  }
  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (onVerified) onVerified();
      else {
        router.push("/admin");
        router.refresh();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Verification failed.");
      setPending(false);
    }
  }
  return (
    <section className="account-panel mfa-panel">
      <h2>Authenticator verification</h2>
      <p>Administrator and support actions require a code from your authenticator app.</p>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {!loaded ? (
        <p role="status">Loading authenticator settings…</p>
      ) : !factorId ? (
        <button className="button button-primary" onClick={enroll} disabled={pending}>
          Set up an authenticator
        </button>
      ) : (
        <>
          {qr && (
            <div className="mfa-setup">
              <Image
                unoptimized
                src={qr}
                alt="Scan this QR code with your authenticator app"
                width={200}
                height={200}
              />
              <p>Or enter this setup key in your authenticator. Keep it private.</p>
              <code>{secret}</code>
            </div>
          )}
          <form className="auth-form" onSubmit={verify}>
            {factors.length > 1 && (
              <label htmlFor="factor">
                Authenticator
                <select id="factor" value={factorId} onChange={(e) => setFactorId(e.target.value)}>
                  {factors.map((factor) => (
                    <option value={factor.id} key={factor.id}>
                      {factor.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label htmlFor="mfa-code">
              Six-digit authenticator code
              <input
                id="mfa-code"
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
              />
            </label>
            <button className="button button-primary" disabled={pending || code.length !== 6}>
              Verify authenticator
            </button>
          </form>
        </>
      )}
    </section>
  );
}
