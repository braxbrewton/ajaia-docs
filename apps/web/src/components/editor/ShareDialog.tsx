"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { DocumentFull, Share, ShareRole, User } from "@/lib/types";
import { Avatar } from "../AppHeader";
import { ErrorBanner, buttonPrimary } from "../ui";

const ROLE_LABEL: Record<ShareRole, string> = { editor: "Can edit", viewer: "View only" };

export function ShareDialog({
  doc,
  onClose,
  onChanged,
}: {
  doc: DocumentFull;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { data: users } = useApi<User[]>("/auth/users");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const sharedIds = new Set(doc.shares.map((s) => s.user.id));
  const suggestions = (users ?? []).filter((u) => u.id !== doc.owner.id && !sharedIds.has(u.id));

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function addShare(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    await run(async () => {
      await api<Share>(`/documents/${doc.id}/shares`, {
        method: "POST",
        json: { email: email.trim(), role },
      });
      setEmail("");
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
      aria-labelledby="share-title"
      className="m-auto w-full max-w-md rounded-2xl p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="share-title" className="text-lg font-semibold text-slate-900">
              Share “{doc.title}”
            </h2>
            <p className="text-sm text-slate-500">Give teammates access to this document.</p>
          </div>
          <button
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <form onSubmit={addShare} className="flex flex-wrap gap-2">
          <input
            type="email"
            required
            list="share-suggestions"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            aria-label="Email address"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <datalist id="share-suggestions">
            {suggestions.map((u) => (
              <option key={u.id} value={u.email}>
                {u.name}
              </option>
            ))}
          </datalist>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ShareRole)}
            aria-label="Permission"
            className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
          >
            <option value="editor">Can edit</option>
            <option value="viewer">View only</option>
          </select>
          <button type="submit" disabled={busy} className={buttonPrimary}>
            Share
          </button>
        </form>

        {suggestions.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Demo accounts:{" "}
            {suggestions.map((u, i) => (
              <span key={u.id}>
                {i > 0 && ", "}
                <button
                  type="button"
                  onClick={() => setEmail(u.email)}
                  className="text-indigo-600 hover:underline"
                >
                  {u.email}
                </button>
              </span>
            ))}
          </p>
        )}

        {error && (
          <div className="mt-3">
            <ErrorBanner message={error} />
          </div>
        )}

        <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
          People with access
        </h3>
        <ul className="divide-y divide-slate-100">
          <PersonRow user={doc.owner} trailing={<span className="text-sm text-slate-500">Owner</span>} />
          {doc.shares.map((s) => (
            <PersonRow
              key={s.user.id}
              user={s.user}
              trailing={
                <div className="flex items-center gap-2">
                  <select
                    value={s.role}
                    disabled={busy}
                    aria-label={`Permission for ${s.user.name}`}
                    onChange={(e) =>
                      run(() =>
                        api(`/documents/${doc.id}/shares`, {
                          method: "POST",
                          json: { email: s.user.email, role: e.target.value },
                        }),
                      )
                    }
                    className="rounded border border-slate-200 bg-white px-1.5 py-1 text-sm"
                  >
                    {(Object.keys(ROLE_LABEL) as ShareRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={busy}
                    onClick={() => run(() => api(`/documents/${doc.id}/shares/${s.user.id}`, { method: "DELETE" }))}
                    className="rounded px-1.5 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              }
            />
          ))}
        </ul>
        {doc.shares.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">Only you can access this document right now.</p>
        )}
      </div>
    </dialog>
  );
}

function PersonRow({ user, trailing }: { user: User; trailing: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar name={user.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-900">{user.name}</div>
        <div className="truncate text-xs text-slate-500">{user.email}</div>
      </div>
      {trailing}
    </li>
  );
}
