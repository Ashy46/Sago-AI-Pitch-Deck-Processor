"use client";

import { useState } from "react";
import { PDFUploader } from "@/components/pdf-uploader";
import { SlideVerifier } from "@/components/slide-verifier";
import { InvestorQuestions } from "@/components/investor-questions";
import { Slide } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [totalSlides, setTotalSlides] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);

  const handleUploadComplete = async (
    extractedSlides: { slideNumber: number; text: string; imageBase64?: string }[]
  ) => {
    setError(null);
    setVerifying(true);
    setSlides([]); // Reset slides
    setCurrentSlideIndex(0);
    setTotalSlides(extractedSlides.length);

    // Process slides one at a time
    const processedSlides: Slide[] = [];
    
    for (let i = 0; i < extractedSlides.length; i++) {
      const slide = extractedSlides[i];
      setCurrentSlideIndex(i + 1);

      try {
        const response = await fetch("/api/verify-slide", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slideNumber: slide.slideNumber,
            text: slide.text,
            imageBase64: slide.imageBase64,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // If rate limit, wait and retry
          if (response.status === 429) {
            const retryAfter = response.headers.get("retry-after") || "60";
            const waitTime = parseInt(retryAfter) * 1000;
            
            setError(
              `Rate limit exceeded. Waiting ${Math.ceil(waitTime / 1000)} seconds before continuing...`
            );
            
            // Wait before continuing
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Retry this slide
            i--;
            continue;
          }
          
          // For other errors, add slide with error message
          const errorSlide: Slide = {
            slideNumber: slide.slideNumber,
            text: slide.text,
            facts: [],
            error: errorData.error || "Error processing slide",
          };
          processedSlides.push(errorSlide);
          setSlides([...processedSlides]);
          continue;
        }

        const verifiedSlide: Slide = await response.json();
        processedSlides.push(verifiedSlide);
        setSlides([...processedSlides]);
        setError(null); // Clear error on successful processing
      } catch (err) {
        console.error(`Error processing slide ${slide.slideNumber}:`, err);
        const errorSlide: Slide = {
          slideNumber: slide.slideNumber,
          text: slide.text,
          facts: [],
          error: err instanceof Error ? err.message : "Error processing slide",
        };
        processedSlides.push(errorSlide);
        setSlides([...processedSlides]);
      }
    }

    setVerifying(false);
    setCurrentSlideIndex(0);

    // Generate investor questions after verification is complete
    if (processedSlides.length > 0) {
      setGeneratingQuestions(true);
      try {
        const response = await fetch("/api/generate-questions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slides: processedSlides,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setQuestions(data.questions || []);
        } else {
          console.error("Failed to generate questions");
        }
      } catch (err) {
        console.error("Error generating questions:", err);
      } finally {
        setGeneratingQuestions(false);
      }
    }
  };

  const handleFileSelect = (file: File) => {
    setPdfFile(file);
  };

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            Pitch Deck Verification
          </h1>
          <p className="text-muted-foreground">
            Upload a PDF pitch deck to extract and verify claims
          </p>
        </div>

        <PDFUploader
          onUploadComplete={(extractedSlides, file) => {
            handleFileSelect(file);
            handleUploadComplete(extractedSlides);
          }}
        />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {verifying && (
          <div className="flex flex-col items-center justify-center gap-2 p-8">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-muted-foreground">
                Processing slide {currentSlideIndex} of {totalSlides}...
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              This may take a moment. Results will appear as each slide is processed.
            </p>
          </div>
        )}

        {slides.length > 0 && (
          <>
            <SlideVerifier slides={slides} pdfFile={pdfFile} loading={verifying} />
            <InvestorQuestions 
              questions={questions} 
              loading={generatingQuestions}
            />
          </>
        )}
      </div>
    </main>
  );
}

