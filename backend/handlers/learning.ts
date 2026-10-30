import "server-only";
import { z } from "zod";
import { AuthError, body, failure, json, limit, sameOrigin } from "../auth/http";
import { learningAccount, library, loadCourse, lessonAccess } from "../learning/data";
import { playbackCredentials } from "../learning/video";
import { admitted } from "../auth/session";
import type { LearningAccount } from "../learning/data";
import { localDemoEnabled } from "../purchase/mode";
import { purchaseUser } from "../purchase/session";
import { purchaseCourse } from "../purchase/repository";

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AuthError(400, "Check the learning request fields.");
  return result.data;
}
async function optionalAccount(): Promise<LearningAccount | null> {
  try {
    return await learningAccount();
  } catch (e) {
    if (e instanceof AuthError && e.status === 401) return null;
    throw e;
  }
}
function rpcError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "42501")
    throw new AuthError(403, "Your access to this lesson has ended.", "COURSE_LOCKED");
  if (error.code === "22023")
    throw new AuthError(
      409,
      "This player session expired or another player was opened. Reload this lesson.",
      "PLAYBACK_REPLACED",
    );
  throw new AuthError(503, "Learning progress could not be saved.");
}
export async function learningRequest(request: Request) {
  if (localDemoEnabled()) {
    if (request.method === "GET" && new URL(request.url).pathname === "/api/learning/course") {
      const user = await purchaseUser(false);
      return json({
        course: await purchaseCourse(
          new URL(request.url).searchParams.get("slug") ?? "",
          user?.id ?? null,
        ),
      });
    }
    return json({ error: "Use the local demo classroom routes." }, 404);
  }
  try {
    const url = new URL(request.url);
    const action = url.pathname.replace(/^\/api\/learning\//, "");
    if (request.method === "GET") {
      if (action === "library") return json(await library(await learningAccount()));
      if (action === "course")
        return json({
          course: await loadCourse(
            parse(z.string().regex(/^[a-z0-9-]{1,120}$/), url.searchParams.get("slug")),
            await optionalAccount(),
          ),
        });
      if (action === "lesson") {
        const id = parse(z.string().uuid(), url.searchParams.get("id"));
        const { admin } = await lessonAccess(id, await optionalAccount());
        const [asset, resources] = await Promise.all([
          admin.from("lesson_assets").select("notes").eq("lesson_id", id).maybeSingle(),
          admin
            .from("lesson_resources")
            .select("id,title,content")
            .eq("lesson_id", id)
            .order("position"),
        ]);
        if (asset.error || resources.error)
          throw new AuthError(503, "Lesson notes are temporarily unavailable.");
        return json({ notes: asset.data?.notes ?? "", resources: resources.data });
      }
    }
    if (request.method !== "POST") return json({ error: "Not found" }, 404);
    sameOrigin(request);
    if (action === "playback") {
      const input = parse(z.object({ lessonId: z.string().uuid() }).strict(), await body(request));
      const account = await optionalAccount();
      const { lesson, admin } = await lessonAccess(input.lessonId, account);
      await limit(request, "video-token", account?.context.user.id ?? "", 30, 900);
      if (!lesson.duration_seconds)
        throw new AuthError(503, "The lesson is awaiting video duration verification.");
      const { data: asset, error } = await admin
        .from("lesson_assets")
        .select("provider_video_id")
        .eq("lesson_id", lesson.id)
        .maybeSingle();
      if (error || !asset?.provider_video_id)
        throw new AuthError(503, "This video is being prepared.", "VIDEO_UNAVAILABLE");
      let state = { leaseId: null as string | null, position: 0, sequence: 0 };
      if (account) {
        const { data, error } = await admin.rpc("learning_start", {
          p_user: account.context.user.id,
          p_session: account.context.sessionId,
          p_lesson: lesson.id,
        });
        rpcError(error);
        state = data;
      }
      // Learner email watermark explicitly approved; never log it or provider credentials.
      const tokens = await playbackCredentials(
        asset.provider_video_id,
        account?.context.user.email ?? "Market Method | Public preview",
      );
      // Provider calls can take seconds: recheck access and the current lease before disclosure.
      if (account) {
        const [permission, lease] = await Promise.all([
          admin.rpc("learning_can_access", {
            p_user: account.context.user.id,
            p_session: account.context.sessionId,
            p_lesson: lesson.id,
          }),
          admin
            .from("learning_playbacks")
            .select("id")
            .eq("user_id", account.context.user.id)
            .eq("id", state.leaseId!)
            .gt("expires_at", new Date().toISOString())
            .maybeSingle(),
        ]);
        if (permission.error || lease.error)
          throw new AuthError(503, "Playback protection is temporarily unavailable.");
        if (!permission.data)
          throw new AuthError(403, "Your access to this lesson has ended.", "COURSE_LOCKED");
        if (!lease.data)
          throw new AuthError(
            409,
            "Another player was opened. Reload this lesson.",
            "PLAYBACK_REPLACED",
          );
      } else {
        await lessonAccess(lesson.id, null);
      }
      return json({ ...tokens, ...state, preview: lesson.is_preview });
    }
    const context = await admitted();
    if (action === "heartbeat") {
      const input = parse(
        z
          .object({
            leaseId: z.string().uuid(),
            sequence: z.number().int().min(1),
            position: z.number().min(0).max(86400),
            playing: z.boolean(),
            seeking: z.boolean(),
            rate: z.number().min(0.5).max(2),
          })
          .strict(),
        await body(request),
      );
      await limit(request, "learning-heartbeat", context.user.id, 240, 60);
      const { data, error } = await context.admin.rpc("learning_heartbeat", {
        p_user: context.user.id,
        p_session: context.sessionId,
        p_lease: input.leaseId,
        p_sequence: input.sequence,
        p_position: Math.round(input.position * 1000),
        p_playing: input.playing,
        p_seeking: input.seeking,
        p_rate: input.rate,
      });
      rpcError(error);
      return json(data);
    }
    if (action === "complete") {
      const input = parse(
        z.object({ lessonId: z.string().uuid(), completed: z.boolean() }).strict(),
        await body(request),
      );
      await limit(request, "learning-complete", context.user.id, 90, 60);
      const { error } = await context.admin.rpc("learning_complete", {
        p_user: context.user.id,
        p_session: context.sessionId,
        p_lesson: input.lessonId,
        p_completed: input.completed,
      });
      rpcError(error);
      return json({ completed: input.completed });
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return failure(error);
  }
}
