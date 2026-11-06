export const EMAIL_LOGO_CID = "logo@indianxtrade.com";

export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!;
  });
}

type EmailAction = { label: string; url: string };

export function transactionalEmailHtml(input: {
  title: string;
  preheader: string;
  paragraphs: string[];
  action?: EmailAction;
  secondaryAction?: EmailAction;
  note?: string;
  fallbackUrl?: string;
}): string {
  const escape = escapeEmailHtml;
  const action = input.action;
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escape(input.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f8f7;color:#131b19;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;">${escape(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f8f7;">
    <tr><td align="center" style="padding:24px 12px;">
      <!--[if mso]><table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border:1px solid #dce3df;border-radius:10px;">
        <tr><td style="padding:24px 24px 0;background-color:#ffffff;">
          <img src="cid:${EMAIL_LOGO_CID}" alt="indianXtrade" width="160" height="34" style="display:block;width:160px;max-width:100%;height:34px;border:0;outline:none;color:#131b19;font-size:16px;font-weight:bold;" />
        </td></tr>
        <tr><td style="padding:24px;color:#131b19;overflow-wrap:anywhere;word-break:break-word;">
          <h1 style="margin:0 0 12px;font-size:24px;line-height:32px;font-weight:700;color:#131b19;">${escape(input.title)}</h1>
          ${input.paragraphs.map((paragraph) => `<p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#43534b;">${escape(paragraph)}</p>`).join("\n          ")}
          ${action ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr><td bgcolor="#08784f" style="border-radius:6px;background-color:#08784f;"><a href="${escape(action.url)}" style="display:inline-block;padding:12px 20px;border:1px solid #08784f;border-radius:6px;font-size:14px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;">${escape(action.label)}</a></td></tr></table>` : ""}
          ${input.secondaryAction ? `<p style="margin:0 0 16px;font-size:14px;line-height:22px;"><a href="${escape(input.secondaryAction.url)}" style="color:#08784f;text-decoration:underline;">${escape(input.secondaryAction.label)}</a></p>` : ""}
          ${input.note ? `<p style="margin:0;font-size:13px;line-height:21px;color:#43534b;">${escape(input.note)}</p>` : ""}
          ${input.fallbackUrl ? `<p style="margin:16px 0 0;font-size:12px;line-height:19px;color:#43534b;">If the button doesn’t work, copy this link into your browser:<br /><a href="${escape(input.fallbackUrl)}" style="color:#08784f;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">${escape(input.fallbackUrl)}</a></p>` : ""}
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #dce3df;font-size:12px;line-height:19px;color:#43534b;">
          indianXtrade · Learn the process. Respect the risk.<br />
          Need help? <a href="mailto:support@indianxtrade.com" style="color:#08784f;text-decoration:underline;">support@indianxtrade.com</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}
