import { pageMetadata } from "@/frontend/lib/metadata";
export const metadata = pageMetadata(
  "Trading courses in Hindi",
  "Explore market foundations, price action and risk education. Preview curriculum, level and illustrative pricing.",
  "/courses",
);
import CataloguePage from "@/frontend/pages/catalogue-page";
import { publicCatalog } from "@/backend/public/catalogue";
export const dynamic = "force-dynamic";
export default async function Catalogue() {
  const data = await publicCatalog();
  return (
    <CataloguePage
      courses={data.courses.length ? data.courses : undefined}
      published={!!data.courses.length}
    />
  );
}
