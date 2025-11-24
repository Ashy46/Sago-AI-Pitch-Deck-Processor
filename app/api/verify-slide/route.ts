import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Slide, Fact } from "@/lib/types";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  : null;

async function extractClaims(slideText: string, imageBase64?: string): Promise<string[]> {
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY not configured. Please set it in your .env.local file.");
  }
  
  // Get current date/time for context
  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const currentTime = now.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    timeZoneName: 'short' 
  });
  
  const prompt = `Extract verifiable claims from this pitch deck slide. Focus on:
- Numbers, statistics, market data
- Financial figures
- Market size claims
- User/customer numbers
- Growth percentages
- Pricing information
- Any factual claims that can be verified

IMPORTANT - IGNORE THE FOLLOWING:
- Contact information: addresses, phone numbers, email addresses, website URLs, company contact details
- Author/presenter information: author names, presenter names, creator information
- Presentation metadata: slide numbers, page numbers, presentation titles, deck metadata
- Formatting elements: headers, footers, decorative text, navigation elements
- Copyright notices, disclaimers, legal text
- Company logos and branding text (unless it's part of a verifiable claim)
- Business model information: revenue models, monetization strategies, business plans, how the company makes money, commission structures, pricing models, business processes, operational models
- Only extract substantive factual claims about external facts that can be fact-checked (not internal business plans or models)

CRITICAL: Always interpret all facts as if they are current/present-day claims. The current date and time is: ${currentDate} at ${currentTime}. 
- If a claim doesn't specify a time period, assume it refers to the present (${currentDate})
- Treat all statistics, numbers, and data points as if they are current as of ${currentDate}
- When extracting claims, frame them as present-day statements (e.g., "Market size is $4.2B" not "Market size was $4.2B")

Return ONLY valid JSON, nothing else. No explanations, no markdown, just the JSON object.

Return a JSON object with a "claims" array of claim strings. Example: {"claims": ["Market size: $4.2B", "Medallions cost ~$500k"]}`;

  try {
    const content: any[] = [];
    
    // If we have an image, use vision API
    if (imageBase64) {
      // Remove data URL prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: base64Data,
        },
      });
    }
    
    // Add text prompt
    content.push({
      type: "text",
      text: prompt + (slideText ? `\n\nExtracted text (may be garbled, but use the image above as primary source):\n${slideText}` : ''),
    });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: content,
        },
      ],
    });

    const response = message.content[0];
    if (response.type === "text") {
      const text = response.text.trim();
      let parsed;
      
      try {
        // Try to find JSON object in the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          // Try to find JSON array
          const arrayMatch = text.match(/\[[\s\S]*\]/);
          if (arrayMatch) {
            parsed = { claims: JSON.parse(arrayMatch[0]) };
          } else {
            // Try parsing the whole text
            parsed = JSON.parse(text);
          }
        }
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.error("Response text:", text.substring(0, 200));
        // Try to extract claims from markdown code blocks
        const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
          try {
            parsed = JSON.parse(codeBlockMatch[1]);
          } catch {
            return [];
          }
        } else {
          return [];
        }
      }
      
      const claims = parsed.claims || parsed.claim || [];
      return Array.isArray(claims) ? claims : [];
    }
    return [];
  } catch (error: any) {
    console.error("Error extracting claims with Anthropic:", error);
    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      throw error;
    }
    return [];
  }
}

async function verifyClaim(claim: string): Promise<{
  verified: boolean;
  verdict: "Verified" | "Partially Verified" | "Cannot Verify";
  explanation: string;
  sources: { title: string; url: string }[];
}> {
  // Use Perplexity API if available (best for verification with sources)
  const perplexityApiKey = process.env.PERPLEXITY_API_KEY;

  if (perplexityApiKey) {
    try {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${perplexityApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-large-128k-online",
          messages: [
            {
              role: "system",
              content:
                "You are a fact-checking assistant. Verify claims and provide sources. Return a JSON object with: verified (boolean), verdict (Verified/Partially Verified/Cannot Verify), explanation (2-3 sentences), and sources (array of {title, url}).",
            },
            {
              role: "user",
              content: `Verify this claim and provide sources: "${claim}"`,
            },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return {
            verified: parsed.verified || false,
            verdict: parsed.verdict || "Cannot Verify",
            explanation: parsed.explanation || "Unable to verify this claim.",
            sources: parsed.sources || [],
          };
        }
      }
    } catch (error) {
      console.error("Perplexity API error:", error);
    }
  }

  // Use Anthropic (Claude) for verification
  if (!anthropic) {
    return {
      verified: false,
      verdict: "Cannot Verify",
      explanation: "ANTHROPIC_API_KEY not configured.",
      sources: [],
    };
  }

  return await verifyClaimWithAnthropic(claim);
}

