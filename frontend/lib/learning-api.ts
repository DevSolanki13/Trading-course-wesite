export class LearningError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export async function learningApi<T>(path: string, payload?: unknown): Promise<T> {
  const response = await fetch(`/api/learning/${path}`, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new LearningError(
      data.error || "This action is temporarily unavailable.",
      response.status,
      data.code,
    );
  return data;
}
export function lessonTime(seconds: number) {
  const n = Math.max(0, Math.round(seconds));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
