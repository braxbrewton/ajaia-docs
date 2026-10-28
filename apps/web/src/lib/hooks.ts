"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate, type SWRConfiguration } from "swr";
import { ApiError, api, fetcher } from "./api";
import type { User } from "./types";

/** SWR bound to our fetcher and error type. Pass `null` as the key to skip fetching. */
export function useApi<T>(key: string | null, config?: SWRConfiguration<T, ApiError>) {
  return useSWR<T, ApiError>(key, fetcher, config);
}

export function useSession() {
  const { data, error, isLoading } = useApi<User>("/me", {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
  return { user: data ?? null, error, isLoading };
}

/** Returns the signed-in user, redirecting to /login if there is no session. */
export function useRequireUser(): User | null {
  const router = useRouter();
  const { user, error } = useSession();
  const unauthenticated = error?.status === 401;

  useEffect(() => {
    if (unauthenticated) router.replace("/login");
  }, [unauthenticated, router]);

  return user;
}

/** Drop every cached response so one user's data never shows up for the next. */
export function clearClientCache() {
  return globalMutate(() => true, undefined, { revalidate: false });
}

export async function signOut() {
  await api("/auth/logout", { method: "POST" }).catch(() => {});
  await clearClientCache();
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
