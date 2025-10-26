import { storage } from "../storage";

// Generate a unique 8-digit workspace code in format nnnn-nnnn
export async function generateWorkspaceCode(): Promise<string> {
  const maxAttempts = 100;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate two random 4-digit segments
    const segment1 = Math.floor(1000 + Math.random() * 9000).toString();
    const segment2 = Math.floor(1000 + Math.random() * 9000).toString();
    const code = `${segment1}-${segment2}`;
    
    // Check if code is already in use
    const existing = await storage.getSpaceByCode(code);
    if (!existing) {
      return code;
    }
  }
  
  throw new Error("Failed to generate unique workspace code after multiple attempts");
}

// Validate workspace code format (nnnn-nnnn)
export function isValidWorkspaceCode(code: string): boolean {
  return /^\d{4}-\d{4}$/.test(code);
}
