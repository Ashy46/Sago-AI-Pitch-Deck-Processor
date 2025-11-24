import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { VerificationRequest, VerificationResponse, Slide, Fact } from "@/lib/types";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  : null;

async function extractClaims(slideText: string): Promise<string[]> {
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY not configured. Please set it in your .env.local file.");
  }
  
  const prompt = `Extract verifiable claims from the following pitch deck slide text. Focus on:
- Numbers, statistics, market data
- Financial figures
- Market size claims
- User/customer numbers
- Growth percentages
- Pricing information
- Any factual claims that can be verified

IMPORTANT: Return ONLY valid JSON, nothing else. No explanations, no markdown, just the JSON object.

Return a JSON object with a "claims" array of claim strings. Example: {"claims": ["Market size: $4.2B", "Medallions cost ~$500k"]}

Slide text:
${slideText}`;

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
  } catch (error) {
    console.error("Error extracting claims with Anthropic:", error);
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

  const prompt = `You are a fact-checking assistant. Verify this claim and provide sources.

IMPORTANT: Return ONLY valid JSON, nothing else. No explanations, no markdown, just the JSON object.

Return a JSON object with:
- verified (boolean): true if the claim is verified, false otherwise
- verdict (string): "Verified", "Partially Verified", or "Cannot Verify"
- explanation (string): 2-3 sentences explaining your verification
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
  } catch (error) {
    console.error("Error verifying claim with Anthropic:", error);
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
    const body: VerificationRequest = await request.json();

    if (!body.slides || body.slides.length === 0) {
      return NextResponse.json(
        { error: "No slides provided" },
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

    // Process slides sequentially to respect rate limits (5 requests/min for free tier)
    // Process claims in small batches to avoid rate limits
    const verifiedSlides: Slide[] = [];
    
    for (const slide of body.slides) {
      try {
        // Extract claims from slide text (one API call per slide)
        const claims = await extractClaims(slide.text);

        // Verify claims sequentially to respect rate limits (5 requests/min)
        const facts: Fact[] = [];
        
        for (const claim of claims) {
          try {
            const verification = await verifyClaim(claim);
            facts.push({
              claim,
              ...verification,
            });
            
            // Add delay between claims to respect rate limits (5/min = 12 seconds between requests)
            if (facts.length < claims.length) {
              await new Promise(resolve => setTimeout(resolve, 13000)); // 13 second delay
            }
          } catch (error: any) {
            // If rate limit error, stop processing and return what we have
            if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
              console.error("Rate limit hit while verifying claims");
              break;
            }
            // Continue with other claims even if one fails
            console.error(`Error verifying claim: ${claim}`, error);
          }
        }

        verifiedSlides.push({
          slideNumber: slide.slideNumber,
          text: slide.text,
          facts,
        });
        
        // Add delay between slides to respect rate limits
        if (verifiedSlides.length < body.slides.length) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
      } catch (error: any) {
        // If rate limit error, return early with helpful message
        if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
          return NextResponse.json(
            {
              error: "Rate limit exceeded. Anthropic allows 5 requests per minute. Please wait a moment and try again, or process fewer slides at once.",
            },
            { status: 429 }
          );
        }
        // Continue with other slides even if one fails
        console.error(`Error processing slide ${slide.slideNumber}:`, error);
        verifiedSlides.push({
          slideNumber: slide.slideNumber,
          text: slide.text,
          facts: [],
        });
      }
    }


    const response: VerificationResponse = {
      slides: verifiedSlides,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error in verify route:", error);
    
    // Return specific error messages
    if (error?.message) {
      return NextResponse.json(
        { error: error.message },
        { status: error?.status || 500 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

