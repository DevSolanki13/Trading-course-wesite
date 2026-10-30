import "server-only";
import { redirect } from "next/navigation";
import { purchaseUser } from "./session";
import { AuthError } from "../auth/http";
export async function requirePurchaseUser(path: string) {
  try {
    return (await purchaseUser())!;
  } catch (error) {
    if (error instanceof AuthError && error.status === 401)
      redirect(`/login?redirect=${encodeURIComponent(path)}`);
    if (error instanceof AuthError && error.code === "DEVICE_LIMIT")
      redirect(`/auth/devices?next=${encodeURIComponent(path)}`);
    throw error;
  }
}
