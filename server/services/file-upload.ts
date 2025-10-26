import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export interface UploadedFile {
  filename: string;
  originalName: string;
  filePath: string;
  size: number;
  mimeType: string;
}

export class FileUploadService {
  async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(UPLOAD_DIR);
    } catch {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }
  }

  generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    const randomSuffix = randomBytes(8).toString("hex");
    const timestamp = Date.now();
    return `${base}-${timestamp}-${randomSuffix}${ext}`;
  }

  async saveFile(buffer: Buffer, originalName: string, mimeType: string): Promise<UploadedFile> {
    await this.ensureUploadDirectory();
    
    const filename = this.generateUniqueFilename(originalName);
    const filePath = path.join(UPLOAD_DIR, filename);
    
    await fs.writeFile(filePath, buffer);
    
    return {
      filename,
      originalName,
      filePath,
      size: buffer.length,
      mimeType,
    };
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error("Error deleting file:", error);
      return false;
    }
  }

  async readFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  async getFileStats(filePath: string): Promise<{ size: number; mtime: Date } | null> {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        mtime: stats.mtime,
      };
    } catch (error) {
      console.error("Error getting file stats:", error);
      return null;
    }
  }
}

export const fileUploadService = new FileUploadService();
