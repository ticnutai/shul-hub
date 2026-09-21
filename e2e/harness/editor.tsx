/**
 * The real TV editor, on its own, for the end-to-end tests.
 *
 * The admin page behind it needs a signed-in Supabase session, which a test
 * machine does not have; every request the editor makes is intercepted in the
 * spec instead (e2e/tv-editor.spec.ts). What is rendered here is the very
 * same TvDesignPanel the administrator uses - not a copy of it - so the tests
 * exercise the shipped controls, dialogs and preview.
 *
 * Dev-only: nothing outside index.html is bundled by `vite build`.
 */
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TvDesignPanel } from "@/community/components/admin/tv/TvDesignPanel";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <div dir="rtl" className="p-3">
      <TvDesignPanel />
    </div>
    <Toaster position="top-center" />
  </QueryClientProvider>,
);
