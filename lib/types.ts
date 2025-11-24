export interface Slide {
  slideNumber: number;
  text: string;
  facts: Fact[];
  error?: string;
}

export interface Fact {
  claim: string;
  verified: boolean;
  verdict: "Verified" | "Partially Verified" | "Cannot Verify";
  explanation: string;
  sources: Source[];
}

export interface Source {
  title: string;
  url: string;
}

export interface VerificationRequest {
  slides: {
    slideNumber: number;
    text: string;
  }[];
}

export interface VerificationResponse {
  slides: Slide[];
}

