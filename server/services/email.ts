import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableSendGridClient() {
  const { apiKey, email } = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

// Email templates matching Synozur styling
export interface AccessRequestEmailData {
  workspaceName: string;
  requesterName: string;
  requesterEmail: string;
  message?: string;
  grantAccessUrl: string;
  organizationName: string;
}

export async function sendAccessRequestEmail(
  recipientEmail: string,
  recipientName: string,
  data: AccessRequestEmailData
): Promise<void> {
  const { client, fromEmail } = await getUncachableSendGridClient();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workspace Access Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background-color: #0F1115; color: #E5E7EB;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0F1115; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1A1D24; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%);">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 600; text-align: center;">
                Aurora
              </h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; text-align: center;">
                Collaborative Envisioning Platform
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px; color: #F9FAFB; font-size: 20px; font-weight: 600;">
                Workspace Access Request
              </h2>
              
              <p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
                Hi ${recipientName},
              </p>
              
              <p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
                <strong style="color: #F9FAFB;">${data.requesterName}</strong> (${data.requesterEmail}) has requested access to the workspace:
              </p>
              
              <div style="margin: 0 0 24px; padding: 20px; background-color: #0F1115; border-left: 4px solid #810FFB; border-radius: 6px;">
                <p style="margin: 0 0 8px; color: #810FFB; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                  ${data.organizationName}
                </p>
                <p style="margin: 0; color: #F9FAFB; font-size: 18px; font-weight: 600;">
                  ${data.workspaceName}
                </p>
              </div>
              
              ${data.message ? `
              <div style="margin: 0 0 32px; padding: 16px; background-color: rgba(129, 15, 251, 0.1); border-radius: 6px; border: 1px solid rgba(129, 15, 251, 0.2);">
                <p style="margin: 0 0 8px; color: #9CA3AF; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Message from requester
                </p>
                <p style="margin: 0; color: #D1D5DB; font-size: 14px; line-height: 1.6;">
                  ${data.message}
                </p>
              </div>
              ` : ''}
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center">
                    <a href="${data.grantAccessUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center;">
                      Review Access Request
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px; color: #9CA3AF; font-size: 14px; line-height: 1.6;">
                You can grant or deny access from the admin panel. This helps maintain security while enabling collaboration.
              </p>
              
              <p style="margin: 0; color: #6B7280; font-size: 12px; line-height: 1.5;">
                If the button above doesn't work, copy and paste this URL into your browser:<br>
                <span style="color: #810FFB; word-break: break-all;">${data.grantAccessUrl}</span>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0F1115; border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <p style="margin: 0 0 8px; color: #6B7280; font-size: 12px; text-align: center;">
                Powered by Synozur Alliance
              </p>
              <p style="margin: 0; color: #4B5563; font-size: 11px; text-align: center;">
                © ${new Date().getFullYear()} Synozur. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textContent = `
Hi ${recipientName},

${data.requesterName} (${data.requesterEmail}) has requested access to the workspace:

${data.organizationName} - ${data.workspaceName}

${data.message ? `Message from requester:\n${data.message}\n\n` : ''}

Review and grant access here: ${data.grantAccessUrl}

You can grant or deny access from the admin panel.

---
Powered by Synozur Alliance
© ${new Date().getFullYear()} Synozur. All rights reserved.
  `;

  await client.send({
    to: recipientEmail,
    from: fromEmail,
    subject: `Access Request: ${data.workspaceName}`,
    text: textContent,
    html: htmlContent,
  });
}
