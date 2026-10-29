import { receiveCashfreeWebhook } from "@/backend/handlers/cashfree-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = receiveCashfreeWebhook;
