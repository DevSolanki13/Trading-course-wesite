import { DeviceChallenge } from "@/frontend/components/device-challenge";
import "@/frontend/styles/auth.css";
export const metadata = {
  title: "Choose an active device",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Devices({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <main id="main-content" className="container device-challenge-page">
      <DeviceChallenge next={typeof query.next === "string" ? query.next : undefined} />
    </main>
  );
}
