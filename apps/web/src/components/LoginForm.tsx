"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { clearClientCache, useApi } from "@/lib/hooks";
import type { User } from "@/lib/types";
import { Avatar } from "./AppHeader";
import { ErrorBanner, Spinner } from "./ui";

export function LoginForm() {
  const router = useRouter();
  const { data: users, error, isLoading, mutate } = useApi<User[]>("/auth/users");
  const [pending, setPending] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  async function signIn(email: string) {
    setPending(email);
    setLoginError(null);
    try {
      await clearClientCache(); // never reuse another user's cached data
      await api("/auth/login", { method: "POST", json: { email } });
      router.push("/");
    } catch (e) {
      setLoginError(e instanceof ApiError ? e.message : "Something went wrong");
      setPending(null);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-lg font-semibold text-white">
            A
          </span>
          <h1 className="text-2xl font-semibold text-slate-900">Ajaia Docs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Demo environment. Pick an account to sign in, no password needed. Try signing in as two
            different users to see sharing.
          </p>
        </div>

        {isLoading && <Spinner label="Loading accounts…" />}
        {error && (
          <ErrorBanner
            message={
              error.status === 0 || error.status >= 500
                ? "Can't reach the API. If it just woke up, wait a few seconds and retry."
                : error.message
            }
            onRetry={() => mutate()}
          />
        )}
        {loginError && <ErrorBanner message={loginError} />}

        <ul className="mt-3 space-y-2">
          {users?.map((u) => (
            <li key={u.id}>
              <button
                onClick={() => signIn(u.email)}
                disabled={pending !== null}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60"
              >
                <Avatar name={u.name} />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-slate-900">{u.name}</span>
                  <span className="block text-xs text-slate-500">{u.email}</span>
                </span>
                {pending === u.email && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
