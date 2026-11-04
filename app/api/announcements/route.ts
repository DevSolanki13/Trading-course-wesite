import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { localDemoEnabled } from "@/backend/purchase/mode";
import { LOCAL_SESSION_COOKIE, localSession } from "@/backend/local/auth";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "@/backend/announcements/service";
import type { CreateAnnouncementInput, UpdateAnnouncementInput } from "@/shared/announcements";

export const dynamic = "force-dynamic";

async function verifyAdmin(): Promise<{ name: string; email: string } | null> {
  if (localDemoEnabled()) {
    const cookieStore = await cookies();
    const token = cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
    const session = await localSession(token);
    if (!session || session.role !== "admin") return null;
    return { name: session.name || "Admin", email: session.email };
  }
  try {
    const { privileged } = await import("@/backend/auth/session");
    const context = await privileged();
    if (context.profile.role !== "admin") return null;
    return { name: context.profile.full_name || "Admin", email: context.user.email || "" };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const wantAll = url.searchParams.get("all") === "true";

    let onlyActive = true;
    if (wantAll) {
      const admin = await verifyAdmin();
      if (admin) {
        onlyActive = false;
      }
    }

    const announcements = await listAnnouncements(onlyActive);
    return NextResponse.json({ announcements });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load announcements" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "create") {
      const { title, content, category, priority, pinned } = body as CreateAnnouncementInput & {
        action: string;
      };

      if (!title || !title.trim()) {
        return NextResponse.json({ error: "Announcement title is required." }, { status: 400 });
      }
      if (!content || !content.trim()) {
        return NextResponse.json({ error: "Announcement message is required." }, { status: 400 });
      }

      const created = await createAnnouncement(
        { title, content, category, priority, pinned },
        admin.name || "Admin",
      );
      return NextResponse.json({
        announcement: created,
        message: "Announcement published successfully!",
      });
    }

    if (action === "update") {
      const { id, title, content, category, priority, pinned, active } =
        body as UpdateAnnouncementInput & { action: string };
      if (!id) {
        return NextResponse.json(
          { error: "Announcement ID is required for update." },
          { status: 400 },
        );
      }

      const updated = await updateAnnouncement({
        id,
        title,
        content,
        category,
        priority,
        pinned,
        active,
      });
      if (!updated) {
        return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
      }
      return NextResponse.json({
        announcement: updated,
        message: "Announcement updated successfully!",
      });
    }

    if (action === "delete") {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: "Announcement ID is required." }, { status: 400 });
      }
      await deleteAnnouncement(id);
      return NextResponse.json({ success: true, message: "Announcement deleted." });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Operation failed" },
      { status: 500 },
    );
  }
}
