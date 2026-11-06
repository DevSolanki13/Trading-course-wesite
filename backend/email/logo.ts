import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { EMAIL_LOGO_CID } from "./template.ts";

let logoContent: Promise<string> | undefined;

/** Attach the opaque logo so email clients never need to fetch a website image. */
export async function emailLogoAttachment() {
  logoContent ??= readFile(join(process.cwd(), "public/brand/indianxtrade-logo-light.jpg"))
    .then((bytes) => bytes.toString("base64"))
    .catch((error) => {
      logoContent = undefined;
      throw error;
    });
  return {
    filename: "indianxtrade-logo.jpg",
    content: await logoContent,
    content_type: "image/jpeg",
    content_id: EMAIL_LOGO_CID,
  };
}