async function verifyClaimWithAnthropic(claim: string): Promise<{
  verified: boolean;
  verdict: "Verified" | "Partially Verified" | "Cannot Verify";
  explanation: string;
  sources: { title: string; url: string }[];
}> {
  if (!anthropic) {
    return {
      verified: false,
      verdict: "Cannot Verify",
      explanation: "Anthropic API not configured.",
      sources: [],
    };
  }

  // Get current date/time for context
  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const currentTime = now.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    timeZoneName: 'short' 
  });
  
  const prompt = `You are a fact-checking assistant. Verify this claim and provide sources.

CRITICAL: Always interpret the claim as a present-day statement. The current date and time is: ${currentDate} at ${currentTime}.
- Treat the claim as if it refers to the present (${currentDate}), even if no time period is specified
- Verify the claim as if it's describing the current state of affairs
- Use current data and recent sources to verify the claim
- If the claim is about historical data, note that in your explanation but still verify it against current information

IMPORTANT: 
- Return ONLY valid JSON, nothing else. No explanations, no markdown, just the JSON object.

Return a JSON object with:
- verified (boolean): true if the claim is verified, false otherwise
- verdict (string): "Verified", "Partially Verified", or "Cannot Verify"
- explanation (string): 2-3 sentences explaining your verification (mention if the claim refers to current vs historical data)
- sources (array): Array of objects with "title" and "url" properties

Claim to verify: "${claim}"`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const response = message.content[0];
    if (response.type === "text") {
      const text = response.text.trim();
      let parsed;
      
      try {
        // Try to find JSON object in the response (handle extra text before/after)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          // Try parsing the whole text
          parsed = JSON.parse(text);
        }
      } catch (parseError) {
        console.error("JSON parse error in verification:", parseError);
        console.error("Response text:", text.substring(0, 200));
        
        // Try to extract JSON from markdown code blocks
        const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
          try {
            parsed = JSON.parse(codeBlockMatch[1]);
          } catch {
            return {
              verified: false,
              verdict: "Cannot Verify",
              explanation: "Unable to parse verification response.",
              sources: [],
            };
          }
        } else {
          return {
            verified: false,
            verdict: "Cannot Verify",
            explanation: "Unable to parse verification response.",
            sources: [],
          };
        }
      }

      return {
        verified: parsed.verified || false,
        verdict: parsed.verdict || "Cannot Verify",
        explanation: parsed.explanation || "Unable to verify this claim.",
        sources: parsed.sources || [],
      };
    }
    
    return {
      verified: false,
      verdict: "Cannot Verify",
      explanation: "Invalid response format.",
      sources: [],
    };
  } catch (error: any) {
    console.error("Error verifying claim with Anthropic:", error);
    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      throw error;
    }
    return {
      verified: false,
      verdict: "Cannot Verify",
      explanation: "Error occurred while verifying this claim.",
      sources: [],
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slideNumber, text, imageBase64 } = body;

    if (slideNumber === undefined) {
      return NextResponse.json(
        { error: "Slide number is required" },
        { status: 400 }
      );
    }

    // Use image if available, otherwise fall back to text
    if (!imageBase64 && !text) {
      return NextResponse.json(
        { error: "Either image or text is required" },
        { status: 400 }
      );
    }

    // Check if API key is configured
    if (!anthropic) {
      return NextResponse.json(
        {
          error:
            "ANTHROPIC_API_KEY not configured. Please set it in your .env.local file.",
        },
        { status: 500 }
      );
    }

    try {
      // Extract claims from slide image/text (one API call)
      const claims = await extractClaims(text || '', imageBase64);

      // Verify claims sequentially with delays to respect rate limits (5 requests/min = 12 seconds between requests)
      const facts: Fact[] = [];
      
      for (let i = 0; i < claims.length; i++) {
        const claim = claims[i];
        try {
          const verification = await verifyClaim(claim);
          facts.push({
            claim,
            ...verification,
          });
          
          // Add delay between claims to respect rate limits (wait 13 seconds between requests)
          if (i < claims.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 13000)); // 13 second delay
          }
        } catch (error: any) {
          // If rate limit error, stop processing and return what we have
          if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
            console.error("Rate limit hit while verifying claims");
            return NextResponse.json(
              {
                slideNumber,
                text,
                facts,
                error: "Rate limit exceeded. Please wait a moment and continue with the next slide.",
              },
              { status: 429 }
            );
          }
          // Continue with other claims even if one fails
          console.error(`Error verifying claim: ${claim}`, error);
        }
      }

      const slide: Slide = {
        slideNumber,
        text,
        facts,
      };

      return NextResponse.json(slide);
    } catch (error: any) {
      // If rate limit error, return early with helpful message
      if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
        return NextResponse.json(
          {
            slideNumber,
            text,
            facts: [],
            error: "Rate limit exceeded. Anthropic allows 5 requests per minute. Please wait a moment and try again.",
          },
          { status: 429 }
        );
      }
      
      // For other errors, return the slide with empty facts
      console.error(`Error processing slide ${slideNumber}:`, error);
      return NextResponse.json({
        slideNumber,
        text,
        facts: [],
        error: error?.message || "Error processing slide",
      });
    }
  } catch (error: any) {
    console.error("Error in verify-slide route:", error);
    
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: error?.status || 500 }
    );
  }
}

