/** Original geometric course-cover system, intentionally code-native rather than stock imagery. */
export function CourseArtwork({ kind, className = "" }: { kind: string; className?: string }) {
  return (
    <div className={`course-artwork artwork-${kind} ${className}`} aria-hidden="true">
      {kind === "foundations" ? (
        <div className="foundation-blocks">
          <i />
          <i />
          <i />
          <i />
        </div>
      ) : kind === "structure" ? (
        <div className="structure-lines">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      ) : (
        <div className="risk-orbits">
          <i />
          <i />
          <i />
          <span />
        </div>
      )}
      <span className="art-label">
        {kind === "foundations"
          ? "FOUNDATION / UNDERSTANDING"
          : kind === "structure"
            ? "STRUCTURE / CONTEXT"
            : "DISCIPLINE / PROCESS"}
      </span>
    </div>
  );
}
