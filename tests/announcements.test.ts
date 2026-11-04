import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../backend/announcements/service.ts";

test("admin announcements lifecycle: create, list, toggle, update and delete", async () => {
  // 1. Initial list
  const initial = await listAnnouncements(false);
  assert.ok(Array.isArray(initial));

  // 2. Create announcement
  const created = await createAnnouncement(
    {
      title: "🔴 Special Live Trading Session",
      content: "Join us Friday at 7 PM for live chart analysis and risk setup reviews.",
      category: "Live Session",
      priority: "urgent",
      pinned: true,
    },
    "Master Mentor",
  );

  assert.ok(created.id);
  assert.equal(created.title, "🔴 Special Live Trading Session");
  assert.equal(created.priority, "urgent");
  assert.equal(created.pinned, true);
  assert.equal(created.active, true);
  assert.equal(created.author_name, "Master Mentor");

  // 3. List active includes created announcement
  const activeList = await listAnnouncements(true);
  const found = activeList.find((a) => a.id === created.id);
  assert.ok(found, "Newly created announcement should be active");
  assert.equal(found?.title, "🔴 Special Live Trading Session");

  // 4. Update announcement
  const updated = await updateAnnouncement({
    id: created.id,
    title: "🔴 Special Live Trading Session (Rescheduled)",
    active: false,
  });

  assert.ok(updated);
  assert.equal(updated.title, "🔴 Special Live Trading Session (Rescheduled)");
  assert.equal(updated.active, false);

  // 5. Active list should not include deactivated announcement
  const activeAfterUpdate = await listAnnouncements(true);
  assert.ok(!activeAfterUpdate.some((a) => a.id === created.id));

  // All list should still include it
  const allAfterUpdate = await listAnnouncements(false);
  assert.ok(allAfterUpdate.some((a) => a.id === created.id));

  // 6. Delete announcement
  await deleteAnnouncement(created.id);
  const finalAll = await listAnnouncements(false);
  assert.ok(!finalAll.some((a) => a.id === created.id));
});
