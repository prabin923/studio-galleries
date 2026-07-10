"use client";

import { useState } from "react";

export default function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
