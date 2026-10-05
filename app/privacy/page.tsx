import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy policy · poseforme" };

// Text lives in content/privacy.md.
export default function Privacy() {
  return <LegalPage title="privacy policy" file="privacy.md" />;
}
