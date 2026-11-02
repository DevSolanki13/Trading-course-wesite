import type { z } from "zod";
import { AuthError } from "./http";

/** Keep each endpoint's public validation message and error code unchanged. */
export function validationParser({
  fallback,
  code = "AUTH_ERROR",
  useIssueMessage = true,
}: {
  fallback: string;
  code?: string;
  useIssueMessage?: boolean;
}) {
  return function parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success)
      throw new AuthError(
        400,
        (useIssueMessage ? result.error.issues[0]?.message : undefined) ?? fallback,
        code,
      );
    return result.data;
  };
}
