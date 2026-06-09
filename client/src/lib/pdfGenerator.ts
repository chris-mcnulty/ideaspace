import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CohortResult, PersonalizedResult } from '@shared/schema';

interface BrandingConfig {
  orgName: string;
  orgLogo?: string;
  primaryColor?: string; // Hex color
}

export interface BoardNoteData {
  id: string;
  text: string;
  xCoord: number; // 0-100
  yCoord: number; // 0-100
  zone?: string;
  color: string;
}

export interface BoardPageData {
  type: 'starship' | 'matrix';
  title: string;
  notes: BoardNoteData[];
  starshipLabels?: { thrust: string; destination: string; drag: string };
  matrixLabels?: { xAxis: string; yAxis: string };
}

// Font cache - stores base64 font data after first load
let fontCache: {
  regular: string | null;
  bold: string | null;
} = {
  regular: null,
  bold: null,
};
let fontLoadPromise: Promise<void> | null = null;

/**
 * Load Avenir Next LT Pro fonts and cache them
 * Only fetches fonts once, then reuses cached base64 data
 */
async function loadFontData(): Promise<void> {
  if (fontCache.regular && fontCache.bold) {
    return; // Already loaded
  }

  if (fontLoadPromise) {
    return fontLoadPromise;
  }

  fontLoadPromise = (async () => {
    try {
      // Load both Regular and Bold font files
      const [regularResponse, boldResponse] = await Promise.all([
        fetch('/fonts/AvenirNextLTPro-Regular.ttf'),
        fetch('/fonts/AvenirNextLTPro-Bold.ttf'),
      ]);

      // Check responses
      if (!regularResponse.ok || !boldResponse.ok) {
        throw new Error('Failed to fetch font files');
      }

      const [regularArrayBuffer, boldArrayBuffer] = await Promise.all([
        regularResponse.arrayBuffer(),
        boldResponse.arrayBuffer(),
      ]);

      // Convert to base64 and cache
      fontCache.regular = arrayBufferToBase64(regularArrayBuffer);
      fontCache.bold = arrayBufferToBase64(boldArrayBuffer);
    } catch (error) {
      console.error('Failed to load Avenir fonts, falling back to Helvetica:', error);
      // Reset promise so we can retry next time
      fontLoadPromise = null;
      throw error;
    }
  })();

  return fontLoadPromise;
}

/**
 * Register cached fonts with a jsPDF instance
 * Must be called for each new jsPDF document
 */
function registerFontsOnDocument(doc: jsPDF): boolean {
  if (!fontCache.regular || !fontCache.bold) {
    return false; // Fonts not loaded
  }

  try {
    // Register fonts on this specific jsPDF instance
    doc.addFileToVFS('AvenirNextLTPro-Regular.ttf', fontCache.regular);
    doc.addFont('AvenirNextLTPro-Regular.ttf', 'Avenir Next LT Pro', 'normal');

    doc.addFileToVFS('AvenirNextLTPro-Bold.ttf', fontCache.bold);
    doc.addFont('AvenirNextLTPro-Bold.ttf', 'Avenir Next LT Pro', 'bold');

    return true;
  } catch (error) {
    console.error('Failed to register fonts on jsPDF instance:', error);
    return false;
  }
}

/**
 * Load and register Avenir Next LT Pro fonts with jsPDF
 * This fetches fonts once and registers them on the provided document
 */
async function loadAvenirFonts(doc: jsPDF): Promise<boolean> {
  try {
    // Load font data (cached after first call)
    await loadFontData();
    
    // Register fonts on this specific document
    return registerFontsOnDocument(doc);
  } catch (error) {
    // Font loading failed, will use fallback
    return false;
  }
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Set brand font (Avenir Next LT Pro)
 * Uses cached flag to determine if fonts are available on this document
 */
function setBrandFont(doc: jsPDF, bold: boolean = false, fontsAvailable: boolean = false) {
  if (fontsAvailable) {
    doc.setFont('Avenir Next LT Pro', bold ? 'bold' : 'normal');
  } else {
    // Fallback to Helvetica if fonts not loaded
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
  }
}

/**
 * Convert hex color to RGB values for jsPDF
 */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [139, 92, 246]; // Default purple
}

