/**
 * Email Template Helper
 * Provides consistent styled HTML email templates
 */

interface EmailTemplateOptions {
    title?: string;
    greeting: string;
    content: string;
    buttonText?: string;
    buttonLink?: string;
    footer?: string;
}

/**
 * Generates a styled HTML email template
 */
export const createEmailTemplate = ({
    title,
    greeting,
    content,
    buttonText,
    buttonLink,
    footer,
}: EmailTemplateOptions): string => {
    const buttonHtml = buttonText && buttonLink ? `
    <!-- CTA Button -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding: 24px 0;">
          <a href="${buttonLink}" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #000000; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">${buttonText}</a>
        </td>
      </tr>
    </table>
  ` : '';

    const footerText = footer || '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding: 32px 40px; background-color: #000000;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: 2px;">LOGO</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333;">${greeting}</p>
              <div style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333;">${content}</div>
              ${buttonHtml}
              ${footerText ? `<p style="margin: 24px 0 0; font-size: 14px; line-height: 1.6; color: #666666;">${footerText}</p>` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #eeeeee;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">© ${new Date().getFullYear()} Boomers. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Generates a styled HTML email with a verification code displayed prominently
 */
export const createCodeEmailTemplate = ({
    greeting,
    message,
    code,
    footer,
}: {
    greeting: string;
    message: string;
    code: string;
    footer?: string;
}): string => {
    return createEmailTemplate({
        greeting,
        content: `
      <p style="margin: 0 0 24px;">${message}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <div style="display: inline-block; padding: 16px 32px; background-color: #f4f4f4; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #000000;">${code}</div>
          </td>
        </tr>
      </table>
    `,
        footer,
    });
};

export default createEmailTemplate;
