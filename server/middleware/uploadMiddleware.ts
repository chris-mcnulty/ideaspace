import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { Request } from 'express';

// Configure allowed file types
const ALLOWED_IMAGE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg']
};

// File size limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_FILE_SIZE = 100; // 100 bytes minimum

// Generate secure random filename
function generateSecureFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const hash = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return `${timestamp}-${hash}${ext}`;
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Store in temp directory first for processing
    const tempDir = path.join(process.cwd(), 'uploads/temp');
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const secureFilename = generateSecureFilename(file.originalname);
    cb(null, secureFilename);
  }
});

// File filter to validate uploads
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type
  if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG images are allowed.'));
    return;
  }
  
  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ALLOWED_IMAGE_TYPES[file.mimetype];
  if (!allowedExts.includes(ext)) {
    cb(new Error('File extension does not match MIME type.'));
    return;
  }
  
  // Check for double extensions or suspicious patterns
  const filename = path.basename(file.originalname);
  if (filename.includes('..') || filename.includes('\0')) {
    cb(new Error('Invalid filename detected.'));
    return;
  }
  
  // Additional check for suspicious extensions after the allowed one
  const nameWithoutExt = filename.slice(0, -ext.length);
  const suspiciousExts = ['.php', '.js', '.exe', '.sh', '.asp', '.jsp'];
  if (suspiciousExts.some(suspExt => nameWithoutExt.toLowerCase().endsWith(suspExt))) {
    cb(new Error('Potentially malicious filename detected.'));
    return;
  }
  
  cb(null, true);
};

// Create multer upload instance
export const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5, // Max 5 files per upload
    fields: 10, // Max 10 fields
    headerPairs: 100 // Limit header pairs to prevent header bombs
  }
});

// Middleware to validate file after upload (magic bytes check)
export async function validateImageFile(filePath: string): Promise<boolean> {
  const fs = await import('fs/promises');
  
  try {
    // Check file size first
    const stats = await fs.stat(filePath);
    if (stats.size < MIN_FILE_SIZE) {
      console.error(`File too small: ${stats.size} bytes (minimum: ${MIN_FILE_SIZE})`);
      return false;
    }
    
    // Read only first 12 bytes to check magic numbers
    const fileHandle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(12);
    await fileHandle.read(buffer, 0, 12, 0);
    await fileHandle.close();
    
    // Magic byte signatures for different image formats
    const signatures = {
      jpeg: [0xFF, 0xD8, 0xFF],
      png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
      gif87a: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
      gif89a: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
      webp: [0x52, 0x49, 0x46, 0x46], // RIFF header
      svg: [0x3C, 0x73, 0x76, 0x67] // <svg
    };
    
    // Check JPEG
    if (buffer[0] === signatures.jpeg[0] && 
        buffer[1] === signatures.jpeg[1] && 
        buffer[2] === signatures.jpeg[2]) {
      return true;
    }
    
    // Check PNG
    if (signatures.png.every((byte, i) => buffer[i] === byte)) {
      return true;
    }
    
    // Check GIF
    if ((signatures.gif87a.every((byte, i) => buffer[i] === byte)) ||
        (signatures.gif89a.every((byte, i) => buffer[i] === byte))) {
      return true;
    }
    
    // Check WebP (RIFF header + WEBP signature)
    if (signatures.webp.every((byte, i) => buffer[i] === byte) &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && 
        buffer[10] === 0x42 && buffer[11] === 0x50) {
      return true;
    }
    
    // Check SVG (text-based, check for <svg)
    const text = buffer.toString('utf8', 0, 4);
    if (text === '<svg' || text.startsWith('<?xml')) {
      // Additional validation for SVG to prevent XSS
      const fullContent = await fs.readFile(filePath, 'utf8');
      return await validateSvgContent(fullContent);
    }
    
    return false;
  } catch (error) {
    console.error('Error validating image file:', error);
    return false;
  }
}

// Validate SVG content for security
async function validateSvgContent(svgContent: string): Promise<boolean> {
  // Import sanitize-html for Node-compatible SVG sanitization
  const sanitizeHtml = (await import('sanitize-html')).default;
  
  // Configure strict SVG allowlist
  const clean = sanitizeHtml(svgContent, {
    allowedTags: [
      'svg', 'g', 'circle', 'ellipse', 'line', 'path', 'polygon', 
      'polyline', 'rect', 'defs', 'clipPath', 'linearGradient',
      'radialGradient', 'stop', 'text', 'tspan', 'use', 'image',
      'pattern', 'mask', 'filter', 'feGaussianBlur', 'feColorMatrix',
      'feOffset', 'feMerge', 'feMergeNode', 'title', 'desc', 'metadata'
    ],
    allowedAttributes: {
      '*': [
        'id', 'class', 'style', 'transform', 'fill', 'stroke', 
        'stroke-width', 'stroke-linecap', 'stroke-linejoin',
        'fill-opacity', 'stroke-opacity', 'opacity'
      ],
      'svg': ['width', 'height', 'viewBox', 'xmlns', 'preserveAspectRatio'],
      'circle': ['cx', 'cy', 'r'],
      'ellipse': ['cx', 'cy', 'rx', 'ry'],
      'line': ['x1', 'y1', 'x2', 'y2'],
      'rect': ['x', 'y', 'width', 'height', 'rx', 'ry'],
      'path': ['d'],
      'polygon': ['points'],
      'polyline': ['points'],
      'text': ['x', 'y', 'dx', 'dy', 'font-size', 'font-family', 'text-anchor'],
      'tspan': ['x', 'y', 'dx', 'dy'],
      'linearGradient': ['x1', 'y1', 'x2', 'y2', 'gradientUnits'],
      'radialGradient': ['cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits'],
      'stop': ['offset', 'stop-color', 'stop-opacity'],
      'use': ['href', 'xlink:href', 'x', 'y', 'width', 'height'],
      'image': ['href', 'xlink:href', 'x', 'y', 'width', 'height', 'preserveAspectRatio'],
      'title': [],
      'desc': [],
      'metadata': []
    },
    allowedStyles: {
      '*': {
        'fill': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
        'stroke': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
        'stroke-width': [/^\d+(\.\d+)?(px|em|%)?$/],
        'opacity': [/^[0-1](\.\d+)?$/],
        'fill-opacity': [/^[0-1](\.\d+)?$/],
        'stroke-opacity': [/^[0-1](\.\d+)?$/]
      }
    },
    // Disallow scripts and dangerous elements
    disallowedTagsMode: 'discard',
    // Remove empty tags
    exclusiveFilter: function(frame) {
      return frame.tag === 'script' || frame.tag === 'iframe' || frame.tag === 'object' ||
             frame.tag === 'embed' || frame.tag === 'link' || frame.tag === 'form' ||
             frame.tag === 'input';
    }
  });
  
  // If content was modified by sanitization, it contained dangerous elements
  return clean === svgContent;
}

// Clean up temporary files on error
export async function cleanupTempFile(filePath: string) {
  const fs = await import('fs/promises');
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Error cleaning up temp file:', error);
  }
}

// Ensure upload directories exist
export async function ensureUploadDirs() {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const dirs = [
    path.join(process.cwd(), 'uploads/temp'),
    path.join(process.cwd(), 'uploads/ideas/images'),
    path.join(process.cwd(), 'uploads/ideas/thumbnails')
  ];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error(`Error creating directory ${dir}:`, error);
    }
  }
}

// Rate limiting configuration (to be used with express-rate-limit)
export const uploadRateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 uploads per windowMs
  message: 'Too many uploads from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
};