/**
 * Add branded header to PDF
 */
async function addBrandedHeader(
  doc: jsPDF,
  branding: BrandingConfig,
  title: string,
  fontsAvailable: boolean
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const primaryRgb = branding.primaryColor
    ? hexToRgb(branding.primaryColor)
    : [139, 92, 246];

  // Add Synozur logo (from public directory)
  try {
    const logoResponse = await fetch('/logos/synozur-horizontal-color.png');
    const logoBlob = await logoResponse.blob();
    const logoData = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(logoBlob);
    });
    doc.addImage(logoData, 'PNG', 15, 15, 30, 15);
  } catch (error) {
    console.error('Failed to load Synozur logo:', error);
  }

  // Add "Nebula by Synozur | Collaborative Envisioning" branding
  setBrandFont(doc, true, fontsAvailable);
  doc.setFontSize(12);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text('Nebula by Synozur | Collaborative Envisioning', 50, 22);

  // Add title
  setBrandFont(doc, true, fontsAvailable);
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.text(title, 15, 45);

  // Add horizontal line
  doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.setLineWidth(0.5);
  doc.line(15, 50, pageWidth - 15, 50);

  return 55; // Return Y position for content to start
}

/**
 * Add footer to PDF
 */
function addFooter(doc: jsPDF, branding: BrandingConfig, fontsAvailable: boolean) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  setBrandFont(doc, false, fontsAvailable);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  
  // First line: "Powered by Nebula | The Synozur Alliance"
  doc.text(
    'Powered by Nebula | The Synozur Alliance',
    pageWidth / 2,
    pageHeight - 15,
    { align: 'center' }
  );
  
  // Second line: URLs
  doc.text(
    'nebula.synozur.com | www.synozur.com',
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );
}

/**
 * Draw a single board (Starship or Priority Matrix) onto a new jsPDF page
 * using drawing primitives so no canvas/HTML element is needed.
 */
