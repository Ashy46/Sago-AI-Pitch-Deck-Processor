"use client";

import { Slide } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FactCard } from "@/components/fact-card";
import { SlidePreview } from "@/components/slide-preview";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";

interface SlideVerifierProps {
  slides: Slide[];
  pdfFile: File | null;
  loading?: boolean;
}

export function SlideVerifier({ slides, pdfFile, loading }: SlideVerifierProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (slides.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Accordion type="multiple" className="w-full">
        {slides.map((slide) => (
          <AccordionItem key={slide.slideNumber} value={`slide-${slide.slideNumber}`}>
            <AccordionTrigger>
              <CardTitle className="text-xl">
                Slide {slide.slideNumber}
              </CardTitle>
            </AccordionTrigger>
            <AccordionContent>
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {pdfFile && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Slide Preview</h4>
                        <SlidePreview
                          file={pdfFile}
                          pageNumber={slide.slideNumber}
                          width={400}
                        />
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Extracted Text</h4>
                      <div className="p-4 bg-muted rounded-md text-sm max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-sans">
                          {slide.text}
                        </pre>
                      </div>
                    </div>
                  </div>

                  {slide.error ? (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                      <p className="text-sm text-destructive font-medium">Error:</p>
                      <p className="text-sm text-destructive/80 mt-1">{slide.error}</p>
                    </div>
                  ) : slide.facts.length > 0 ? (
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold">Facts Extracted</h4>
                      {slide.facts.map((fact, index) => (
                        <FactCard key={index} fact={fact} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No verifiable facts found in this slide.
                    </p>
                  )}
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

