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

export interface EmailVerificationData {
  username: string;
  verificationUrl: string;
}

export interface PasswordResetData {
  username: string;
  resetUrl: string;
}

// Base interface for workspace-related emails
export interface BaseWorkspaceEmailData {
  organizationName: string;
  workspaceName: string;
  workspaceCode: string;
  facilitatorName?: string;
}

// Session/Workspace invitation email
export interface SessionInviteEmailData extends BaseWorkspaceEmailData {
  inviteeName: string;
  role: 'participant' | 'facilitator';
  sessionDate?: string;
  sessionTime?: string;
  joinUrl: string;
  personalMessage?: string;
}

// Phase change notification email
export interface PhaseChangeEmailData extends BaseWorkspaceEmailData {
  participantName: string;
  previousPhase?: string;
  newPhase: string;
  phaseDescription: string;
  actionUrl: string;
  deadline?: string;
}

// Results available notification email
export interface ResultsReadyEmailData extends BaseWorkspaceEmailData {
  participantName: string;
  hasPersonalizedResults: boolean;
  resultsUrl: string;
  cohortResultsAvailable: boolean;
}

// Workspace reminder email
export interface WorkspaceReminderEmailData extends BaseWorkspaceEmailData {
  participantName: string;
  currentPhase: string;
  deadline: string;
  actionUrl: string;
  reminderType: 'deadline_approaching' | 'incomplete_submission' | 'session_starting';
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
                Nebula
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

export async function sendEmailVerification(
  recipientEmail: string,
  data: EmailVerificationData
): Promise<void> {
  const { client, fromEmail } = await getUncachableSendGridClient();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
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
                Nebula
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
                Verify Your Email Address
              </h2>
              
              <p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
                Hi ${data.username},
              </p>
              
              <p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
                Welcome to Nebula! To complete your registration and start using the platform, please verify your email address by clicking the button below.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center">
                    <a href="${data.verificationUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px; color: #9CA3AF; font-size: 14px; line-height: 1.6;">
                This verification link will expire in 24 hours. If you didn't create an account with Nebula, you can safely ignore this email.
              </p>
              
              <p style="margin: 0; color: #6B7280; font-size: 12px; line-height: 1.5;">
                If the button above doesn't work, copy and paste this URL into your browser:<br>
                <span style="color: #810FFB; word-break: break-all;">${data.verificationUrl}</span>
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
Hi ${data.username},

Welcome to Nebula! To complete your registration and start using the platform, please verify your email address by clicking the link below:

${data.verificationUrl}

This verification link will expire in 24 hours. If you didn't create an account with Nebula, you can safely ignore this email.

---
Powered by Synozur Alliance
© ${new Date().getFullYear()} Synozur. All rights reserved.
  `;

  await client.send({
    to: recipientEmail,
    from: fromEmail,
    subject: 'Verify Your Email - Nebula',
    text: textContent,
    html: htmlContent,
  });
}

export async function sendPasswordReset(
  recipientEmail: string,
  data: PasswordResetData
): Promise<void> {
  const { client, fromEmail } = await getUncachableSendGridClient();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
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
                Nebula
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
                Reset Your Password
              </h2>
              
              <p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
                Hi ${data.username},
              </p>
              
              <p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
                We received a request to reset the password for your Nebula account. Click the button below to create a new password.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center">
                    <a href="${data.resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px; color: #9CA3AF; font-size: 14px; line-height: 1.6;">
                This password reset link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email - your password won't be changed.
              </p>
              
              <p style="margin: 0; color: #6B7280; font-size: 12px; line-height: 1.5;">
                If the button above doesn't work, copy and paste this URL into your browser:<br>
                <span style="color: #810FFB; word-break: break-all;">${data.resetUrl}</span>
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
Hi ${data.username},

We received a request to reset the password for your Nebula account. Click the link below to create a new password:

${data.resetUrl}

This password reset link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email - your password won't be changed.

---
Powered by Synozur Alliance
© ${new Date().getFullYear()} Synozur. All rights reserved.
  `;

  await client.send({
    to: recipientEmail,
    from: fromEmail,
    subject: 'Reset Your Password - Nebula',
    text: textContent,
    html: htmlContent,
  });
}

// Helper to create email wrapper HTML
function createEmailWrapper(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
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
                Nebula
              </h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; text-align: center;">
                Collaborative Envisioning Platform
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
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
}

// Helper to format phase names for display
function formatPhaseName(phase: string): string {
  const phaseLabels: Record<string, string> = {
    'ideation': 'Ideation',
    'ideate': 'Ideation',
    'voting': 'Pairwise Voting',
    'vote': 'Pairwise Voting',
    'ranking': 'Stack Ranking',
    'rank': 'Stack Ranking',
    'marketplace': 'Marketplace',
    'survey': 'Survey',
    'priority-matrix': 'Priority Matrix',
    'staircase': 'Staircase',
    'results': 'Results',
    'closed': 'Closed',
    'open': 'Open',
  };
  return phaseLabels[phase.toLowerCase()] || phase.charAt(0).toUpperCase() + phase.slice(1);
}

// Session/Workspace invitation email
export async function sendSessionInviteEmail(
  recipientEmail: string,
  data: SessionInviteEmailData
): Promise<void> {
  const { client, fromEmail } = await getUncachableSendGridClient();

  const roleText = data.role === 'facilitator' ? 'facilitate' : 'participate in';
  const sessionInfo = data.sessionDate && data.sessionTime 
    ? `<p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
        <strong style="color: #F9FAFB;">Session Date:</strong> ${data.sessionDate} at ${data.sessionTime}
      </p>`
    : '';

  const personalMessageHtml = data.personalMessage
    ? `<div style="margin: 0 0 24px; padding: 16px; background-color: rgba(129, 15, 251, 0.1); border-radius: 6px; border: 1px solid rgba(129, 15, 251, 0.2);">
        <p style="margin: 0 0 8px; color: #9CA3AF; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
          Message from ${data.facilitatorName || 'the facilitator'}
        </p>
        <p style="margin: 0; color: #D1D5DB; font-size: 14px; line-height: 1.6;">
          ${data.personalMessage}
        </p>
      </div>`
    : '';

  const content = `
    <h2 style="margin: 0 0 24px; color: #F9FAFB; font-size: 20px; font-weight: 600;">
      You're Invited to ${roleText} a Session
    </h2>
    
    <p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
      Hi ${data.inviteeName},
    </p>
    
    <p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
      ${data.facilitatorName ? `<strong style="color: #F9FAFB;">${data.facilitatorName}</strong> has invited you` : 'You have been invited'} to ${roleText} a collaborative envisioning session.
    </p>
    
    <div style="margin: 0 0 24px; padding: 20px; background-color: #0F1115; border-left: 4px solid #810FFB; border-radius: 6px;">
      <p style="margin: 0 0 8px; color: #810FFB; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
        ${data.organizationName}
      </p>
      <p style="margin: 0; color: #F9FAFB; font-size: 18px; font-weight: 600;">
        ${data.workspaceName}
      </p>
      <p style="margin: 8px 0 0; color: #9CA3AF; font-size: 14px;">
        Code: <span style="font-family: monospace; color: #F9FAFB;">${data.workspaceCode}</span>
      </p>
    </div>
    
    ${sessionInfo}
    ${personalMessageHtml}
    
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
      <tr>
        <td align="center">
          <a href="${data.joinUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center;">
            Join Session
          </a>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; color: #6B7280; font-size: 12px; line-height: 1.5;">
      If the button above doesn't work, copy and paste this URL into your browser:<br>
      <span style="color: #810FFB; word-break: break-all;">${data.joinUrl}</span>
    </p>
  `;

  const htmlContent = createEmailWrapper(`Session Invitation - ${data.workspaceName}`, content);

  const textContent = `
Hi ${data.inviteeName},

${data.facilitatorName ? `${data.facilitatorName} has invited you` : 'You have been invited'} to ${roleText} a collaborative envisioning session.

${data.organizationName} - ${data.workspaceName}
Session Code: ${data.workspaceCode}

${data.sessionDate && data.sessionTime ? `Session Date: ${data.sessionDate} at ${data.sessionTime}\n` : ''}
${data.personalMessage ? `Message from facilitator:\n${data.personalMessage}\n` : ''}

Join the session: ${data.joinUrl}

---
Powered by Synozur Alliance
© ${new Date().getFullYear()} Synozur. All rights reserved.
  `;

  await client.send({
    to: recipientEmail,
    from: fromEmail,
    subject: `You're Invited: ${data.workspaceName} - Nebula`,
    text: textContent,
    html: htmlContent,
  });
}

// Phase change notification email
export async function sendPhaseChangeNotificationEmail(
  recipientEmail: string,
  data: PhaseChangeEmailData
): Promise<void> {
  const { client, fromEmail } = await getUncachableSendGridClient();

  const formattedPhase = formatPhaseName(data.newPhase);
  const deadlineInfo = data.deadline
    ? `<p style="margin: 20px 0 0; color: #F59E0B; font-size: 14px;">
        <strong>Deadline:</strong> ${data.deadline}
      </p>`
    : '';

  const content = `
    <h2 style="margin: 0 0 24px; color: #F9FAFB; font-size: 20px; font-weight: 600;">
      Session Update: ${formattedPhase} Phase
    </h2>
    
    <p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
      Hi ${data.participantName},
    </p>
    
    <p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
      The session <strong style="color: #F9FAFB;">${data.workspaceName}</strong> has moved to a new phase.
    </p>
    
    <div style="margin: 0 0 24px; padding: 20px; background-color: #0F1115; border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="text-align: center; flex: 1;">
          ${data.previousPhase ? `
          <p style="margin: 0 0 4px; color: #6B7280; font-size: 12px; text-transform: uppercase;">Previous</p>
          <p style="margin: 0; color: #9CA3AF; font-size: 16px;">${formatPhaseName(data.previousPhase)}</p>
          ` : ''}
        </div>
        <div style="color: #810FFB; font-size: 24px;">→</div>
        <div style="text-align: center; flex: 1;">
          <p style="margin: 0 0 4px; color: #810FFB; font-size: 12px; text-transform: uppercase;">Current</p>
          <p style="margin: 0; color: #F9FAFB; font-size: 18px; font-weight: 600;">${formattedPhase}</p>
        </div>
      </div>
      ${deadlineInfo}
    </div>
    
    <p style="margin: 0 0 24px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
      ${data.phaseDescription}
    </p>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
      <tr>
        <td align="center">
          <a href="${data.actionUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center;">
            Continue Participating
          </a>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; color: #6B7280; font-size: 12px; line-height: 1.5;">
      ${data.organizationName} - ${data.workspaceName}
    </p>
  `;

  const htmlContent = createEmailWrapper(`Phase Update - ${data.workspaceName}`, content);

  const textContent = `
Hi ${data.participantName},

The session "${data.workspaceName}" has moved to a new phase: ${formattedPhase}

${data.phaseDescription}

${data.deadline ? `Deadline: ${data.deadline}\n` : ''}

Continue participating: ${data.actionUrl}

---
${data.organizationName} - ${data.workspaceName}
Powered by Synozur Alliance
© ${new Date().getFullYear()} Synozur. All rights reserved.
  `;

  await client.send({
    to: recipientEmail,
    from: fromEmail,
    subject: `Phase Update: ${formattedPhase} - ${data.workspaceName}`,
    text: textContent,
    html: htmlContent,
  });
}

// Results available notification email
export async function sendResultsAvailableEmail(
  recipientEmail: string,
  data: ResultsReadyEmailData
): Promise<void> {
  const { client, fromEmail } = await getUncachableSendGridClient();

  const resultsDescription = data.hasPersonalizedResults
    ? 'Your personalized results from the collaborative envisioning session are now ready to view.'
    : 'The cohort results from the collaborative envisioning session are now available.';

  const content = `
    <h2 style="margin: 0 0 24px; color: #F9FAFB; font-size: 20px; font-weight: 600;">
      Your Results Are Ready
    </h2>
    
    <p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
      Hi ${data.participantName},
    </p>
    
    <p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
      ${resultsDescription}
    </p>
    
    <div style="margin: 0 0 24px; padding: 20px; background-color: #0F1115; border-left: 4px solid #10B981; border-radius: 6px;">
      <p style="margin: 0 0 8px; color: #10B981; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
        ${data.organizationName}
      </p>
      <p style="margin: 0; color: #F9FAFB; font-size: 18px; font-weight: 600;">
        ${data.workspaceName}
      </p>
    </div>
    
    <div style="margin: 0 0 24px; padding: 16px; background-color: rgba(16, 185, 129, 0.1); border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2);">
      <p style="margin: 0 0 12px; color: #F9FAFB; font-size: 14px; font-weight: 600;">Available Results:</p>
      <ul style="margin: 0; padding: 0 0 0 20px; color: #D1D5DB; font-size: 14px; line-height: 1.8;">
        ${data.hasPersonalizedResults ? '<li>Your Personalized Results & Insights</li>' : ''}
        ${data.cohortResultsAvailable ? '<li>Cohort Summary & Analysis</li>' : ''}
      </ul>
    </div>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
      <tr>
        <td align="center">
          <a href="${data.resultsUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center;">
            View Your Results
          </a>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; color: #6B7280; font-size: 12px; line-height: 1.5;">
      If the button above doesn't work, copy and paste this URL into your browser:<br>
      <span style="color: #10B981; word-break: break-all;">${data.resultsUrl}</span>
    </p>
  `;

  const htmlContent = createEmailWrapper(`Results Ready - ${data.workspaceName}`, content);

  const textContent = `
Hi ${data.participantName},

${resultsDescription}

${data.organizationName} - ${data.workspaceName}

Available Results:
${data.hasPersonalizedResults ? '- Your Personalized Results & Insights\n' : ''}${data.cohortResultsAvailable ? '- Cohort Summary & Analysis\n' : ''}

View your results: ${data.resultsUrl}

---
Powered by Synozur Alliance
© ${new Date().getFullYear()} Synozur. All rights reserved.
  `;

  await client.send({
    to: recipientEmail,
    from: fromEmail,
    subject: `Your Results Are Ready - ${data.workspaceName}`,
    text: textContent,
    html: htmlContent,
  });
}

// Workspace reminder email
export async function sendWorkspaceReminderEmail(
  recipientEmail: string,
  data: WorkspaceReminderEmailData
): Promise<void> {
  const { client, fromEmail } = await getUncachableSendGridClient();

  const reminderMessages: Record<string, { title: string; message: string; urgency: string }> = {
    'deadline_approaching': {
      title: 'Deadline Approaching',
      message: `The ${formatPhaseName(data.currentPhase)} phase for this session is ending soon. Make sure to complete your submissions before the deadline.`,
      urgency: '#F59E0B'
    },
    'incomplete_submission': {
      title: 'Incomplete Submission',
      message: `You haven't completed your participation in the ${formatPhaseName(data.currentPhase)} phase yet. Your input is valuable to the session!`,
      urgency: '#810FFB'
    },
    'session_starting': {
      title: 'Session Starting Soon',
      message: `The collaborative envisioning session is about to begin. Get ready to share your ideas!`,
      urgency: '#10B981'
    }
  };

  const reminder = reminderMessages[data.reminderType];

  const content = `
    <h2 style="margin: 0 0 24px; color: #F9FAFB; font-size: 20px; font-weight: 600;">
      ${reminder.title}
    </h2>
    
    <p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
      Hi ${data.participantName},
    </p>
    
    <p style="margin: 0 0 20px; color: #D1D5DB; font-size: 16px; line-height: 1.6;">
      ${reminder.message}
    </p>
    
    <div style="margin: 0 0 24px; padding: 20px; background-color: #0F1115; border-left: 4px solid ${reminder.urgency}; border-radius: 6px;">
      <p style="margin: 0 0 8px; color: ${reminder.urgency}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
        ${data.organizationName}
      </p>
      <p style="margin: 0 0 8px; color: #F9FAFB; font-size: 18px; font-weight: 600;">
        ${data.workspaceName}
      </p>
      <p style="margin: 0; color: #9CA3AF; font-size: 14px;">
        Current Phase: <strong style="color: #F9FAFB;">${formatPhaseName(data.currentPhase)}</strong>
      </p>
    </div>
    
    <div style="margin: 0 0 24px; padding: 16px; background-color: rgba(245, 158, 11, 0.1); border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.2);">
      <p style="margin: 0; color: #F59E0B; font-size: 14px; font-weight: 600;">
        Deadline: ${data.deadline}
      </p>
    </div>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
      <tr>
        <td align="center">
          <a href="${data.actionUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center;">
            Continue Now
          </a>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; color: #6B7280; font-size: 12px; line-height: 1.5;">
      If the button above doesn't work, copy and paste this URL into your browser:<br>
      <span style="color: #810FFB; word-break: break-all;">${data.actionUrl}</span>
    </p>
  `;

  const htmlContent = createEmailWrapper(`${reminder.title} - ${data.workspaceName}`, content);

  const textContent = `
Hi ${data.participantName},

${reminder.message}

${data.organizationName} - ${data.workspaceName}
Current Phase: ${formatPhaseName(data.currentPhase)}
Deadline: ${data.deadline}

Continue now: ${data.actionUrl}

---
Powered by Synozur Alliance
© ${new Date().getFullYear()} Synozur. All rights reserved.
  `;

  await client.send({
    to: recipientEmail,
    from: fromEmail,
    subject: `${reminder.title}: ${data.workspaceName} - Nebula`,
    text: textContent,
    html: htmlContent,
  });
}

// Bulk notification dispatcher for sending to multiple recipients
export async function sendBulkNotifications(
  type: 'phase_change' | 'results_ready' | 'reminder',
  recipients: Array<{ email: string; name: string }>,
  baseData: Partial<PhaseChangeEmailData & ResultsReadyEmailData & WorkspaceReminderEmailData>
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = { sent: 0, failed: 0, errors: [] as string[] };
  
  for (const recipient of recipients) {
    try {
      switch (type) {
        case 'phase_change':
          await sendPhaseChangeNotificationEmail(recipient.email, {
            ...baseData,
            participantName: recipient.name,
          } as PhaseChangeEmailData);
          break;
        case 'results_ready':
          await sendResultsAvailableEmail(recipient.email, {
            ...baseData,
            participantName: recipient.name,
          } as ResultsReadyEmailData);
          break;
        case 'reminder':
          await sendWorkspaceReminderEmail(recipient.email, {
            ...baseData,
            participantName: recipient.name,
          } as WorkspaceReminderEmailData);
          break;
      }
      results.sent++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Failed to send to ${recipient.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return results;
}
