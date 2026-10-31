import { createHash, randomBytes, randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { localDatabase } from "./database.ts";
import type { PurchaseUser } from "../../shared/purchase.ts";
export const LOCAL_SESSION_COOKIE = "mm_local_session";
const digest = (raw: string) => createHash("sha256").update(raw).digest("hex");
export async function localSession(token: string | undefined): Promise<PurchaseUser | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const db = await localDatabase();
  return (
    (
      await db.query<PurchaseUser>(
        "select p.id,p.full_name as name,u.email,p.role from local_auth.sessions s join profiles p on p.id=s.user_id join auth.users u on u.id=p.id where token_hash=$1 and expires_at>now()and not p.blocked",
        [digest(token)],
      )
    ).rows[0] ?? null
  );
}
export async function localRateLimit(key: string) {
  const db = await localDatabase();
  const r = await db.query<{ attempts: number }>(
    "insert into local_auth.limits values($1,1,now()+interval '15 minutes')on conflict(key)do update set attempts=case when local_auth.limits.expires_at<now()then 1 else local_auth.limits.attempts+1 end,expires_at=case when local_auth.limits.expires_at<now()then now()+interval '15 minutes'else local_auth.limits.expires_at end returning attempts",
    [digest(key)],
  );
  if (r.rows[0].attempts > 10)
    throw Object.assign(new Error("Too many attempts. Please wait before trying again."), {
      status: 429,
    });
}
export async function localSignIn(email: string, password: string) {
  const db = await localDatabase();
  const row = (
    await db.query<{ id: string; password_hash: string }>(
      "select id,password_hash from local_auth.credentials where email=$1",
      [email],
    )
  ).rows[0];
  // Compare even for unknown addresses to avoid an immediate timing distinction.
  const valid = await compare(
    password,
    row?.password_hash ?? "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5RbbA6IFo2BR0Wv.KFNAGC2Q5qRfK3G",
  );
  if (!row || !valid)
    throw Object.assign(new Error("Email or password is incorrect."), { status: 401 });
  const token = randomBytes(32).toString("hex");
  await db.query("insert into local_auth.sessions values($1,$2,now()+interval '7 days')", [
    digest(token),
    row.id,
  ]);
  return token;
}
export async function localSignUp(name: string, email: string, password: string) {
  const db = await localDatabase();
  const id = randomUUID();
  const passwordHash = await hash(password, 12);
  await db.transaction(async (tx) => {
    await tx.query(
      "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)values($1,$2,now(),$3)",
      [id, email, JSON.stringify({ full_name: name })],
    );
    await tx.query("insert into local_auth.credentials values($1,$2,$3)", [
      id,
      email,
      passwordHash,
    ]);
  });
  return localSignIn(email, password);
}
export async function localSignOut(token: string | undefined) {
  if (token)
    await (
      await localDatabase()
    ).query("delete from local_auth.sessions where token_hash=$1", [digest(token)]);
}
