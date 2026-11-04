import { localDemoEnabled } from "../purchase/mode.ts";
import type {
  Announcement,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from "../../shared/announcements.ts";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "seed-welcome-announcement",
    title: "Welcome to indianXtrade Academy! 🎯",
    content:
      "Welcome to the academy! New live trading breakdown modules and market structure lessons are released every week. Review your enrolled curriculum and complete your foundational risk management video.",
    category: "General",
    priority: "important",
    pinned: true,
    active: true,
    author_name: "Admin",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

async function getJsonStorePath(): Promise<string> {
  const dir = join(process.cwd(), ".local-data");
  await mkdir(dir, { recursive: true });
  return join(dir, "announcements.json");
}

async function readJsonStore(): Promise<Announcement[]> {
  try {
    const file = await getJsonStorePath();
    const data = await readFile(file, "utf8");
    return JSON.parse(data);
  } catch {
    return DEFAULT_ANNOUNCEMENTS;
  }
}

async function writeJsonStore(announcements: Announcement[]) {
  try {
    const file = await getJsonStorePath();
    await writeFile(file, JSON.stringify(announcements, null, 2), "utf8");
  } catch {
    /* ignore fallback errors */
  }
}

export async function listAnnouncements(onlyActive = true): Promise<Announcement[]> {
  if (localDemoEnabled()) {
    try {
      const { localDatabase } = await import("../local/database.ts");
      const db = await localDatabase();

      // Ensure table exists in case migration hasn't reached it
      await db.exec(`
        create table if not exists public.announcements (
          id uuid primary key default gen_random_uuid(),
          title text not null,
          content text not null,
          category text not null default 'General',
          priority text not null default 'normal',
          pinned boolean not null default false,
          active boolean not null default true,
          author_name text not null default 'Admin',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `);

      const res = await db.query<Announcement>(
        `select id, title, content, category, priority, pinned, active, author_name, created_at, updated_at
         from public.announcements
         where ($1::boolean = false or active = true)
         order by pinned desc, created_at desc`,
        [onlyActive],
      );

      if (res.rows.length === 0) {
        // Check JSON fallback
        const fallback = await readJsonStore();
        return onlyActive ? fallback.filter((a) => a.active) : fallback;
      }

      return res.rows;
    } catch {
      const fallback = await readJsonStore();
      return onlyActive ? fallback.filter((a) => a.active) : fallback;
    }
  }

  // Supabase / Production mode
  const { createAdminClient } = await import("../database/supabase.ts");
  const client = createAdminClient();
  let query = client
    .from("announcements")
    .select(
      "id, title, content, category, priority, pinned, active, author_name, created_at, updated_at",
    )
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (onlyActive) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error || !data) {
    const fallback = await readJsonStore();
    return onlyActive ? fallback.filter((a) => a.active) : fallback;
  }

  return data as Announcement[];
}

export async function createAnnouncement(
  input: CreateAnnouncementInput,
  authorName = "Admin",
): Promise<Announcement> {
  const item: Announcement = {
    id: randomUUID(),
    title: input.title.trim(),
    content: input.content.trim(),
    category: input.category?.trim() || "General",
    priority: input.priority || "normal",
    pinned: Boolean(input.pinned),
    active: true,
    author_name: authorName,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (localDemoEnabled()) {
    try {
      const { localDatabase } = await import("../local/database.ts");
      const db = await localDatabase();
      await db.query(
        `insert into public.announcements(id, title, content, category, priority, pinned, active, author_name, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          item.id,
          item.title,
          item.content,
          item.category,
          item.priority,
          item.pinned,
          item.active,
          item.author_name,
          item.created_at,
          item.updated_at,
        ],
      );
    } catch {
      /* ignore db error, save to json fallback */
    }
  } else {
    try {
      const { createAdminClient } = await import("../database/supabase.ts");
      await createAdminClient().from("announcements").insert(item);
    } catch {
      /* fallback */
    }
  }

  // Sync to fallback store
  const existing = await readJsonStore();
  await writeJsonStore([item, ...existing.filter((a) => a.id !== item.id)]);

  return item;
}

export async function updateAnnouncement(
  input: UpdateAnnouncementInput,
): Promise<Announcement | null> {
  const now = new Date().toISOString();

  if (localDemoEnabled()) {
    try {
      const { localDatabase } = await import("../local/database.ts");
      const db = await localDatabase();
      const current = (
        await db.query<Announcement>("select * from public.announcements where id=$1", [input.id])
      ).rows[0];

      if (current) {
        const updated: Announcement = {
          ...current,
          title: input.title !== undefined ? input.title.trim() : current.title,
          content: input.content !== undefined ? input.content.trim() : current.content,
          category: input.category !== undefined ? input.category.trim() : current.category,
          priority: input.priority !== undefined ? input.priority : current.priority,
          pinned: input.pinned !== undefined ? input.pinned : current.pinned,
          active: input.active !== undefined ? input.active : current.active,
          updated_at: now,
        };

        await db.query(
          `update public.announcements set
             title=$1, content=$2, category=$3, priority=$4, pinned=$5, active=$6, updated_at=$7
           where id=$8`,
          [
            updated.title,
            updated.content,
            updated.category,
            updated.priority,
            updated.pinned,
            updated.active,
            updated.updated_at,
            updated.id,
          ],
        );

        const existing = await readJsonStore();
        await writeJsonStore(existing.map((a) => (a.id === updated.id ? updated : a)));
        return updated;
      }
    } catch {
      /* fallback to json */
    }
  } else {
    try {
      const { createAdminClient } = await import("../database/supabase.ts");
      const { data } = await createAdminClient()
        .from("announcements")
        .update({
          ...(input.title !== undefined && { title: input.title.trim() }),
          ...(input.content !== undefined && { content: input.content.trim() }),
          ...(input.category !== undefined && { category: input.category.trim() }),
          ...(input.priority !== undefined && { priority: input.priority }),
          ...(input.pinned !== undefined && { pinned: input.pinned }),
          ...(input.active !== undefined && { active: input.active }),
          updated_at: now,
        })
        .eq("id", input.id)
        .select()
        .single();

      if (data) return data as Announcement;
    } catch {
      /* fallback */
    }
  }

  // Update in json store
  const existing = await readJsonStore();
  const target = existing.find((a) => a.id === input.id);
  if (!target) return null;

  const updated: Announcement = {
    ...target,
    title: input.title !== undefined ? input.title.trim() : target.title,
    content: input.content !== undefined ? input.content.trim() : target.content,
    category: input.category !== undefined ? input.category.trim() : target.category,
    priority: input.priority !== undefined ? input.priority : target.priority,
    pinned: input.pinned !== undefined ? input.pinned : target.pinned,
    active: input.active !== undefined ? input.active : target.active,
    updated_at: now,
  };

  await writeJsonStore(existing.map((a) => (a.id === updated.id ? updated : a)));
  return updated;
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  if (localDemoEnabled()) {
    try {
      const { localDatabase } = await import("../local/database.ts");
      const db = await localDatabase();
      await db.query("delete from public.announcements where id=$1", [id]);
    } catch {
      /* fallback */
    }
  } else {
    try {
      const { createAdminClient } = await import("../database/supabase.ts");
      await createAdminClient().from("announcements").delete().eq("id", id);
    } catch {
      /* fallback */
    }
  }

  const existing = await readJsonStore();
  await writeJsonStore(existing.filter((a) => a.id !== id));
  return true;
}
