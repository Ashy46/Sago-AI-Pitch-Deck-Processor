"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText } from "lucide-react";
import { extractTextFromPDF } from "@/lib/pdf-utils";

interface PDFUploaderProps {
  onUploadComplete: (
    slides: { slideNumber: number; text: string; imageBase64?: string }[],
    file: File
  ) => void;
}

export function PDFUploader({ onUploadComplete }: PDFUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    async (selectedFile: File) => {
      if (!selectedFile.type.includes("pdf")) {
        setError("Please upload a PDF file");
        return;
      }

      setFile(selectedFile);
      setUploading(true);
      setProgress(0);
      setError(null);

      try {
        setProgress(30);
        const slides = await extractTextFromPDF(selectedFile);
        setProgress(100);
        onUploadComplete(slides, selectedFile);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to extract text from PDF"
        );
        setFile(null);
      } finally {
        setUploading(false);
        setTimeout(() => setProgress(0), 1000);
      }
    },
    [onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFile(droppedFile);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFile(selectedFile);
      }
    },
    [handleFile]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Pitch Deck</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25"
          }`}
        >
          <Input
            type="file"
            accept=".pdf"
            onChange={handleFileInput}
            disabled={uploading}
            className="hidden"
            id="pdf-upload"
          />
          <label
            htmlFor="pdf-upload"
            className="cursor-pointer flex flex-col items-center gap-4"
          >
            {file ? (
              <>
                <FileText className="h-12 w-12 text-primary" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    Drag and drop your PDF here, or click to browse
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    PDF files only
                  </p>
                </div>
              </>
            )}
          </label>
        </div>

        {uploading && (
          <div className="mt-4 space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">
              Processing PDF pages...
            </p>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

