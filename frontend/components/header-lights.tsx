import { useId } from "react";

/** A single decorative strand shared by public pages and signed-in workspaces. */
export function HeaderLights() {
  const patternId = `header-lights-${useId().replace(/:/g, "")}`;

  return (
    <div className="header-lights" aria-hidden="true">
      <svg width="100%" height="18" fill="none" focusable="false">
        <defs>
          <pattern id={patternId} width="468" height="18" patternUnits="userSpaceOnUse">
            <path d="M0 2Q117 12 234 2Q351 12 468 2" className="header-lights-wire" />
            <path d="M22 3.7v0.8M256 3.7V5" className="header-lights-cord" />
            <rect x="20.5" y="4.5" width="3" height="5.5" rx="1.5" className="header-lights-bulb" />
            <rect x="254.5" y="5" width="3" height="5" rx="1.5" className="header-lights-bulb" />
          </pattern>
        </defs>
        <rect width="100%" height="18" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}
