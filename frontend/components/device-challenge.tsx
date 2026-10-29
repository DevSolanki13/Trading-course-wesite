"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockSimple, CircleNotch } from "@phosphor-icons/react";
type Device = { id: string; name: string; lastActive: string; current: boolean };
export function DeviceChallenge({ next = "/account" }: { next?: string }) {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/auth/devices")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 401) router.replace("/login");
          throw new Error(data.error);
        }
        if (active) setDevices(data.devices);
      })
      .catch((reason) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);
  async function admit(replace: string | null) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/admit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace, next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.admitted) window.location.assign(data.redirect);
      else setError("Both device slots are still active. Choose one to sign out.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please try again.");
      setPending(false);
    }
  }
  return (
    <div className="auth-card device-challenge">
      <LockSimple className="auth-hero-icon" size={32} />
      <h1>Your account is already in use.</h1>
      <p className="auth-card-intro">
        Choose an existing device to sign out before using this one. Only device-management
        information is available until you continue.
      </p>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">
          <CircleNotch className="auth-spinner" size={17} />
          Loading active devices…
        </p>
      ) : (
        <div className="device-list">
          {devices.map((device) => (
            <div className="device-row" key={device.id}>
              <div>
                <strong>{device.name}</strong>
                <small>
                  Last active{" "}
                  {new Date(device.lastActive).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  IST
                </small>
              </div>
              <button
                className="button button-secondary"
                disabled={pending}
                onClick={() => admit(device.id)}
              >
                Sign out & continue <ArrowRight size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      {!loading && !devices.length && (
        <button className="button button-primary" disabled={pending} onClick={() => admit(null)}>
          Continue on this device
        </button>
      )}
      <button
        className="text-link"
        onClick={async () => {
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          router.replace("/login");
          router.refresh();
        }}
      >
        Cancel and sign out
      </button>
    </div>
  );
}
