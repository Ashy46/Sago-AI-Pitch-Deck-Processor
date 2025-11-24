import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Slide } from "@/lib/types";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slides } = body;

    if (!slides || slides.length === 0) {
      return NextResponse.json(
        { error: "Slides are required" },
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

    // Get current date/time for context
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Compile all slide text and verified facts
    const slideSummaries = slides.map((slide: Slide) => {
      const facts = slide.facts
        .map((fact) => `- ${fact.claim} (${fact.verdict})`)
        .join('\n');
      return `Slide ${slide.slideNumber}:\n${slide.text.substring(0, 500)}\n\nVerified Facts:\n${facts || 'None'}`;
    }).join('\n\n---\n\n');

    const prompt = `You are a venture capitalist reviewing a pitch deck. Based on the pitch deck content and verified facts below, generate 8-12 critical questions that an investor should ask the founder.

Focus on questions about:
- Competition and competitive advantage
- Monetization strategy and revenue model
- Exit strategy and potential acquirers
- Market validation and traction
- Team and execution capability
- Financial projections and unit economics
- Go-to-market strategy
- Risks and challenges
- Product-market fit evidence
- Scalability and growth plans

Current date: ${currentDate} - consider this when asking about timelines, market conditions, etc.

IMPORTANT: Return ONLY valid JSON, nothing else. No explanations, no markdown, just the JSON object.

Return a JSON object with a "questions" array of question strings. Each question should be specific, actionable, and based on the pitch deck content.

Example format: {"questions": ["What is your competitive moat and how defensible is it?", "What is your customer acquisition cost (CAC) and lifetime value (LTV)?", "Who are your top 3 potential acquirers and why?"]}

Pitch Deck Content:
${slideSummaries}`;

    try {
      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
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
              parsed = { questions: JSON.parse(arrayMatch[0]) };
            } else {
              // Try parsing the whole text
              parsed = JSON.parse(text);
            }
          }
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          console.error("Response text:", text.substring(0, 200));
          // Try to extract JSON from markdown code blocks
          const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (codeBlockMatch) {
            try {
              parsed = JSON.parse(codeBlockMatch[1]);
            } catch {
              return NextResponse.json(
                { error: "Failed to parse questions response" },
                { status: 500 }
              );
            }
          } else {
            return NextResponse.json(
              { error: "Failed to parse questions response" },
              { status: 500 }
            );
          }
        }
        
        const questions = parsed.questions || parsed.question || [];
        return NextResponse.json({ 
          questions: Array.isArray(questions) ? questions : [] 
        });
      }
      
      return NextResponse.json(
        { error: "Invalid response format" },
        { status: 500 }
      );
    } catch (error: any) {
      console.error("Error generating questions:", error);
      
      if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
        return NextResponse.json(
          {
            error: "Rate limit exceeded. Please wait a moment and try again.",
          },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: error?.message || "Failed to generate questions" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in generate-questions route:", error);
    
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: error?.status || 500 }
    );
  }
}

