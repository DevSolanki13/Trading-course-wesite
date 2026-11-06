import { transactionalEmailHtml } from "../email/template.ts";

function publicOrigin(value: string | undefined): string | undefined {
  try {
    const url = new URL(value ?? "");
    if (
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
    )
      return url.origin;
  } catch {}
}

export function buildNotificationEmailHtml(
  row: { subject: string; body: string; dedupe_key: string },
  appUrl?: string,
): string {
  const origin = publicOrigin(appUrl);
  const purchase = row.dedupe_key.startsWith("purchase:");
  const links: { Course?: string; Receipt?: string } = {};
  const paragraphs = row.body.split(/\n+/).filter((line) => {
    if (!line) return false;
    const match = purchase && origin && /^(Course|Receipt): (\S+)$/.exec(line);
    if (!match) return true;
    try {
      const url = new URL(match[2], origin);
      const label = match[1] as "Course" | "Receipt";
      const expectedPath =
        label === "Course"
          ? url.pathname.startsWith("/learn/")
          : /^\/(dashboard\/orders\/[^/]+\/receipt|api\/orders\/[^/]+\/document)$/.test(
              url.pathname,
            );
      if (url.origin === origin && !url.username && !url.password && expectedPath) {
        links[label] = url.toString();
        return false;
      }
    } catch {}
    return true;
  });
  return transactionalEmailHtml({
    title: row.subject,
    preheader: row.body.split("\n")[0],
    paragraphs,
    action: origin
      ? {
          label: purchase ? "Open my courses" : "View billing & receipts",
          url: links.Course ?? `${origin}/dashboard?view=${purchase ? "courses" : "billing"}`,
        }
      : undefined,
    secondaryAction:
      origin && purchase
        ? {
            label: links.Receipt ? "View receipt" : "Billing & receipts",
            url: links.Receipt ?? `${origin}/dashboard?view=billing`,
          }
        : undefined,
  });
}
