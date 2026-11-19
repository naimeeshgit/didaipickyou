"use client";

import { useEffect, useState } from "react";

export function ReportActions({ id, brand }: { id: string; brand: string }) {
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);

  // Open every collapsed answer before printing, so the PDF has the full report.
  useEffect(() => {
    const opened: HTMLDetailsElement[] = [];
    const before = () =>
      document.querySelectorAll("details").forEach((d) => {
        if (!d.open) { d.open = true; opened.push(d); }
      });
    const after = () => { opened.forEach((d) => (d.open = false)); opened.length = 0; };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);

  function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    const link = window.location.href.split("#")[0];
    const subject = `AI visibility report: did AI pick ${brand}?`;
    const body = `Your report from Did AI Pick You?\n\n${link}\n\nDownload every answer as a spreadsheet:\n${link.replace(/\/r\//, "/api/reports/")}/csv`;
    window.location.href = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  const btn = "rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-accent hover:text-accent";
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button type="button" onClick={() => window.print()} className={btn}>Save as PDF</button>
      <a href={`/api/reports/${id}/csv`} className={btn}>Download answers (CSV)</a>
      {open ? (
        <form onSubmit={sendEmail} className="flex items-center gap-2">
          <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
            className="rounded-full border border-line px-4 py-2 text-sm outline-none focus:border-accent w-56" />
          <button className="rounded-full bg-ink text-paper px-4 py-2 text-sm hover:bg-accent">Send</button>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={btn}>Email me this report</button>
      )}
    </div>
  );
}
