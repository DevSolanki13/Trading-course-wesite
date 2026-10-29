import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="container">
      <div className="account-preview">
        <span className="not-found-code">404</span>
        <h1>A little off course.</h1>
        <p>That page could not be found. Let’s get you back to the learning path.</p>
        <Link className="button button-primary" href="/courses">
          Explore courses
        </Link>
      </div>
    </main>
  );
}
