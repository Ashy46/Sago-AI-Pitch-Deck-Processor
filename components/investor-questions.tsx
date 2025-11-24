"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface InvestorQuestionsProps {
  questions: string[];
  loading?: boolean;
}

export function InvestorQuestions({ questions, loading }: InvestorQuestionsProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Questions for the Founder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 p-8">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-muted-foreground">Generating questions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Questions for the Founder
          <Badge variant="outline">{questions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {questions.map((question, index) => (
            <div
              key={index}
              className="flex gap-3 p-4 bg-muted/50 rounded-lg border border-border"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                {index + 1}
              </div>
              <p className="flex-1 text-sm leading-relaxed">{question}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

