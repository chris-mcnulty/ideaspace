import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CohortResult, PersonalizedResult } from '@shared/schema';

interface BrandingConfig {
  orgName: string;
  orgLogo?: string;
  primaryColor?: string; // Hex color
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

  // Add "Orion by Synozur | Maturity Modeler" branding
  setBrandFont(doc, true, fontsAvailable);
  doc.setFontSize(12);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text('Orion by Synozur | Maturity Modeler', 50, 22);

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
  
  // First line: "Powered by Orion | The Synozur Alliance"
  doc.text(
    'Powered by Orion | The Synozur Alliance',
    pageWidth / 2,
    pageHeight - 15,
    { align: 'center' }
  );
  
  // Second line: "www.synozur.com"
  doc.text(
    'www.synozur.com',
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );
}

/**
 * Generate branded PDF for cohort results
 */
export async function generateCohortResultsPDF(
  cohortResult: CohortResult,
  branding: BrandingConfig,
  workspaceName: string
): Promise<void> {
  const doc = new jsPDF();
  
  // Load Avenir fonts first
  const fontsAvailable = await loadAvenirFonts(doc);
  
  const primaryRgb = branding.primaryColor
    ? hexToRgb(branding.primaryColor)
    : [139, 92, 246];

  // Add header
  let yPos = await addBrandedHeader(doc, branding, 'Cohort Results', fontsAvailable);

  // Add workspace info
  setBrandFont(doc, false, fontsAvailable);
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Workspace: ${workspaceName}`, 15, yPos + 5);
  yPos += 15;

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

  // Add footer
  addFooter(doc, branding, fontsAvailable);

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
  workspaceName: string
): Promise<void> {
  const doc = new jsPDF();
  
  // Load Avenir fonts first
  const fontsAvailable = await loadAvenirFonts(doc);
  
  const primaryRgb = branding.primaryColor
    ? hexToRgb(branding.primaryColor)
    : [139, 92, 246];

  // Add header
  let yPos = await addBrandedHeader(doc, branding, 'Personalized Results', fontsAvailable);

  // Add participant info
  setBrandFont(doc, false, fontsAvailable);
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Participant: ${participantName}`, 15, yPos + 5);
  doc.text(`Workspace: ${workspaceName}`, 15, yPos + 10);
  yPos += 20;

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
