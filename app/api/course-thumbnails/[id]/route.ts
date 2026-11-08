import { courseThumbnail } from "../../../../backend/admin/thumbnails";
import { failure } from "../../../../backend/auth/http";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await courseThumbnail((await params).id);
  } catch (error) {
    return failure(error);
  }
}
