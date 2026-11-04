import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const alt = "indianXtrade: Learn the process. Respect the risk.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const logoBase64 = fs.readFileSync(
    path.join(process.cwd(), "public", "brand", "indianxtrade-dark.png"),
    "base64",
  );
  const logoSrc = `data:image/png;base64,${logoBase64}`;

  return new ImageResponse(
    <div
      style={{
        background: "#0B0E11",
        color: "#F0F3FA",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 70,
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          width={220}
          height={72}
          style={{ objectFit: "contain" }}
          alt="indianXtrade"
        />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 78,
          letterSpacing: -3,
          lineHeight: 1.1,
        }}
      >
        <span>Learn the process.</span>
        <span style={{ color: "#35dca0" }}>Respect the risk.</span>
      </div>
      <div style={{ fontSize: 22, color: "#A1A6B2", display: "flex" }}>
        Trading education in Hindi · Preview edition
      </div>
    </div>,
    size,
  );
}
