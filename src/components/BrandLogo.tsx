"use client";

import { useEffect, useRef, useState } from "react";

/** The company's site icon, with the first letter as a fallback. */
export function BrandLogo({ domain, name, size = 40 }: { domain: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(!domain);
  const img = useRef<HTMLImageElement>(null);
  const letter = (name || domain || "?").trim().charAt(0).toUpperCase();

  // The image can fail before React attaches onError (server-rendered page), so check once on mount too.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    <span
      className="shrink-0 grid place-items-center rounded-xl border border-line bg-white overflow-hidden"
      style={{ width: size, height: size }}
    >
      {failed ? (
        <span className="font-semibold text-accent" style={{ fontSize: size * 0.45 }}>{letter}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img}
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`}
          alt=""
          width={size * 0.6}
          height={size * 0.6}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
