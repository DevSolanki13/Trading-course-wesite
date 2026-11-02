import { pageMetadata } from "@/frontend/lib/metadata";
import { redirect } from "next/navigation";
import HomePage from "@/frontend/pages/home-page";
import { publicCatalog } from "@/backend/public/catalogue";
import { purchaseUser } from "@/backend/purchase/session";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const data = await publicCatalog();
  const title =
    [data.content?.heroTitle, data.content?.heroAccent].filter(Boolean).join(" ") ||
    "Clarity before the first trade.";
  const description =
    data.content?.heroDescription ||
    "Structured Hindi trading education, focused on market understanding, price action and risk. Explore the preview catalogue.";
  return pageMetadata(title, description, "/");
}

export default async function Home() {
  const [data, user] = await Promise.all([
    publicCatalog(),
    purchaseUser(false).catch(() => null),
  ]);
  if (user?.role === "admin") {
    redirect("/admin");
  }
  return (
    <HomePage
      courses={data.courses.length ? data.courses : undefined}
      content={data.content}
      telegramUrl={data.telegramUrl}
      instagramUrl={data.instagramUrl}
      published={!data.failed && !!data.courses.length}
    />
  );
}
