import { redirect } from "next/navigation";

export const metadata = { title: "Your account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function Account() {
  redirect("/dashboard?view=account&section=devices");
}
