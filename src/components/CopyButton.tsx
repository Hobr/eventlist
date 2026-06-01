import { useState } from "react";

interface Props {
  text: string;
  label?: string;
}

export default function CopyButton({ text, label = "复制" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="text-indigo-600 text-sm hover:underline ml-2"
    >
      {copied ? "已复制!" : label}
    </button>
  );
}
