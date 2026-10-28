"use client";

import { use } from "react";
import Link from "next/link";
import { useApi, useRequireUser } from "@/lib/hooks";
import type { DocumentFull } from "@/lib/types";
import { AppHeader } from "../AppHeader";
import { Spinner } from "../ui";
import { DocumentEditor } from "./DocumentEditor";

export function EditorScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useRequireUser();

  // Everyone polls (this is "refresh", not real-time collaboration): viewers see edits made by
  // owners/editors, and editors pick up each other's saved changes. The editor only applies
  // remote content when the local user has nothing unsaved, so polling never clobbers typing.
  const { data: doc, error, mutate } = useApi<DocumentFull>(user ? `/documents/${id}` : null, {
    revalidateOnFocus: true,
    revalidateOnMount: true,
    shouldRetryOnError: false,
    refreshInterval: 5000,
  });

  if (error && error.status !== 401) {
    const missing = error.status === 404;
    return (
      <>
        <AppHeader user={user} />
        <main className="mx-auto max-w-md flex-1 p-10 text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            {missing ? "Document not found" : "Couldn't open this document"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {missing
              ? "It may have been deleted, or you may not have access to it."
              : error.message}
          </p>
          <Link href="/" className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline">
            ← Back to documents
          </Link>
        </main>
      </>
    );
  }

  if (!user || !doc) {
    return (
      <>
        <AppHeader user={user} />
        <Spinner label="Opening document…" />
      </>
    );
  }

  return (
    <DocumentEditor
      key={doc.id}
      doc={doc}
      user={user}
      refresh={() => mutate()}
      // Keep the cached copy in step with what we just saved, so reopening the doc (the page is
      // kept mounted by Cache Components) never shows or re-saves stale content.
      onSaved={(saved) => void mutate(saved, { revalidate: false })}
    />
  );
}
