"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import PageLoading from "../../frontend/components/page-loading";

function DashboardLoadingContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || searchParams.get("tab");
  const billing = pathname === "/dashboard/orders" || view === "billing" || view === "orders";

  return <PageLoading view={billing ? "billing" : "explore"} />;
}

export default function DashboardLoading() {
  return (
    <Suspense fallback={null}>
      <DashboardLoadingContent />
    </Suspense>
  );
}
