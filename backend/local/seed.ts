import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import type { PGlite } from "@electric-sql/pglite";
export async function seedLocal(db: PGlite) {
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO_USERS !== "true") return;
  // TEST ACCOUNTS ONLY. Remove/disable demo seeds before production. Passwords
  // are bcrypt hashes; this seed never touches a configured Supabase project.
  for (const [email, name, role] of [
    ["demo@example.com", "Demo learner", "student"],
    ["admin@example.com", "Demo administrator", "admin"],
  ]) {
    if (
      (await db.query("select id from local_auth.credentials where email=$1", [email])).rows.length
    )
      continue;
    const id = randomUUID();
    const digest = await hash("1234567890", 12);
    await db.transaction(async (tx) => {
      await tx.query(
        "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)values($1,$2,now(),$3)",
        [id, email, JSON.stringify({ full_name: name })],
      );
      await tx.query("update profiles set role=$2 where id=$1", [id, role]);
      await tx.query("insert into local_auth.credentials values($1,$2,$3)", [id, email, digest]);
    });
  }
  for (const [slug, title, price, level] of [
    ["market-foundations", "Market Foundations", 149900, "beginner"],
    ["price-action", "Price Action & Structure", 299900, "intermediate"],
    ["risk-psychology", "Risk & Trading Psychology", 199900, "beginner"],
  ] as const) {
    if ((await db.query("select id from courses where slug=$1", [slug])).rows.length) continue;
    await db.transaction(async (tx) => {
      const course = (
        await tx.query<{ id: string }>(
          "insert into courses(slug,title,description,price_paise,status,level,audience,prerequisites)values($1,$2,$3,$4,'published',$5,'Local demo learners','No real course purchase required for this test catalogue')returning id",
          [
            slug,
            title,
            "Sample trading course for testing the purchase and learning flow. Videos are public placeholders, not paid instructor content.",
            price,
            level,
          ],
        )
      ).rows[0].id;
      for (let moduleIndex = 0; moduleIndex < 2; moduleIndex++) {
        const m = (
          await tx.query<{ id: string }>(
            "insert into modules(course_id,title,position)values($1,$2,$3)returning id",
            [course, moduleIndex ? "Practice and review" : "Core concepts", moduleIndex],
          )
        ).rows[0].id;
        for (let lesson = 0; lesson < 2; lesson++) {
          const l = (
            await tx.query<{ id: string }>(
              "insert into lessons(module_id,title,position,duration_seconds,is_preview,published)values($1,$2,$3,60,$4,true)returning id",
              [
                m,
                [
                  "A first look at the market",
                  "Understanding the example",
                  "Risk before a decision",
                  "Reviewing your process",
                ][moduleIndex * 2 + lesson],
                lesson,
                moduleIndex === 0 && lesson === 0,
              ],
            )
          ).rows[0].id;
          await tx.query(
            "insert into purchase_lesson_content(lesson_id,content,demo_video_url,is_demo)values($1,$2,$3,true)",
            [
              l,
              "Sample lesson notes. This course and video demonstrate the application workflow only. They are not trading advice or an approved paid curriculum.",
              "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
            ],
          );
        }
      }
    });
  }
}
