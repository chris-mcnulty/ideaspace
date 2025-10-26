import { storage } from "../storage";

// Generate a unique 4-digit workspace code
export async function generateWorkspaceCode(): Promise<string> {
  const maxAttempts = 100;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate random 4-digit code (1000-9999)
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Check if code is already in use
    const existing = await storage.getSpaceByCode(code);
    if (!existing) {
      return code;
    }
  }
  
  throw new Error("Failed to generate unique workspace code after multiple attempts");
}

// Validate workspace code format
export function isValidWorkspaceCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}
