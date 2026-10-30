import "server-only";
import { cookies } from "next/headers";
import { localDemoEnabled } from "./mode";
import { localSession, LOCAL_SESSION_COOKIE } from "../local/auth";
import { admitted } from "../auth/session";
import { AuthError } from "../auth/http";
import type { PurchaseUser } from "../../shared/purchase";
export async function purchaseUser(required = true): Promise<PurchaseUser | null> {
  if (localDemoEnabled()) {
    const user = await localSession((await cookies()).get(LOCAL_SESSION_COOKIE)?.value);
    if (!user && required)
      throw new AuthError(401, "Please sign in to continue.", "SIGN_IN_REQUIRED");
    return user;
  }
  try {
    const c = await admitted();
    return {
      id: c.user.id,
      name: c.profile.full_name,
      email: c.user.email ?? "",
      role: c.profile.role,
    };
  } catch (error) {
    if (!required && error instanceof AuthError && error.status === 401) return null;
    throw error;
  }
}
