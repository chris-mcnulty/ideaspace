/**
 * Utility functions for handling workspace access control errors
 */

export interface AccessControlError {
  error: string;
  code?: string;
}

export function getAccessControlErrorMessage(error: any): string | null {
  // Try to parse the error response
  let errorData: AccessControlError | null = null;
  
  if (error?.message) {
    try {
      errorData = JSON.parse(error.message);
    } catch {
      // Not JSON, might be direct error object
      if (typeof error === 'object' && error.code) {
        errorData = error as AccessControlError;
      }
    }
  }

  if (!errorData?.code) {
    return null; // Not an access control error
  }

  // Map error codes to user-friendly messages
  switch (errorData.code) {
    case 'WORKSPACE_CLOSED':
      return 'This workspace has been closed by the facilitator. You can no longer access this section.';
    
    case 'WORKSPACE_NOT_OPEN':
      return 'This workspace is not currently open for participation. Please wait for the facilitator to open it.';
    
    case 'GUEST_ACCESS_DISABLED':
      return 'Guest access is not allowed for this workspace. Please contact the facilitator for access.';
    
    case 'GUEST_ACCESS_REVOKED':
      return 'Guest access has been disabled for this workspace. Please contact the facilitator if you need continued access.';
    
    case 'NO_ACCESS':
      return 'You do not have access to this workspace. Please verify you joined the correct workspace.';
    
    default:
      return null; // Unknown access control error
  }
}

export function isAccessControlError(error: any): boolean {
  try {
    if (error?.message) {
      const errorData = JSON.parse(error.message);
      return !!errorData?.code && [
        'WORKSPACE_CLOSED',
        'WORKSPACE_NOT_OPEN',
        'GUEST_ACCESS_DISABLED',
        'GUEST_ACCESS_REVOKED',
        'NO_ACCESS'
      ].includes(errorData.code);
    }
    if (typeof error === 'object' && error?.code) {
      return [
        'WORKSPACE_CLOSED',
        'WORKSPACE_NOT_OPEN',
        'GUEST_ACCESS_DISABLED',
        'GUEST_ACCESS_REVOKED',
        'NO_ACCESS'
      ].includes(error.code);
    }
  } catch {
    return false;
  }
  return false;
}
