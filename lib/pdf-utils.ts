"use client";

import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker - use jsdelivr CDN which is more reliable
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export async function extractTextFromPDF(file: File): Promise<{ slideNumber: number; text: string; imageBase64?: string }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const slides: { slideNumber: number; text: string; imageBase64?: string }[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    
    // Extract text (fallback)
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .trim();

    // Render page to canvas and convert to image
    const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (context) {
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      
      // Convert canvas to base64 image
      const imageBase64 = canvas.toDataURL('image/png');
      
      slides.push({
        slideNumber: pageNum,
        text: text || 'No text extracted',
        imageBase64,
      });
    } else {
      slides.push({
        slideNumber: pageNum,
        text: text || 'No text extracted',
      });
    }
  }

  return slides;
}

