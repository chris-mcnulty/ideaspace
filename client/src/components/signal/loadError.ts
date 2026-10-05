// Query errors currently include the HTTP status followed by the JSON body.
// Never interpret a rejected request as an empty/not-yet-started session.
export function signalLoadErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  let code: string | undefined;
  try {
    const jsonStart = message.indexOf('{');
    if (jsonStart >= 0) code = JSON.parse(message.slice(jsonStart)).code;
  } catch {
    // Network errors and non-JSON responses use the generic retry message.
  }
  switch (code) {
    case 'GUEST_ACCESS_DISABLED':
    case 'GUEST_ACCESS_REVOKED':
      return 'Guest access is disabled for this workspace. Ask the facilitator to enable guest access, or sign in with an account that has access.';
    case 'NO_ACCESS':
      return 'Your participant session does not have access to this workspace. Rejoin the workspace using its join code or link.';
    case 'WORKSPACE_CLOSED':
      return 'This workspace is closed. Ask the facilitator to reopen it.';
    case 'WORKSPACE_NOT_OPEN':
      return 'This workspace is not open for participation. Ask the facilitator to open it.';
    default:
      return 'Could not load the current question. Check your connection and try again. This does not mean the facilitator has stopped the question.';
  }
}
