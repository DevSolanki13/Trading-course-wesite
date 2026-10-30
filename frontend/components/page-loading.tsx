export default function Loading() {
  return (
    <main
      id="main-content"
      className="container loading-page"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-copy" />
      <div className="course-grid">
        {[0, 1, 2].map((item) => (
          <div key={item} className="skeleton skeleton-course" />
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading course information…
      </span>
    </main>
  );
}
