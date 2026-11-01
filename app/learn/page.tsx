import { redirect } from "next/navigation";
export const metadata = { title: "My learning", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function Library() {
  redirect("/dashboard");
}
