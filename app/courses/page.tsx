import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Catalogue() {
  redirect("/dashboard?view=explore");
}
