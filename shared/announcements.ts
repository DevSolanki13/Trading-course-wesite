export type AnnouncementPriority = "normal" | "important" | "urgent";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: AnnouncementPriority;
  pinned: boolean;
  active: boolean;
  author_name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  category?: string;
  priority?: AnnouncementPriority;
  pinned?: boolean;
}

export interface UpdateAnnouncementInput {
  id: string;
  title?: string;
  content?: string;
  category?: string;
  priority?: AnnouncementPriority;
  pinned?: boolean;
  active?: boolean;
}
