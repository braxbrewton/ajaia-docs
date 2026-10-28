"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./api";
import type { DocumentFull, DocumentPatch } from "./types";

export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 800;

/**
 * Debounced, serialized autosave for a document.
 *
 * - `schedule(patch)` merges changes (title and/or content) and saves after a short pause.
 * - Saves never overlap: each one waits for the previous to finish, so a slow response can't
 *   overwrite newer text with older text.
 * - If a save fails, the unsaved changes are kept and retried on the next edit or `retry()`.
 * - Pending changes are flushed when leaving the page.
 */
export function useAutosave(docId: string, onSaved?: (doc: DocumentFull, patch: DocumentPatch) => void) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep the latest callback without re-creating `flush` (which would re-run the unmount effect).
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  const pending = useRef<DocumentPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const inflight = useRef(0);

  const hasPending = useCallback(() => Object.keys(pending.current).length > 0, []);

  const flush = useCallback(
    (keepalive = false) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      chain.current = chain.current.then(async () => {
        if (!hasPending()) return;
        const patch = pending.current;
        pending.current = {};
        inflight.current += 1;
        setStatus("saving");
        try {
          const saved = await api<DocumentFull>(`/documents/${docId}`, {
            method: "PATCH",
            json: patch,
            keepalive,
          });
          // Report before clearing "in flight" so the client cache never looks newer-than-local
          // while we are still considered busy.
          onSavedRef.current?.(saved, patch);
          inflight.current -= 1;
          setErrorMessage(null);
          // Edits that arrived while saving keep the doc in "unsaved/saving"
          setStatus(hasPending() || inflight.current > 0 ? "saving" : "saved");
        } catch (e) {
          inflight.current -= 1;
          // Keep the failed changes (newer edits win on conflict) so nothing is lost
          pending.current = { ...patch, ...pending.current };
          setErrorMessage(
            e instanceof ApiError && e.status === 403
              ? "You no longer have permission to edit this document."
              : e instanceof ApiError
                ? e.message
                : "Could not save",
          );
          setStatus("error");
        }
      });
      return chain.current;
    },
    [docId, hasPending],
  );

  const schedule = useCallback(
    (patch: DocumentPatch) => {
      pending.current = { ...pending.current, ...patch };
      setStatus("unsaved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    },
    [flush],
  );

  // Flush on unmount / navigation, and warn before closing the tab with unsaved work.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPending() || inflight.current > 0) {
        void flush(true);
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (hasPending()) void flush(true);
    };
  }, [flush, hasPending]);

  const retry = useCallback(() => void flush(), [flush]);

  /** True while local edits are waiting to be saved, being saved, or failed to save. */
  const hasUnsaved = useCallback(() => hasPending() || inflight.current > 0, [hasPending]);

  return { status, errorMessage, schedule, retry, hasUnsaved };
}
