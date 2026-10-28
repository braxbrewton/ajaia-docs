"use client";

import { useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useResetWhenHidden } from "@/lib/hooks";
import { IMPORT_ACCEPT, IMPORT_LABEL, IMPORT_MAX_LABEL, validateImportFile } from "@/lib/importFile";
import type { DocumentFull } from "@/lib/types";
import { ErrorBanner, buttonSecondary } from "./ui";

export function ImportDropzone({ onImported }: { onImported: (doc: DocumentFull) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useResetWhenHidden(() => setBusy(false));

  async function upload(file: File | undefined) {
    if (!file || busy) return;
    const problem = validateImportFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const doc = await api<DocumentFull>("/documents/import", { method: "POST", body });
      onImported(doc);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Import failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mb-8">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files[0]);
        }}
        className={`flex flex-col items-start gap-3 rounded-xl border-2 border-dashed px-5 py-4 transition sm:flex-row sm:items-center ${
          dragging ? "border-indigo-400 bg-indigo-50" : "border-slate-300 bg-white/60"
        }`}
      >
        <div className="flex-1 text-sm">
          <p className="font-medium text-slate-800">
            {busy ? "Importing…" : "Import a file as a new document"}
          </p>
          <p className="mt-0.5 text-slate-500">
            Drag a file here or choose one. Supported: <strong>{IMPORT_LABEL}</strong> (up to {IMPORT_MAX_LABEL}).
            Headings, bold, italic, underline and lists are kept; images and tables in Word files are
            not imported.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={buttonSecondary}
        >
          Choose file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={IMPORT_ACCEPT}
          aria-label="Import file"
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = ""; // allow re-selecting the same file after an error
          }}
        />
      </div>
      {error && (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      )}
    </div>
  );
}
