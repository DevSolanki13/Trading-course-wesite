import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import sharp from "sharp";

// Original, silent camera movement over our generated conceptual study image.
// No instructor identity, real trade footage or third-party stock is implied.
mkdirSync("public/videos", { recursive: true });
const encoder = spawn(
  process.argv[2] || "ffmpeg",
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "image2pipe",
    "-r",
    "15",
    "-vcodec",
    "mjpeg",
    "-i",
    "pipe:0",
    "-an",
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    "240k",
    "-deadline",
    "realtime",
    "-cpu-used",
    "6",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "15",
    "-y",
    "public/videos/study-loop.webm",
  ],
  { stdio: ["pipe", "ignore", "pipe"], windowsHide: true },
);
let errors = "";
encoder.stderr.on("data", (chunk) => {
  errors += chunk.toString();
});
const completed = once(encoder, "close");
encoder.stdin.on("error", () => {});
for (let frame = 0; frame < 120; frame++) {
  const phase = (frame / 120) * Math.PI * 2;
  const width = Math.round(1264 + 14 * (1 - Math.cos(phase)));
  const left = Math.round((width - 1200) / 2 + 5 * Math.sin(phase));
  const buffer = await sharp("public/images/study-desk.png")
    .resize({ width })
    .extract({ left, top: 18, width: 1200, height: 800 })
    .jpeg({ quality: 78 })
    .toBuffer();
  if (encoder.stdin.destroyed) break;
  if (!encoder.stdin.write(buffer)) await once(encoder.stdin, "drain");
}
encoder.stdin.end();
const [code] = await completed;
if (code !== 0) throw new Error(`Video generation failed: ${errors.slice(0, 400)}`);
console.log("Created 8-second silent ambient loop: public/videos/study-loop.webm");
