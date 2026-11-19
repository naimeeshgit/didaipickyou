import type { Metadata } from "next";
import { Suspense } from "react";
import { ScanFlow } from "./ScanFlow";

export const metadata: Metadata = {
  title: "Check if AI recommends your brand",
  description: "Free scan: we ask ChatGPT, Claude and Gemini the questions your buyers ask and show how often they pick you.",
};

export default function ScanPage() {
  return (
    <Suspense>
      <ScanFlow />
    </Suspense>
  );
}
