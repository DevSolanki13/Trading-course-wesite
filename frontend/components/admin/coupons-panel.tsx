"use client";
import { useEffect, useState } from "react";
import { adminApi, operation, formText, formNumber, money, when } from "../../lib/admin-api";
import type { CouponView } from "../../../shared/admin";
export function CouponsPanel() {
  const [items, setItems] = useState<CouponView[]>([]);
  const [editing, setEditing] = useState<CouponView | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function load() {
    const d = await adminApi<{ items: CouponView[] }>("coupons");
    setItems(d.items);
  }
  useEffect(() => {
    adminApi<{ items: CouponView[] }>("coupons")
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError("");
    setMessage("");
    try {
      await operation("coupon", {
        id: editing?.id,
        version: editing?.version,
        code: formText(f, "code"),
        kind: formText(f, "kind"),
        value:
          formText(f, "kind") === "percent"
            ? Math.round(formNumber(f, "value") * 100)
            : Math.round(formNumber(f, "value") * 100),
        courseId: formText(f, "course") || null,
        expiresAt: formText(f, "expiry") ? new Date(formText(f, "expiry")).toISOString() : null,
        totalLimit: formText(f, "limit") ? formNumber(f, "limit") : null,
        perUserLimit: formNumber(f, "perUser"),
        active: f.get("active") === "on",
      });
      await load();
      setEditing(null);
      setMessage("Coupon saved. Codes will apply only when checkout is connected.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Coupon could not save.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <div className="admin-section-head">
        <div>
          <h2>Coupons</h2>
          <p>Prepare discounts and scope. Checkout redemption is deferred with Phase 3.</p>
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
      <div className="admin-two-column">
        <form className="admin-panel admin-form" key={editing?.id ?? "new"} onSubmit={save}>
          <h3>{editing ? "Edit coupon" : "Create coupon"}</h3>
          <label>
            Code
            <input
              name="code"
              required
              minLength={3}
              maxLength={32}
              defaultValue={editing?.code}
              placeholder="LEARN10"
            />
          </label>
          <div className="admin-form-grid">
            <label>
              Discount type
              <select name="kind" defaultValue={editing?.kind ?? "percent"}>
                <option value="percent">Percentage</option>
                <option value="fixed">Fixed INR</option>
              </select>
            </label>
            <label>
              Amount (percent or INR)
              <input
                name="value"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={editing ? editing.value / 100 : 10}
              />
            </label>
            <label>
              Course UUID (optional)
              <input name="course" defaultValue={editing?.course_id ?? ""} />
            </label>
            <label>
              Expires at
              <input
                name="expiry"
                type="datetime-local"
                defaultValue={
                  editing?.expires_at
                    ? new Date(
                        Date.parse(editing.expires_at) -
                          new Date(editing.expires_at).getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
              />
            </label>
            <label>
              Total uses
              <input name="limit" type="number" min="1" defaultValue={editing?.total_limit ?? ""} />
            </label>
            <label>
              Uses per student
              <input
                name="perUser"
                type="number"
                min="1"
                max="1000"
                required
                defaultValue={editing?.per_user_limit ?? 1}
              />
            </label>
          </div>
          <label className="admin-checkbox">
            <input name="active" type="checkbox" defaultChecked={editing?.active ?? true} /> Enabled
            for future checkout
          </label>
          <div className="admin-actions">
            <button className="button button-primary" disabled={pending}>
              Save coupon
            </button>
            {editing && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
        <div className="admin-panel">
          <h3>Existing codes</h3>
          {items.length ? (
            items.map((c) => (
              <div className="admin-list-row" key={c.id}>
                <div>
                  <strong>{c.code}</strong>
                  <span>
                    {c.kind === "fixed" ? money(c.value) : `${(c.value / 100).toFixed(2)}%`} ·{" "}
                    {c.active ? "Enabled" : "Disabled"} ·{" "}
                    {c.coupon_redemptions.filter((r) => r.state === "redeemed").length} redeemed
                  </span>
                  <span>{c.expires_at ? `Expires ${when(c.expires_at)}` : "No expiry"}</span>
                </div>
                <button className="text-link" onClick={() => setEditing(c)}>
                  Edit
                </button>
              </div>
            ))
          ) : (
            <p>No coupons created.</p>
          )}
        </div>
      </div>
    </section>
  );
}
