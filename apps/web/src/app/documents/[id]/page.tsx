import { Suspense } from "react";
import { EditorScreen } from "@/components/editor/EditorScreen";
import { Spinner } from "@/components/ui";

export default function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  // `params` is a promise (read with `use()` in the client component), so the route shell
  // can prerender while the per-user document loads in the browser.
  return (
    <Suspense fallback={<Spinner label="Opening document…" />}>
      <EditorScreen params={params} />
    </Suspense>
  );
}
