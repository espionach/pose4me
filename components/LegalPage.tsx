import fs from "node:fs";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import { BackButton, Screen } from "@/components/ui";

/**
 * Reads `content/<file>`: an optional `updated:` line in front matter, then Markdown.
 * While the body is just a `[… GOES HERE]` placeholder, the dashed placeholder box is shown.
 */
function readContent(file: string) {
  const raw = fs.readFileSync(path.join(process.cwd(), "content", file), "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const front = match?.[1] ?? "";
  const updated = front.match(/^updated:\s*(.+)$/m)?.[1].trim() ?? "";
  const body = (match ? raw.slice(match[0].length) : raw).trim();
  return { updated, body, placeholder: /^\[[^\]]*\]$/.test(body) };
}

export function LegalPage({ title, file }: { title: string; file: string }) {
  const { updated, body, placeholder } = readContent(file);
  return (
    <Screen className="h-dvh" gap={20} bottomSpace={0}>
      <div className="flex items-center justify-between">
        <BackButton to="/settings" label="Back to settings" />
      </div>

      <div className="flex flex-col gap-1.5 px-1">
        <h1 className="m-0 font-serif text-[32px] leading-[1.1] font-normal">{title}</h1>
        {updated && <div className="text-[13px] text-muted">last updated {updated}</div>}
      </div>

      <div className="mb-8 flex min-h-0 grow flex-col gap-3.5 overflow-y-auto rounded-card bg-surface p-5 shadow-paper">
        {placeholder ? (
          <div className="flex h-full items-center justify-center rounded-[14px] border-2 border-dashed border-line p-5 text-center text-[15px] font-semibold text-muted">
            {body}
          </div>
        ) : (
          <div className="legal-md">
            <ReactMarkdown>{body}</ReactMarkdown>
          </div>
        )}
      </div>
    </Screen>
  );
}
