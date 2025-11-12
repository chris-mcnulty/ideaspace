import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

// Content type detection
export function detectContentType(content: string): 'text' | 'markdown' | 'html' {
  // Check for markdown indicators
  const markdownPatterns = [
    /^#{1,6}\s/m,  // Headers
    /\*\*[^*]+\*\*/,  // Bold
    /\[[^\]]+\]\([^)]+\)/,  // Links
    /^[\*\-]\s/m,  // Lists
    /^>\s/m,  // Blockquotes
    /```[\s\S]*```/  // Code blocks
  ];
  
  if (markdownPatterns.some(pattern => pattern.test(content))) {
    return 'markdown';
  }
  
  // Check for HTML tags
  if (/<[^>]+>/.test(content)) {
    return 'html';
  }
  
  return 'text';
}

// Extract plain text from rich content
export function extractPlainText(content: string, contentType: string): string {
  switch (contentType) {
    case 'markdown':
      // Convert markdown to HTML first, then strip tags
      const html = marked(content) as string;
      return stripHtmlTags(html);
    
    case 'html':
      return stripHtmlTags(content);
    
    case 'image':
      // For image ideas, return the caption/alt text if available
      return content || '[Image]';
    
    default:
      return content;
  }
}

// Strip HTML tags and get plain text
function stripHtmlTags(html: string): string {
  // Use DOMPurify to safely parse HTML
  const cleaned = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
  // Replace multiple whitespaces with single space and trim
  return cleaned.replace(/\s+/g, ' ').trim();
}

// Sanitize HTML content to prevent XSS
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'blockquote',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'code', 'pre',
      'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

// Generate unique filename for uploaded files
export function generateUniqueFilename(originalName: string): string {
  const ext = path.extname(originalName);
  const hash = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();
  return `${timestamp}-${hash}${ext}`;
}

// Process uploaded image: validate, resize, generate thumbnail
export async function processUploadedImage(
  filePath: string,
  originalName: string
): Promise<{
  mainUrl: string;
  thumbnailUrl: string;
  metadata: {
    width: number;
    height: number;
    size: number;
    originalName: string;
    mimeType: string;
  };
}> {
  const uploadsDir = path.join(process.cwd(), 'uploads/ideas');
  const uniqueName = generateUniqueFilename(originalName);
  
  // Paths for main image and thumbnail
  const mainImagePath = path.join(uploadsDir, 'images', uniqueName);
  const thumbnailPath = path.join(uploadsDir, 'thumbnails', `thumb-${uniqueName}`);
  
  // Process the image with sharp
  const image = sharp(filePath);
  const metadata = await image.metadata();
  
  // Validate image
  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid image file');
  }
  
  // Determine output format based on input
  const format = metadata.format || 'jpeg';
  const isTransparent = format === 'png' || format === 'webp' || format === 'gif';
  
  // Save main image (resize if too large, max 2000px wide)
  let pipeline = image.resize(2000, null, {
    withoutEnlargement: true,
    fit: 'inside'
  });
  
  // Apply format-specific optimization
  if (format === 'png') {
    pipeline = pipeline.png({ quality: 85, compressionLevel: 9 });
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality: 85, lossless: false });
  } else if (format === 'gif') {
    // GIF remains as-is for animation support
    pipeline = pipeline.gif();
  } else {
    // Default to JPEG for other formats
    pipeline = pipeline.jpeg({ quality: 85, progressive: true });
  }
  
  await pipeline.toFile(mainImagePath);
  
  // Generate thumbnail (300px wide) - preserve format for transparency
  let thumbPipeline = sharp(filePath).resize(300, null, {
    withoutEnlargement: true,
    fit: 'inside'
  });
  
  if (isTransparent) {
    // Preserve transparency in thumbnails
    if (format === 'png') {
      thumbPipeline = thumbPipeline.png({ quality: 80 });
    } else if (format === 'webp') {
      thumbPipeline = thumbPipeline.webp({ quality: 80 });
    } else {
      thumbPipeline = thumbPipeline.gif();
    }
  } else {
    thumbPipeline = thumbPipeline.jpeg({ quality: 80 });
  }
  
  await thumbPipeline.toFile(thumbnailPath);
  
  // Get file size
  const stats = await fs.stat(mainImagePath);
  
  return {
    mainUrl: `/uploads/ideas/images/${uniqueName}`,
    thumbnailUrl: `/uploads/ideas/thumbnails/thumb-${uniqueName}`,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      size: stats.size,
      originalName,
      mimeType: `image/${metadata.format}`
    }
  };
}

// Convert markdown to HTML
export function markdownToHtml(markdown: string): string {
  const html = marked(markdown) as string;
  return sanitizeHtml(html);
}

// Validate content length
export function validateContentLength(content: string, maxLength: number = 5000): boolean {
  const plainText = extractPlainText(content, detectContentType(content));
  return plainText.length <= maxLength;
}