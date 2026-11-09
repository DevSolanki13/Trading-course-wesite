import "server-only";
import { cookies } from "next/headers";
import { privileged } from "../auth/session";
import { AuthError, failure, json } from "../auth/http";
import { localDemoEnabled } from "../purchase/mode";
import { LOCAL_SESSION_COOKIE, localSession } from "../local/auth";
import { localDatabase } from "../local/database";
import { learnerDatabaseError, learnerParams } from "../admin/learners";

export async function adminLearnersRequest(request: Request) {
  try {
    if (localDemoEnabled()) {
      const user = await localSession((await cookies()).get(LOCAL_SESSION_COOKIE)?.value);
      if (!user) throw new AuthError(401, "Please sign in to continue.", "SIGN_IN_REQUIRED");
      if (user.role !== "admin" && user.role !== "support")
        throw new AuthError(403, "This role cannot access course learners.", "FORBIDDEN");
      const params = learnerParams(new URL(request.url));
      try {
        const result = await (
          await localDatabase()
        ).query<{ result: unknown }>(
          "select public.admin_course_learner_read($1,$2,$3,$4,$5,true) as result",
          [params.p_course, params.p_query, params.p_page, params.p_access, params.p_learner],
        );
        return json(result.rows[0].result);
      } catch (error) {
        learnerDatabaseError(error as { code?: string });
        throw error;
      }
    }
    const context = await privileged(false);
    const result = await context.admin.rpc("admin_course_learner_page", {
      ...learnerParams(new URL(request.url)),
      p_actor: context.user.id,
      p_session: context.sessionId,
    });
    learnerDatabaseError(result.error);
    return json(result.data);
  } catch (error) {
    return failure(error);
  }
}