function drawBoardPage(
  doc: jsPDF,
  board: BoardPageData,
  branding: BrandingConfig,
  fontsAvailable: boolean
): void {
  doc.addPage();

  const pageWidth = doc.internal.pageSize.getWidth();
  const primaryRgb = branding.primaryColor ? hexToRgb(branding.primaryColor) : [139, 92, 246];

  // Page title
  setBrandFont(doc, true, fontsAvailable);
  doc.setFontSize(16);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(board.title, 15, 20);

  // Board area: left=15, top=28, width=180, height=120 (mm)
  const BX = 15;
  const BY = 28;
  const BW = pageWidth - 30;
  const BH = 120;

  // Outer border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.rect(BX, BY, BW, BH);

  if (board.type === 'starship') {
    const labels = board.starshipLabels ?? { thrust: 'Propulsion', destination: 'Destinations', drag: 'Black Holes' };

    // Zone widths/heights in mm
    const thrustW = BW * 0.60;
    const destX = BX + thrustW;
    const destW = BW * 0.40;
    const thrustH = BH * 0.60;
    const dragY = BY + thrustH;
    const dragH = BH * 0.40;

    // Thrust zone (upper-left, blue)
    doc.setFillColor(219, 234, 254); // blue-100
    doc.setDrawColor(147, 197, 253); // blue-300
    doc.setLineWidth(0.3);
    doc.rect(BX, BY, thrustW, thrustH, 'FD');

    // Destination zone (right, green)
    doc.setFillColor(209, 250, 229); // emerald-100
    doc.setDrawColor(110, 231, 183); // emerald-300
    doc.rect(destX, BY, destW, BH, 'FD');

    // Drag zone (lower-left, red)
    doc.setFillColor(254, 226, 226); // red-100
    doc.setDrawColor(252, 165, 165); // red-300
    doc.rect(BX, dragY, thrustW, dragH, 'FD');

    // Zone labels
    setBrandFont(doc, true, fontsAvailable);
    doc.setFontSize(7);

    doc.setTextColor(37, 99, 235); // blue-600
    doc.text(labels.thrust, BX + 2, BY + 5);

    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text(labels.destination, destX + 2, BY + 5);

    doc.setTextColor(220, 38, 38); // red-600
    doc.text(labels.drag, BX + 2, dragY + dragH - 2);

    // Notes
    board.notes.forEach((note) => {
      const nx = BX + (note.xCoord / 100) * BW;
      const ny = BY + (note.yCoord / 100) * BH;
      drawNoteChip(doc, note, nx, ny, fontsAvailable);
    });

  } else {
    // Priority Matrix
    const mLabels = board.matrixLabels ?? { xAxis: 'Impact', yAxis: 'Effort' };

    // Quadrant lines
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.5);
    doc.line(BX + BW / 2, BY, BX + BW / 2, BY + BH); // vertical
    doc.line(BX, BY + BH / 2, BX + BW, BY + BH / 2); // horizontal

    // Axis labels (outside the board area)
    setBrandFont(doc, false, fontsAvailable);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);

    // Top: High yAxis
    doc.text(`High ${mLabels.yAxis}`, BX + BW / 2, BY - 2, { align: 'center' });
    // Bottom: Low yAxis
    doc.text(`Low ${mLabels.yAxis}`, BX + BW / 2, BY + BH + 4, { align: 'center' });
    // Left: Low xAxis
    doc.text(`Low ${mLabels.xAxis}`, BX - 1, BY + BH / 2, { align: 'right' });
    // Right: High xAxis
    doc.text(`High ${mLabels.xAxis}`, BX + BW + 1, BY + BH / 2);

    // Quadrant corner labels
    doc.setFontSize(6);
    doc.setTextColor(130, 130, 130);
    doc.text(`Low ${mLabels.xAxis} / High ${mLabels.yAxis}`, BX + 2, BY + 4);
    doc.text(`High ${mLabels.xAxis} / High ${mLabels.yAxis}`, BX + BW - 2, BY + 4, { align: 'right' });
    doc.text(`Low ${mLabels.xAxis} / Low ${mLabels.yAxis}`, BX + 2, BY + BH - 2);
    doc.text(`High ${mLabels.xAxis} / Low ${mLabels.yAxis}`, BX + BW - 2, BY + BH - 2, { align: 'right' });

    // Notes — yCoord: 0=bottom, 100=top → screen top = 100-y
    board.notes.forEach((note) => {
      const nx = BX + (note.xCoord / 100) * BW;
      const ny = BY + ((100 - note.yCoord) / 100) * BH;
      drawNoteChip(doc, note, nx, ny, fontsAvailable);
    });
  }

  // Note count
  setBrandFont(doc, false, fontsAvailable);
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`${board.notes.length} note${board.notes.length !== 1 ? 's' : ''} placed`, BX, BY + BH + 8);
}

/**
 * Draw a small rounded note chip at a given position on the PDF page.
 * The chip is centered on (cx, cy).
 */
function drawNoteChip(
  doc: jsPDF,
  note: BoardNoteData,
  cx: number,
  cy: number,
  fontsAvailable: boolean
): void {
  const chipW = 22;
  const chipH = 5;
  const chipX = cx - chipW / 2;
  const chipY = cy - chipH / 2;

  // Parse note color (hex) for background
  let r = 139, g = 92, b = 246;
  try {
    const rgb = hexToRgb(note.color);
    [r, g, b] = rgb;
  } catch {
    // use default
  }

  // Background
  doc.setFillColor(r, g, b);
  doc.setDrawColor(r, g, b);
  doc.roundedRect(chipX, chipY, chipW, chipH, 1, 1, 'F');

  // Text (white, truncated)
  setBrandFont(doc, false, fontsAvailable);
  doc.setFontSize(5);
  doc.setTextColor(255, 255, 255);

  const maxChars = 22;
  const displayText = note.text.length > maxChars ? note.text.slice(0, maxChars - 1) + '…' : note.text;
  doc.text(displayText, cx, cy + 0.8, { align: 'center', baseline: 'middle' });
}

