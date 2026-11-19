import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">Report not found</h1>
      <p className="mt-3 text-muted">It may have been removed, or the link is wrong.</p>
      <Link href="/scan" className="inline-block mt-8 rounded-full bg-ink text-paper px-6 py-3 hover:bg-accent">Run a new check</Link>
    </div>
  );
}
