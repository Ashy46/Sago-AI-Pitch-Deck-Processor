"use client";

import { Document, Page, pdfjs } from "react-pdf";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Set up PDF.js worker - use jsdelivr CDN which is more reliable
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface SlidePreviewProps {
  file: File | string;
  pageNumber: number;
  width?: number;
}

export function SlidePreview({
  file,
  pageNumber,
  width = 300,
}: SlidePreviewProps) {
  const [loading, setLoading] = useState(true);

  return (
    <div className="relative">
      {loading && (
        <Skeleton className="w-full aspect-[4/3] bg-muted" />
      )}
      <div className={loading ? "hidden" : ""}>
        <Document
          file={file}
          loading={<Skeleton className="w-full aspect-[4/3] bg-muted" />}
          onLoadSuccess={() => setLoading(false)}
          className="flex justify-center"
        >
          <Page
            pageNumber={pageNumber}
            width={width}
            renderTextLayer={true}
            renderAnnotationLayer={false}
            className="shadow-md rounded-lg overflow-hidden"
          />
        </Document>
      </div>
    </div>
  );
}

