"use client";

import { Fact } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface FactCardProps {
  fact: Fact;
}

export function FactCard({ fact }: FactCardProps) {
  const getIcon = () => {
    if (fact.verified && fact.verdict === "Verified") {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    } else if (fact.verdict === "Partially Verified") {
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    } else {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getBadgeVariant = () => {
    if (fact.verdict === "Verified") return "success";
    if (fact.verdict === "Partially Verified") return "warning";
    return "destructive";
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="mt-1">{getIcon()}</div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-base">{fact.claim}</p>
              <Badge variant={getBadgeVariant()}>{fact.verdict}</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {fact.explanation}
            </p>
            {fact.sources.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {fact.sources.map((source, index) => (
                  <Button
                    key={index}
                    variant="link"
                    size="sm"
                    asChild
                    className="h-auto p-0 text-sm"
                  >
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.title}
                    </a>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

