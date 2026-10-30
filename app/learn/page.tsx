import { LearningLibrary } from "@/frontend/components/learning-library";
import "@/frontend/styles/auth.css";
import "@/frontend/styles/learning.css";
import { localDemoEnabled } from "@/backend/purchase/mode";
import { redirect } from "next/navigation";
export const metadata = { title: "My learning", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function Library() {
  if (localDemoEnabled()) redirect("/dashboard");
  return <LearningLibrary />;
}
