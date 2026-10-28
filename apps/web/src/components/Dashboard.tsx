"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { formatWhen, useApi, useRequireUser, useResetWhenHidden } from "@/lib/hooks";
import type { DocumentFull, DocumentList, DocumentSummary } from "@/lib/types";
import { AppHeader } from "./AppHeader";
import { ImportDropzone } from "./ImportDropzone";
import { ErrorBanner, Spinner, buttonPrimary } from "./ui";

export function Dashboard() {
  const router = useRouter();
  const user = useRequireUser();
  const { data, error, isLoading, mutate } = useApi<DocumentList>(user ? "/documents" : null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  useResetWhenHidden(() => setCreating(false));

  async function createDocument() {
    setCreating(true);
    setActionError(null);
    try {
      const doc = await api<DocumentFull>("/documents", { method: "POST", json: {} });
      router.push(`/documents/${doc.id}`);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Could not create the document");
      setCreating(false);
    }
  }

  async function deleteDocument(doc: DocumentSummary) {
    if (!window.confirm(`Delete "${doc.title}"? This also removes access for anyone it is shared with.`))
      return;
    setActionError(null);
    try {
      await api(`/documents/${doc.id}`, { method: "DELETE" });
      await mutate();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Could not delete the document");
    }
  }

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
          <button onClick={createDocument} disabled={creating || !user} className={buttonPrimary}>
            {creating ? "Creating…" : "+ New document"}
          </button>
        </div>

        <ImportDropzone onImported={(doc) => router.push(`/documents/${doc.id}`)} />

        {actionError && (
          <div className="mb-4">
            <ErrorBanner message={actionError} />
          </div>
        )}
        {error && error.status !== 401 && (
          <ErrorBanner message={error.message} onRetry={() => mutate()} />
        )}
        {(isLoading || !user) && !error && <Spinner />}

        {data && (
          <div className="space-y-10">
            <Section
              title="My documents"
              docs={data.owned}
              empty="You haven't created any documents yet. Click “New document” to start."
              onDelete={deleteDocument}
            />
            <Section
              title="Shared with me"
              docs={data.shared}
              empty="Nothing has been shared with you yet. Ask a teammate to share a document, or sign in as another user to try it."
            />
          </div>
        )}
      </main>
    </>
  );
}

function Section({
  title,
  docs,
  empty,
  onDelete,
}: {
  title: string;
  docs: DocumentSummary[];
  empty: string;
  onDelete?: (doc: DocumentSummary) => void;
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title} <span className="font-normal text-slate-400">({docs.length})</span>
      </h2>
      {docs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="group relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow"
            >
              <Link href={`/documents/${doc.id}`} className="block after:absolute after:inset-0">
                <h3 className="truncate pr-8 font-medium text-slate-900">{doc.title}</h3>
                <p className="mt-1 text-xs text-slate-500">Edited {formatWhen(doc.updated_at)}</p>
              </Link>
              <div className="mt-3 flex items-center gap-2 text-xs">
                {doc.role === "owner" ? (
                  <Badge tone="indigo">Owned by you</Badge>
                ) : (
                  <>
                    <Badge tone="emerald">Shared by {doc.owner.name}</Badge>
                    <Badge tone="slate">{doc.role === "editor" ? "Can edit" : "View only"}</Badge>
                  </>
                )}
              </div>
              {onDelete && (
                <button
                  onClick={() => onDelete(doc)}
                  aria-label={`Delete ${doc.title}`}
                  className="absolute right-2 top-2 z-10 rounded p-1.5 text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Badge({ tone, children }: { tone: "indigo" | "emerald" | "slate"; children: React.ReactNode }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return <span className={`rounded-full px-2 py-0.5 font-medium ${tones[tone]}`}>{children}</span>;
}
