import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";

const video = "public/videos/indianxtrade-greeting-v2.mp4";
const originalVideo = "public/videos/INDIAN_X_TRADE_Single_Logo_Smooth_Outro_1080p.mp4";

function boxes(bytes: Buffer, start = 0, end = bytes.length) {
  const result: { type: string; offset: number; size: number }[] = [];
  for (let offset = start; offset < end;) {
    const size = bytes.readUInt32BE(offset);
    assert.ok(size >= 8 && offset + size <= end, "valid bounded MP4 box");
    result.push({ type: bytes.toString("ascii", offset + 4, offset + 8), offset, size });
    offset += size;
  }
  return result;
}

test("greeting stays complete, smaller and streaming-ready with metadata before video bytes", () => {
  const bytes = readFileSync(video);
  const top = boxes(bytes);
  const moov = top.find((box) => box.type === "moov")!;
  const mdat = top.find((box) => box.type === "mdat")!;
  assert.ok(moov && mdat && moov.offset < mdat.offset);
  assert.ok(bytes.length < statSync(originalVideo).size * 0.7);
  const children = boxes(bytes, moov.offset + 8, moov.offset + moov.size);
  const mvhd = children.find((box) => box.type === "mvhd")!;
  assert.equal(bytes[mvhd.offset + 8], 0, "32-bit movie duration header");
  const duration = bytes.readUInt32BE(mvhd.offset + 24) / bytes.readUInt32BE(mvhd.offset + 20);
  assert.equal(duration, 10, "all ten seconds retained");
  assert.equal(children.filter((box) => box.type === "trak").length, 2, "video and audio retained");
});

for (const name of [
  "indianxtrade-dark",
  "indianxtrade-light",
  "indianxtrade-mark",
  "indianxtrade-mark-light",
]) {
  test(`${name}: lossless WebP is smaller, with unchanged dimensions and visible pixels`, async () => {
    const original = `public/brand/${name}.png`;
    const optimized = `public/brand/${name}-v2.webp`;
    assert.ok(statSync(optimized).size < statSync(original).size);
    const before = await sharp(original).metadata();
    const after = await sharp(optimized).metadata();
    assert.equal(before.width, after.width);
    assert.equal(before.height, after.height);
    // Flatten both backgrounds so invisible RGB under fully transparent pixels is irrelevant.
    for (const background of ["#000000", "#ffffff"]) {
      const png = await sharp(original).flatten({ background }).raw().toBuffer();
      const webp = await sharp(optimized).flatten({ background }).raw().toBuffer();
      assert.ok(png.equals(webp), `identical visible pixels on ${background}`);
    }
  });
}
