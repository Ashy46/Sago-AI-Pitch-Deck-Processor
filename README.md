# Pitch Deck Verification Web App

A modern Next.js application for uploading PDF pitch decks, extracting verifiable claims from each slide, and verifying them using AI APIs with proper source citations.

## Features

- **PDF Upload**: Drag-and-drop interface with progress tracking
- **Slide-by-Slide Extraction**: Automatically extracts text from each PDF page
- **Claim Identification**: Uses AI to identify verifiable claims (numbers, statistics, market data)
- **Claim Verification**: Verifies each claim using Perplexity or OpenAI APIs
- **Source Citations**: Provides clickable source links for verified claims
- **Clean UI**: Built with shadcn/ui components and Tailwind CSS
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Frontend**: React 18+ with TypeScript
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **PDF Processing**: pdf.js / react-pdf
- **AI APIs**: Anthropic Claude (primary, for claim extraction and verification) with OpenAI and Perplexity as fallbacks

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Anthropic API key (recommended) - Get one at https://console.anthropic.com/
- OpenAI API key (optional, used as fallback)
- Perplexity API key (optional, best for verification with sources)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Sago-AI-Pitch-Deck-Processor
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env.local
```

Edit `.env.local` and add your API keys:
```env
# Recommended: Use Anthropic (Claude) as primary
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: OpenAI as fallback
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Perplexity for better verification with sources
PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
/app
  /api
    /verify
      route.ts          # API route for claim extraction & verification
  page.tsx              # Main upload page
  layout.tsx            # Root layout
  globals.css           # Global styles
/components
  /ui                   # shadcn components
  pdf-uploader.tsx      # Upload component with drag-and-drop
  slide-verifier.tsx    # Slide display with facts
  fact-card.tsx         # Individual fact verification card
  slide-preview.tsx     # PDF page preview/thumbnail
/lib
  pdf-utils.ts          # PDF text extraction utilities
  types.ts              # TypeScript type definitions
  utils.ts              # Utility functions
```

## How It Works

1. **Upload PDF**: User uploads a PDF pitch deck via drag-and-drop or file browser
2. **Extract Text**: Client-side extraction of text from each PDF page using pdf.js
3. **Identify Claims**: Backend calls OpenAI API to identify verifiable claims from each slide
4. **Verify Claims**: For each claim, backend calls Perplexity API (or OpenAI) to verify and find sources
5. **Display Results**: Frontend displays slides with extracted facts, verification status, and source links

## API Routes

### POST `/api/verify`

Accepts extracted slide text and returns verified claims.

**Request Body:**
```json
{
  "slides": [
    {
      "slideNumber": 1,
      "text": "Market size: $4.2B..."
    }
  ]
}
```

**Response:**
```json
{
  "slides": [
    {
      "slideNumber": 1,
      "text": "...",
      "facts": [
        {
          "claim": "Market size: $4.2B",
          "verified": true,
          "verdict": "Verified",
          "explanation": "...",
          "sources": [
            {"title": "Source Name", "url": "https://..."}
          ]
        }
      ]
    }
  ]
}
```

## Environment Variables

- `ANTHROPIC_API_KEY` (recommended): Anthropic API key for claim extraction and verification (primary)
- `OPENAI_API_KEY` (optional): OpenAI API key (used as fallback if Anthropic not available)
- `PERPLEXITY_API_KEY` (optional): Perplexity API key for verification with sources (best for finding sources)

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Notes

- PDFs are processed client-side for text extraction
- API keys are required for claim extraction and verification
- The app prioritizes Anthropic Claude (claude-3-5-sonnet) for better quality
- Falls back to OpenAI if Anthropic not available
- Perplexity API provides the best source citations when available

## License

MIT

