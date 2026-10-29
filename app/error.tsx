"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="container">
      <div className="account-preview">
        <h1>Something didn’t load.</h1>
        <p>
          Your course information is temporarily unavailable. Try again or return to the homepage.
        </p>
        <button className="button button-primary" onClick={reset}>
          Try again
        </button>
        <Link className="text-link" href="/">
          Back to home
        </Link>
      </div>
    </main>
  );
}
