"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useAutosave, type SaveStatus } from "@/lib/useAutosave";
import type { DocumentFull, User } from "@/lib/types";
import { AppHeader } from "../AppHeader";
import { ErrorBanner, buttonSecondary } from "../ui";
import { ShareDialog } from "./ShareDialog";
import { Toolbar } from "./Toolbar";

/**
 * The editing screen. Owns the live title/content state; the server copy (`doc`) is only used
 * for the initial load and, for read-only viewers, to pick up the owner's latest edits.
 */
export function DocumentEditor({
  doc,
  user,
  refresh,
}: {
  doc: DocumentFull;
  user: User;
  refresh: () => Promise<unknown>;
}) {
  const canEdit = doc.can_edit;
  const isOwner = doc.role === "owner";
  const { status, errorMessage, schedule, retry } = useAutosave(doc.id);

  const [title, setTitle] = useState(doc.title);
  const committedTitle = useRef(doc.title);
  const [sharing, setSharing] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Only keep formatting the server stores (see apps/api/app/services/sanitize.py),
        // so nothing the user applies is silently dropped on save.
        link: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder: canEdit ? "Start writing…" : "" }),
    ],
    content: doc.content,
    editable: canEdit,
    immediatelyRender: false, // avoid SSR hydration mismatch
    editorProps: {
      attributes: { class: "doc-editor", "aria-label": "Document content" },
    },
    onUpdate: ({ editor }) => schedule({ content: editor.getHTML() }),
  });

  // Read-only viewers: show the owner's latest content/title as it refreshes.
  useEffect(() => {
    if (canEdit || !editor) return;
    if (editor.getHTML() !== doc.content) {
      editor.commands.setContent(doc.content, { emitUpdate: false });
    }
  }, [canEdit, editor, doc.content]);

  // If permissions change (e.g. the owner switched us to view-only), follow along.
  useEffect(() => {
    editor?.setEditable(canEdit);
  }, [editor, canEdit]);

  function commitTitle() {
    const next = title.trim();
    if (!next) {
      setTitle(committedTitle.current); // never save an empty title
      return;
    }
    if (next !== committedTitle.current) {
      committedTitle.current = next;
      setTitle(next);
      schedule({ title: next });
    }
  }

  return (
    <>
      <AppHeader user={user}>
        <Link href="/" className="shrink-0 text-sm text-slate-500 hover:text-slate-900">
          ← Documents
        </Link>
        <SaveIndicator status={canEdit ? status : "idle"} />
        <div className="ml-auto flex items-center gap-2">
          {!isOwner && (
            <span className="hidden text-xs text-slate-500 md:inline">
              Shared by {doc.owner.name}
            </span>
          )}
          {isOwner && (
            <button onClick={() => setSharing(true)} className={buttonSecondary}>
              Share{doc.shares.length > 0 ? ` (${doc.shares.length})` : ""}
            </button>
          )}
        </div>
      </AppHeader>

      <div className="flex flex-1 flex-col">
        {!canEdit && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
            You have view-only access to this document. Changes by the owner appear automatically.
          </div>
        )}
        {canEdit && editor && <Toolbar editor={editor} />}

        <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
          <article className="min-h-[70vh] rounded-lg border border-slate-200 bg-white px-8 py-8 shadow-sm sm:px-14 sm:py-12">
            <input
              value={canEdit ? title : doc.title}
              readOnly={!canEdit}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTitle();
                  editor?.commands.focus("start");
                }
              }}
              maxLength={255}
              aria-label="Document title"
              placeholder="Untitled document"
              className="mb-6 w-full rounded border-0 bg-transparent text-3xl font-bold text-slate-900 outline-none placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-200"
            />
            <EditorContent editor={editor} />
          </article>

          {status === "error" && errorMessage && (
            <div className="mt-4">
              <ErrorBanner
                message={`${errorMessage} Your changes are still in this tab and will retry on your next edit.`}
                onRetry={retry}
              />
            </div>
          )}
        </div>
      </div>

      {sharing && (
        <ShareDialog doc={doc} onClose={() => setSharing(false)} onChanged={refresh} />
      )}
    </>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const text: Record<SaveStatus, string> = {
    idle: "",
    unsaved: "Unsaved changes…",
    saving: "Saving…",
    saved: "All changes saved",
    error: "Save failed",
  };
  return (
    <span
      role="status"
      aria-live="polite"
      className={`truncate text-xs ${status === "error" ? "font-medium text-red-600" : "text-slate-500"}`}
    >
      {text[status]}
    </span>
  );
}
