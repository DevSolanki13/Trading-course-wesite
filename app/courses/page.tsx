import { pageMetadata } from "@/frontend/lib/metadata";
export const metadata = pageMetadata(
  "Trading courses in Hindi",
  "Explore market foundations, price action and risk education. Preview curriculum, level and illustrative pricing.",
  "/courses",
);
import { redirect } from "next/navigation";
import CataloguePage from "@/frontend/pages/catalogue-page";
import { publicCatalog } from "@/backend/public/catalogue";
import { purchaseUser } from "@/backend/purchase/session";
import "@/frontend/styles/admin-shared.css";

export const dynamic = "force-dynamic";
export default async function Catalogue() {
  const [data, user] = await Promise.all([
    publicCatalog(),
    purchaseUser(false).catch(() => null),
  ]);
  if (user?.role === "admin") {
    redirect("/admin");
  }
  const isAdmin = user?.role === "admin";
  return (
    <CataloguePage
      courses={data.courses.length ? data.courses : undefined}
      published={!data.failed && !!data.courses.length}
      isAdmin={isAdmin}
    />
  );
}
