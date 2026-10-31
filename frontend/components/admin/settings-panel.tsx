"use client";
import { useEffect, useState } from "react";
import { adminApi, operation, formNumber, formText } from "../../lib/admin-api";
import type { SettingsView } from "../../../shared/admin";
export function SettingsPanel() {
  const [data, setData] = useState<SettingsView | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    adminApi<SettingsView>("settings")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError("");
    setMessage("");
    try {
      await operation("settings", {
        version: data.version,
        gst_enabled: f.get("gst") === "on",
        gst_rate_bps: Math.round(formNumber(f, "gstRate") * 100),
        gstin: formText(f, "gstin").toUpperCase(),
        device_limit: formNumber(f, "deviceLimit"),
        refund_window_days: formNumber(f, "refundDays"),
        refund_watch_limit_percent: formNumber(f, "refundWatch"),
        business_name: formText(f, "businessName"),
        business_address: formText(f, "businessAddress"),
        support_email: formText(f, "supportEmail"),
        public_telegram_url: formText(f, "publicTelegram"),
        public_instagram_url: formText(f, "publicInstagram"),
        private_telegram_url: formText(f, "privateTelegram"),
        private_invite_expires_at: formText(f, "inviteExpiry")
          ? new Date(formText(f, "inviteExpiry")).toISOString()
          : null,
      });
      setData(await adminApi<SettingsView>("settings"));
      setMessage(
        "Settings saved and audited. Changes affect new orders; paid-order snapshots stay unchanged.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Settings could not save.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <div className="admin-section-head">
        <div>
          <h2>Business settings</h2>
          <p>Set effective tax, access and refund rules before enabling sales.</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="auth-message">
          {message}
        </p>
      )}
      {!data ? (
        <p role="status">Loading settings…</p>
      ) : (
        <form className="admin-form admin-settings" key={data.version} onSubmit={save}>
          <div className="admin-panel">
            <h3>Tax and billing</h3>
            <p className="admin-help">
              Only new orders will use these values. Confirm your tax treatment and billing identity
              before sales.
            </p>
            <div className="admin-form-grid">
              <label>
                Business name
                <input name="businessName" maxLength={180} defaultValue={data.business_name} />
              </label>
              <label>
                Support email
                <input name="supportEmail" type="email" defaultValue={data.support_email ?? ""} />
              </label>
            </div>
            <label>
              Business billing address
              <textarea
                name="businessAddress"
                rows={3}
                maxLength={1000}
                defaultValue={data.business_address}
              />
            </label>
            <div className="admin-form-grid">
              <label className="admin-checkbox">
                <input type="checkbox" name="gst" defaultChecked={data.gst_enabled} /> Add GST on
                future orders
              </label>
              <label>
                GST rate (%)
                <input
                  type="number"
                  name="gstRate"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={data.gst_rate_bps / 100}
                />
              </label>
              <label>
                GSTIN, if applicable
                <input name="gstin" maxLength={15} defaultValue={data.gstin ?? ""} />
              </label>
            </div>
          </div>
          <div className="admin-panel">
            <h3>Access and refunds</h3>
            <div className="admin-form-grid">
              <label>
                Active device limit
                <input
                  name="deviceLimit"
                  type="number"
                  min="1"
                  max="2"
                  defaultValue={data.device_limit}
                />
              </label>
              <label>
                Refund window (days)
                <input
                  name="refundDays"
                  type="number"
                  min="0"
                  max="365"
                  defaultValue={data.refund_window_days}
                />
              </label>
              <label>
                Watched-content limit (%)
                <input
                  name="refundWatch"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={data.refund_watch_limit_percent}
                />
              </label>
            </div>
            <p className="admin-help">
              Reducing the device limit signs out the oldest excess sessions. Refund rule edits
              affect future purchases only.
            </p>
          </div>
          <div className="admin-panel">
            <h3>Official community links</h3>
            <div className="admin-form-grid">
              <label>
                Public Telegram
                <input
                  name="publicTelegram"
                  type="url"
                  defaultValue={data.public_telegram_url ?? ""}
                />
              </label>
              <label>
                Instagram
                <input
                  name="publicInstagram"
                  type="url"
                  defaultValue={data.public_instagram_url ?? ""}
                />
              </label>
              <label>
                Private Telegram invitation
                <input
                  name="privateTelegram"
                  type="url"
                  defaultValue={data.private_telegram_url ?? ""}
                />
              </label>
              <label>
                Private invitation expiry
                <input
                  name="inviteExpiry"
                  type="datetime-local"
                  defaultValue={
                    data.private_invite_expires_at
                      ? new Date(
                          Date.parse(data.private_invite_expires_at) -
                            new Date(data.private_invite_expires_at).getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>
            </div>
            <p className="admin-help">
              Only qualifying buyers see a current invite. The database expiry does not invalidate
              copied Telegram links.
            </p>
          </div>
          <button className="button button-primary" disabled={pending}>
            Save settings
          </button>
        </form>
      )}
    </section>
  );
}
