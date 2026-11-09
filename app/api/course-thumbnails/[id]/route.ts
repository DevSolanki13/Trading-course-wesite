import { courseThumbnail } from "../../../../backend/admin/thumbnails";
import { AuthError, failure } from "../../../../backend/auth/http";
import { parseThumbnailWidth } from "../../../../shared/course-thumbnail";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let width;
    try {
      width = parseThumbnailWidth(new URL(request.url).searchParams);
    } catch {
      throw new AuthError(400, "Unsupported thumbnail width.");
    }
    return await courseThumbnail((await params).id, width);
  } catch (error) {
    return failure(error);
  }
}