/**
 * Generate branded PDF for cohort results
 */
export async function generateCohortResultsPDF(
  cohortResult: CohortResult,
  branding: BrandingConfig,
  workspaceName: string,
  projectName?: string,
  boards?: BoardPageData[],
  includeBoards?: boolean
): Promise<void> {
  const doc = new jsPDF();
  
  // Load Avenir fonts first
  const fontsAvailable = await loadAvenirFonts(doc);
  
  const primaryRgb = branding.primaryColor
    ? hexToRgb(branding.primaryColor)
    : [139, 92, 246];

  // Add header
  let yPos = await addBrandedHeader(doc, branding, 'Cohort Results', fontsAvailable);

  // Add workspace / project info
  setBrandFont(doc, false, fontsAvailable);
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  if (projectName) {
    doc.text(`Project: ${projectName}`, 15, yPos + 5);
    doc.text(`Workspace: ${workspaceName}`, 15, yPos + 12);
    yPos += 22;
  } else {
    doc.text(`Workspace: ${workspaceName}`, 15, yPos + 5);
    yPos += 15;
  }

  // Add summary section
  setBrandFont(doc, true, fontsAvailable);
  doc.setFontSize(14);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text('Executive Summary', 15, yPos);
  yPos += 10;

  setBrandFont(doc, false, fontsAvailable);
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40); // Darker text for better contrast
  
  // Split summary into paragraphs for better readability
  const summaryParagraphs = (cohortResult.summary || '').split(/\n\n|\.\s+(?=[A-Z])/);
  summaryParagraphs.forEach((paragraph, index) => {
    if (paragraph.trim()) {
      const paragraphText = paragraph.trim() + (paragraph.trim().endsWith('.') ? '' : '.');
      const summaryLines = doc.splitTextToSize(
        paragraphText,
        doc.internal.pageSize.getWidth() - 30
      );
      doc.text(summaryLines, 15, yPos);
      yPos += summaryLines.length * 5 + (index < summaryParagraphs.length - 1 ? 8 : 0);
      
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }
    }
  });
  yPos += 12;

  // Add key themes
  const keyThemes = cohortResult.keyThemes as string[] | undefined;
  if (keyThemes && keyThemes.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    setBrandFont(doc, true, fontsAvailable);
    doc.setFontSize(14);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('Key Themes', 15, yPos);
    yPos += 10;

    setBrandFont(doc, false, fontsAvailable);
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40); // Darker text for better contrast
    keyThemes.forEach((theme) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`• ${theme}`, 20, yPos);
      yPos += 7; // Increased spacing between items
    });
    yPos += 8;
  }

  // Add top ideas table
  const topIdeas = cohortResult.topIdeas as Array<{
    rank?: number;
    overallRank?: number;
    content: string;
    category?: string;
    pairwiseWins?: number;
    bordaScore?: number;
    marketplaceCoins?: number;
  }> | undefined;
  
  if (topIdeas && topIdeas.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    setBrandFont(doc, true, fontsAvailable);
    doc.setFontSize(14);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('Top Ideas', 15, yPos);
    yPos += 5;

    const tableData = topIdeas.slice(0, 10).map((idea) => [
      String(idea.rank || idea.overallRank || '-'),
      idea.content,
      idea.category || 'Uncategorized',
      String(idea.pairwiseWins || 0),
      String(idea.bordaScore || 0),
      String(idea.marketplaceCoins || 0),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Rank', 'Idea', 'Category', 'Wins', 'Borda', 'Coins']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [primaryRgb[0], primaryRgb[1], primaryRgb[2]],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        font: fontsAvailable ? 'Avenir Next LT Pro' : 'helvetica',
      },
      bodyStyles: {
        fontSize: 8,
        font: fontsAvailable ? 'Avenir Next LT Pro' : 'helvetica',
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 70 },
        2: { cellWidth: 35 },
        3: { cellWidth: 15 },
        4: { cellWidth: 15 },
        5: { cellWidth: 15 },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Add insights
  if (cohortResult.insights) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    setBrandFont(doc, true, fontsAvailable);
    doc.setFontSize(14);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('Key Insights', 15, yPos);
    yPos += 10;

    setBrandFont(doc, false, fontsAvailable);
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40); // Darker text for better contrast
    
    // Split insights into paragraphs for better readability
    // Handle both double newlines and numbered points
    const paragraphs = cohortResult.insights.split(/\n\n+|\n(?=\d+\.\s)|(?<=\.)\s+(?=\d+\.)/);
    paragraphs.forEach((paragraph, index) => {
      const trimmedPara = paragraph.trim();
      if (!trimmedPara) return;
      
      // Check if this is a numbered point
      const isNumberedPoint = /^\d+\.\s/.test(trimmedPara);
      const xPos = isNumberedPoint ? 20 : 15;
      
      const insightLines = doc.splitTextToSize(
        trimmedPara,
        doc.internal.pageSize.getWidth() - (isNumberedPoint ? 35 : 30)
      );
      doc.text(insightLines, xPos, yPos);
      yPos += insightLines.length * 5 + 10; // More spacing between paragraphs
      
      // Check if we need a new page
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
    });
    yPos += 5;
  }

  // Add recommendations
  if (cohortResult.recommendations) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    setBrandFont(doc, true, fontsAvailable);
    doc.setFontSize(14);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('Recommendations', 15, yPos);
    yPos += 10;

    setBrandFont(doc, false, fontsAvailable);
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40); // Darker text for better contrast
    
    // Parse recommendations - handle numbered lists, bullet points, and paragraphs
    // Split on double newlines, or before numbered items
    const recItems = cohortResult.recommendations
      .split(/\n\n+|\n(?=\d+\.\s)|(?<=\.)\s+(?=\d+\.)/)
      .filter((item: string) => item.trim());
    
    recItems.forEach((item: string) => {
      const trimmedItem = item.trim();
      if (!trimmedItem) return;
      
      // Check if this is a numbered point
      const isNumberedPoint = /^\d+\.\s/.test(trimmedItem);
      // Check if this starts with a bullet
      const isBulletPoint = /^[-•]\s/.test(trimmedItem);
      
      let xPos = 15;
      let displayText = trimmedItem;
      
      if (isNumberedPoint) {
        xPos = 20;
      } else if (isBulletPoint) {
        xPos = 20;
      } else if (!isNumberedPoint && !isBulletPoint && recItems.length > 1) {
        // Convert regular paragraphs to bullet points if there are multiple items
        displayText = `• ${trimmedItem}`;
        xPos = 20;
      }
      
      const recLines = doc.splitTextToSize(
        displayText,
        doc.internal.pageSize.getWidth() - (xPos + 15)
      );
      doc.text(recLines, xPos, yPos);
      yPos += recLines.length * 5 + 10; // More spacing between items
      
      // Check if we need a new page
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
    });
  }

  // Add Signal (Live Interaction) section
  type SignalEntry = {
    type: string;
    prompt: string;
    responseCount: number;
    wordFreqs?: Array<{ word: string; count: number }>;
    optionCounts?: Array<{ label: string; count: number }>;
    numericMean?: number;
    numericCount?: number;
  };
  const signalSummary = (cohortResult as any).signalSummary as SignalEntry[] | null | undefined;
  if (signalSummary && signalSummary.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    setBrandFont(doc, true, fontsAvailable);
    doc.setFontSize(14);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('Live Interaction Results', 15, yPos);
    yPos += 10;

    for (const activity of signalSummary) {
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      }

      // Activity sub-heading
      setBrandFont(doc, true, fontsAvailable);
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      const typeLabel = activity.type === 'word-cloud'
        ? 'Word Cloud'
        : activity.type === 'multiple-choice'
          ? 'Multiple Choice'
          : 'Numeric';
      const subHeading = `${typeLabel}: ${activity.prompt}`;
      const subHeadLines = doc.splitTextToSize(subHeading, doc.internal.pageSize.getWidth() - 30);
      doc.text(subHeadLines, 15, yPos);
      yPos += subHeadLines.length * 5 + 2;

      setBrandFont(doc, false, fontsAvailable);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`${activity.responseCount} response(s)`, 15, yPos);
      yPos += 7;

      if (activity.type === 'word-cloud' && activity.wordFreqs && activity.wordFreqs.length > 0) {
        const tableData = activity.wordFreqs.slice(0, 15).map((w) => [w.word, String(w.count)]);
        autoTable(doc, {
          startY: yPos,
          head: [['Word', 'Count']],
          body: tableData,
          theme: 'striped',
          headStyles: {
            fillColor: [primaryRgb[0], primaryRgb[1], primaryRgb[2]],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            font: fontsAvailable ? 'Avenir Next LT Pro' : 'helvetica',
          },
          bodyStyles: {
            fontSize: 8,
            font: fontsAvailable ? 'Avenir Next LT Pro' : 'helvetica',
          },
          columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 30 },
          },
        });
        yPos = (doc as any).lastAutoTable.finalY + 8;
      } else if (activity.type === 'multiple-choice' && activity.optionCounts && activity.optionCounts.length > 0) {
        const tableData = activity.optionCounts.map((o) => [o.label, String(o.count)]);
        autoTable(doc, {
          startY: yPos,
          head: [['Option', 'Count']],
          body: tableData,
          theme: 'striped',
          headStyles: {
            fillColor: [primaryRgb[0], primaryRgb[1], primaryRgb[2]],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            font: fontsAvailable ? 'Avenir Next LT Pro' : 'helvetica',
          },
          bodyStyles: {
            fontSize: 8,
            font: fontsAvailable ? 'Avenir Next LT Pro' : 'helvetica',
          },
          columnStyles: {
            0: { cellWidth: 120 },
            1: { cellWidth: 30 },
          },
        });
        yPos = (doc as any).lastAutoTable.finalY + 8;
      } else if (activity.type === 'numeric' && activity.numericMean != null) {
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        setBrandFont(doc, false, fontsAvailable);
        doc.text(
          `Mean: ${activity.numericMean.toFixed(2)}   Responses: ${activity.numericCount ?? 0}`,
          20,
          yPos,
        );
        yPos += 8;
      }
    }
    yPos += 5;
  }

  // Add footer
  addFooter(doc, branding, fontsAvailable);

  // Append one page per board when boards are provided and the flag is on
  if (includeBoards && boards && boards.length > 0) {
    for (const board of boards) {
      if (board.notes.length > 0) {
        drawBoardPage(doc, board, branding, fontsAvailable);
      }
    }
  }

  // Download PDF
  const fileName = `${workspaceName.replace(/[^a-z0-9]/gi, '_')}_Cohort_Results_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

/**
 * Generate branded PDF for personalized results
 */
export async function generatePersonalizedResultsPDF(
  personalizedResult: PersonalizedResult,
  branding: BrandingConfig,
  participantName: string,
  workspaceName: string,
  projectName?: string
): Promise<void> {
  const doc = new jsPDF();
  
  // Load Avenir fonts first
  const fontsAvailable = await loadAvenirFonts(doc);
  
  const primaryRgb = branding.primaryColor
    ? hexToRgb(branding.primaryColor)
    : [139, 92, 246];

  // Add header
  let yPos = await addBrandedHeader(doc, branding, 'Personalized Results', fontsAvailable);

  // Add participant / workspace / project info
  setBrandFont(doc, false, fontsAvailable);
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Participant: ${participantName}`, 15, yPos + 5);
  if (projectName) {
    doc.text(`Project: ${projectName}`, 15, yPos + 12);
    doc.text(`Workspace: ${workspaceName}`, 15, yPos + 19);
    yPos += 29;
  } else {
    doc.text(`Workspace: ${workspaceName}`, 15, yPos + 12);
    yPos += 22;
  }

  // Add alignment score
  if (personalizedResult.alignmentScore !== null) {
    setBrandFont(doc, true, fontsAvailable);
    doc.setFontSize(14);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('Cohort Alignment Score', 15, yPos);
    yPos += 8;

    setBrandFont(doc, true, fontsAvailable);
    doc.setFontSize(24);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text(`${personalizedResult.alignmentScore}%`, 15, yPos);
    yPos += 15;
  }

  // Add personal summary
  setBrandFont(doc, true, fontsAvailable);
  doc.setFontSize(14);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text('Your Journey', 15, yPos);
  yPos += 8;

  setBrandFont(doc, false, fontsAvailable);
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const summaryLines = doc.splitTextToSize(
    personalizedResult.personalSummary || '',
    doc.internal.pageSize.getWidth() - 30
  );
  doc.text(summaryLines, 15, yPos);
  yPos += summaryLines.length * 5 + 10;

  // Add top contributions
  const topContributions = personalizedResult.topContributions as Array<{
    noteId: string;
    content: string;
    impact: string;
  }> | undefined;
  
  if (topContributions && topContributions.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    setBrandFont(doc, true, fontsAvailable);
    doc.setFontSize(14);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('Your Top Contributions', 15, yPos);
    yPos += 8;

    topContributions.forEach((contribution, index) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      setBrandFont(doc, false, fontsAvailable);
      doc.setFontSize(10);
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(`#${index + 1}`, 15, yPos);

      doc.setTextColor(0, 0, 0);
      const contentLines = doc.splitTextToSize(contribution.content, 160);
      doc.text(contentLines, 25, yPos);
      yPos += contentLines.length * 5 + 2;

      doc.setTextColor(100, 100, 100);
      const impactLines = doc.splitTextToSize(contribution.impact, 160);
      doc.text(impactLines, 25, yPos);
      yPos += impactLines.length * 5 + 8;
    });
  }

  // Add insights
  if (personalizedResult.insights) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    setBrandFont(doc, true, fontsAvailable);
    doc.setFontSize(14);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('Personalized Insights', 15, yPos);
    yPos += 8;

    setBrandFont(doc, false, fontsAvailable);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    // Split insights into paragraphs for better readability
    const paragraphs = personalizedResult.insights.split('\n\n');
    paragraphs.forEach((paragraph, index) => {
      const insightLines = doc.splitTextToSize(
        paragraph.trim(),
        doc.internal.pageSize.getWidth() - 30
      );
      doc.text(insightLines, 15, yPos);
      yPos += insightLines.length * 5 + (index < paragraphs.length - 1 ? 8 : 10);
      
      // Check if we need a new page
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
    });
  }

  // Add recommendations
  if (personalizedResult.recommendations) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    setBrandFont(doc, true, fontsAvailable);
    doc.setFontSize(14);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('Next Steps & Recommendations', 15, yPos);
    yPos += 8;

    setBrandFont(doc, false, fontsAvailable);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    // Split recommendations into paragraphs for better readability
    const paragraphs = personalizedResult.recommendations.split('\n\n');
    paragraphs.forEach((paragraph, index) => {
      const recLines = doc.splitTextToSize(
        paragraph.trim(),
        doc.internal.pageSize.getWidth() - 30
      );
      doc.text(recLines, 15, yPos);
      yPos += recLines.length * 5 + (index < paragraphs.length - 1 ? 8 : 10);
      
      // Check if we need a new page
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
    });
  }

  // Add footer
  addFooter(doc, branding, fontsAvailable);

  // Download PDF
  const fileName = `${participantName.replace(/[^a-z0-9]/gi, '_')}_Personalized_Results_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
