/**
 * The control that decides where every edit on the page lands.
 *
 * What is worth pinning here is not that a dropdown opens. It is the four
 * things that, if they quietly stopped being true, would send somebody's
 * work to the wrong synagogue - and would look like nothing at all while
 * they did it.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommunitySwitcher } from "./CommunitySwitcher";
import * as community from "@/community/lib/community";

const MAIN = { id: "main-id", slug: "main", name: "בית הכנסת הראשי", active: true };
const QUIET = { id: "quiet-id", slug: "torah-veahavata", name: "תורה ואהבתה", active: false };

async function show(list: community.Community[]) {
  vi.spyOn(community, "listMyCommunities").mockResolvedValue(list);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const cleared = vi.spyOn(client, "clear");
  // Mounting fetches the list; letting that settle inside act() keeps the
  // output to what the tests actually assert.
  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <CommunitySwitcher />
      </QueryClientProvider>,
    );
  });
  return { cleared };
}

/** Opens the list and picks a synagogue by name. */
async function open(name: string) {
  fireEvent.click(screen.getByTestId("community-switcher"));
  const option = await screen.findByText(name);
  await act(async () => {
    fireEvent.click(option);
  });
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/admin");
  community.setCommunity(MAIN, false);
});

afterEach(() => {
  // Unmount before emptying the store: the component subscribes to it, and
  // clearing it under a mounted component is a React update nobody asked for.
  cleanup();
  vi.restoreAllMocks();
  community.setCommunity(null);
});

describe("choosing which synagogue is being edited", () => {
  it("says nothing when there is only one - there is nothing to choose", async () => {
    await show([MAIN]);
    await waitFor(() => expect(community.listMyCommunities).toHaveBeenCalled());
    expect(screen.queryByTestId("community-switcher")).toBeNull();
  });

  it("names the synagogue being edited, without being opened", async () => {
    await show([MAIN, QUIET]);
    expect(await screen.findByText(MAIN.name)).toBeTruthy();
  });

  it("marks a synagogue the public cannot see", async () => {
    community.setCommunity(QUIET, false);
    await show([MAIN, QUIET]);
    // Once on the button itself: an admin editing a switched-off synagogue
    // should not have to open anything to find that out.
    expect(await screen.findAllByText("כבוי")).toBeTruthy();
  });

  it("switching writes the synagogue into the address bar", async () => {
    await show([MAIN, QUIET]);
    await screen.findByText(MAIN.name);
    await open(QUIET.name);

    expect(community.currentCommunity()?.id).toBe(QUIET.id);
    expect(new URLSearchParams(window.location.search).get("shul")).toBe(QUIET.slug);
  });

  it("switching empties the cache rather than filtering it", async () => {
    const { cleared } = await show([MAIN, QUIET]);
    await screen.findByText(MAIN.name);
    await open(QUIET.name);
    expect(cleared).toHaveBeenCalled();
  });

  it("comes back to the switched-off synagogue that was being worked on", async () => {
    // The visitor-side resolve only knows about live synagogues, so on its own
    // it would have moved this admin to the main one without saying so - and
    // the next edit would have landed there.
    localStorage.setItem("shul-hub.community", QUIET.slug);
    await show([MAIN, QUIET]);
    await waitFor(() => expect(community.currentCommunity()?.id).toBe(QUIET.id));
  });

  it("does not treat a remembered synagogue that is not yours as a switch", async () => {
    localStorage.setItem("shul-hub.community", "somebody-elses");
    await show([MAIN, QUIET]);
    await screen.findByText(MAIN.name);
    expect(community.currentCommunity()?.id).toBe(MAIN.id);
  });
});
