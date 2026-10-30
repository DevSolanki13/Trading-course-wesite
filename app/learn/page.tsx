import { LearningLibrary } from "@/frontend/components/learning-library";
import "@/frontend/styles/auth.css";
import "@/frontend/styles/learning.css";
export const metadata = { title: "My learning", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function Library() {
  return <LearningLibrary />;
}
