import { getEmailStrings } from "./emailStrings";

interface BuildEmailParams {
  url: string;
  host: string;
  locale: string;
  isNewUser: boolean;
}

export function buildSignInEmail(params: BuildEmailParams): {
  html: string;
  text: string;
  subject: string;
} {
  const { url, host, locale, isNewUser } = params;
  const s = getEmailStrings(locale);

  const subject = isNewUser ? s.welcomeSubject : s.signInSubject;
  const heading = isNewUser ? s.welcomeHeading : s.signInHeading;
  const body = isNewUser ? s.welcomeBody : s.signInBody;
  const button = isNewUser ? s.welcomeButton : s.signInButton;

  const isRtl = locale === "ar";
  const dir = isRtl ? "rtl" : "ltr";
  const textAlign = isRtl ? "right" : "left";

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" dir="${dir}" lang="${locale}">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <span style="font-size: 28px; font-weight: 700; color: #18181b; letter-spacing: -0.5px; text-decoration: none;">DocTalk</span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 8px; padding: 40px 40px 32px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <!-- Heading -->
                <tr>
                  <td style="font-size: 24px; font-weight: 600; color: #18181b; text-align: ${textAlign}; padding-bottom: 16px; line-height: 32px;">
                    ${escapeHtml(heading)}
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="font-size: 16px; color: #71717a; text-align: ${textAlign}; line-height: 24px; padding-bottom: 8px;">
                    ${escapeHtml(body)}
                  </td>
                </tr>
                <!-- Expires -->
                <tr>
                  <td style="font-size: 16px; color: #71717a; text-align: ${textAlign}; line-height: 24px; padding-bottom: 32px;">
                    ${escapeHtml(s.expires)}
                  </td>
                </tr>
                <!-- CTA Button -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="background-color: #18181b; border-radius: 6px;">
                          <a href="${escapeHtml(url)}" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-weight: 500; color: #ffffff; text-decoration: none; line-height: 24px;">
                            ${escapeHtml(button)}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Disclaimer -->
                <tr>
                  <td style="font-size: 14px; color: #a1a1aa; text-align: ${textAlign}; line-height: 20px; padding-bottom: 4px;">
                    ${escapeHtml(s.disclaimer)}
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #a1a1aa; text-align: ${textAlign}; line-height: 20px;">
                    ${escapeHtml(s.checkSpam)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 24px; padding-bottom: 8px;">
              <span style="font-size: 12px; color: #a1a1aa;">${escapeHtml(s.footer)}</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <a href="https://www.doctalk.site/privacy" style="font-size: 12px; color: #a1a1aa; text-decoration: underline;">Privacy</a>
              <span style="font-size: 12px; color: #d4d4d8; padding: 0 8px;">&middot;</span>
              <a href="https://www.doctalk.site/terms" style="font-size: 12px; color: #a1a1aa; text-decoration: underline;">Terms</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = buildPlainText({ url, heading, body, button, s });

  return { html, text, subject };
}

function buildPlainText({
  url,
  heading,
  body,
  button,
  s,
}: {
  url: string;
  heading: string;
  body: string;
  button: string;
  s: ReturnType<typeof getEmailStrings>;
}): string {
  return `${heading}
${"=".repeat(heading.length)}

${body}
${s.expires}

${button}: ${url}

${s.disclaimer}
${s.checkSpam}

---
${s.footer}
https://www.doctalk.site
Privacy: https://www.doctalk.site/privacy
Terms: https://www.doctalk.site/terms`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
