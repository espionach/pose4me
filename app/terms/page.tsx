import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms & conditions · Shoot Planner" };

// Text lives in content/terms.md.
export default function Terms() {
  return <LegalPage title="terms & conditions" file="terms.md" />;
}
