"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UrlForm({ large }: { large?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (url.trim()) router.push(`/scan?url=${encodeURIComponent(url.trim())}`);
      }}
      className={`flex w-full max-w-xl rounded-full border border-line bg-white p-1.5 shadow-sm focus-within:border-accent ${large ? "text-lg" : ""}`}
    >
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="yourcompany.com"
        aria-label="Your company's website"
        className="flex-1 bg-transparent px-4 outline-none min-w-0"
      />
      <button className="rounded-full bg-ink text-paper px-5 py-2.5 text-sm font-medium hover:bg-accent whitespace-nowrap">
        Check for free
      </button>
    </form>
  );
}
