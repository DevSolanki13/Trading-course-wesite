"use client";

import Link from "next/link";
import { ArrowRight } from "./icons";
import { useAuth } from "./auth-provider";

export function EnrollButton({
  initialLoggedIn = false,
  className = "button button-primary",
}: {
  initialLoggedIn?: boolean;
  className?: string;
}) {
  const { user, ready } = useAuth();
  const loggedIn = ready ? !!user : initialLoggedIn;
  const target = loggedIn
    ? "/dashboard?view=explore"
    : `/login?next=${encodeURIComponent("/dashboard?view=explore")}`;

  return (
    <Link href={target} className={className}>
      Enroll now <ArrowRight size={18} />
    </Link>
  );
}
