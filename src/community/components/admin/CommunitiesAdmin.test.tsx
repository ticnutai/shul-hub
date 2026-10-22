/**
 * The list of synagogues, drawn with two samples: each row has its name and
 * state on top and its actions in a row of their own; a synagogue other than
 * the one being edited can be deleted - only after its name is typed.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const LIST = [
  { id: "c1", slug: "ohel-avraham", name: "אהל אברהם", active: true, screens: 1, minyanim: 38, announcements: 2 },
  { id: "c2", slug: "shul-2", name: "תורה ואהבה", active: false, screens: 0, minyanim: 0, announcements: 0 },
];
const deleted: string[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async () => ({ data: LIST, error: null }),
    from: () => ({
      delete: () => ({ eq: async (_c: string, id: string) => (deleted.push(id), { error: null }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}));
vi.mock("@/community/lib/community", () => ({ switchCommunity: vi.fn(), useCommunityId: () => "c1" }));
vi.mock("@/community/lib/useMyCommunities", () => ({ useIsPlatformAdmin: () => true }));
vi.mock("./SynagogueDetails", () => ({ SynagogueDetailsDialog: () => null }));

import { CommunitiesAdmin } from "./CommunitiesAdmin";
import { ConfirmProvider } from "@/components/ConfirmDialog";

afterEach(cleanup);

function draw() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CommunitiesAdmin />
        <ConfirmProvider />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CommunitiesAdmin", () => {
  it("shows each synagogue whole, with its actions in a row of their own", async () => {
    draw();
    const rows = await screen.findAllByTestId("community-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("אהל אברהם")).toBeTruthy();
    expect(within(rows[0]).getByText(/38 מניינים/)).toBeTruthy();
    // The one being edited cannot be deleted; the other can.
    expect(within(rows[0]).queryByRole("button", { name: /מחיקת/ })).toBeNull();
    expect(within(rows[1]).getByRole("button", { name: "מחיקת תורה ואהבה" })).toBeTruthy();
    expect(within(rows[1]).getByRole("button", { name: /מעבר לעריכה/ })).toBeTruthy();
  });

  it("deletes only after the name is typed", async () => {
    draw();
    const rows = await screen.findAllByTestId("community-row");
    fireEvent.click(within(rows[1]).getByRole("button", { name: "מחיקת תורה ואהבה" }));
    const dialog = await screen.findByTestId("confirm-dialog");
    const confirm = within(dialog).getByRole("button", { name: "מחיקה לצמיתות" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByTestId("confirm-type"), { target: { value: "תורה ואהבה" } });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(deleted).toEqual(["c2"]));
  });
});
