import { pageMetadata } from "@/frontend/lib/metadata";
export async function generateMetadata(){const data=await publicCatalog();const title=[data.content?.heroTitle,data.content?.heroAccent].filter(Boolean).join(" ")||"Clarity before the first trade.";const description=data.content?.heroDescription||"Structured Hindi trading education, focused on market understanding, price action and risk. Explore the preview catalogue.";return pageMetadata(title,description,"/");}
import HomePage from "@/frontend/pages/home-page";
import { publicCatalog } from "@/backend/public/catalogue";
export const dynamic = "force-dynamic";
export default async function Home() {
  const data = await publicCatalog();
  return (
    <HomePage
      courses={data.courses.length ? data.courses : undefined}
      content={data.content}
      telegramUrl={data.telegramUrl}
      instagramUrl={data.instagramUrl}
      published={!!data.courses.length}
    />
  );
}
