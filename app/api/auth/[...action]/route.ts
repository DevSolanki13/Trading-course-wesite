import { authRequest } from "@/backend/handlers/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = authRequest;
export const POST = authRequest;
export const PATCH = authRequest;
export const DELETE = authRequest;
