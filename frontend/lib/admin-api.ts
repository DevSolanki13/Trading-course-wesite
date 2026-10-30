export class AdminError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export async function adminApi<T>(path: string, payload?: unknown): Promise<T> {
  const r = await fetch(`/api/admin/${path}`, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  const d = await r.json();
  if (!r.ok)
    throw new AdminError(d.error ?? "This operation could not be completed.", r.status, d.code);
  return d;
}
export async function operation<T = { id?: string; courseId?: string; message: string }>(
  action: string,
  data: unknown,
) {
  return adminApi<T>("operations", { action, data });
}
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
export const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST"
    : "Not recorded";
export function formText(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
export function formNumber(form: FormData, key: string) {
  return Number(form.get(key));
}
