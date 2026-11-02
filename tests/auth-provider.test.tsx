import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../frontend/components/auth-provider";

const route = vi.hoisted(() => ({ pathname: "/courses" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

function Consumer({ label }: { label: string }) {
  const { user, ready, clear } = useAuth();
  return (
    <>
      <output aria-label={label}>{ready ? (user?.name ?? "Anonymous") : "Checking"}</output>
      <button onClick={clear}>Clear {label}</button>
    </>
  );
}

afterEach(() => {
  route.pathname = "/courses";
  vi.unstubAllGlobals();
});

describe("shared authentication", () => {
  it("shares one request across consumers and Strict Mode, without reading HttpOnly cookies", async () => {
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(
      <StrictMode>
        <AuthProvider>
          <Consumer label="Header" />
          <Consumer label="Course" />
        </AuthProvider>
      </StrictMode>,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => resolve(Response.json({ user: { id: "learner", name: "Learner" } })));
    expect(screen.getByLabelText("Header")).toHaveTextContent("Learner");
    expect(screen.getByLabelText("Course")).toHaveTextContent("Learner");
  });

  it("updates every consumer after navigation and after a session changes in another tab", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ user: { id: "learner", name: "Learner" } }))
      .mockResolvedValueOnce(Response.json({ user: { id: "admin", name: "Administrator" } }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    const tree = () => (
      <AuthProvider>
        <Consumer label="Header" />
        <Consumer label="Course" />
      </AuthProvider>
    );
    const view = render(tree());
    await waitFor(() => expect(screen.getByLabelText("Header")).toHaveTextContent("Learner"));
    route.pathname = "/courses/price-action";
    view.rerender(tree());
    await waitFor(() => expect(screen.getByLabelText("Course")).toHaveTextContent("Administrator"));
    fireEvent.focus(window);
    await waitFor(() => expect(screen.getByLabelText("Header")).toHaveTextContent("Anonymous"));
    expect(screen.getByLabelText("Course")).toHaveTextContent("Anonymous");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("does not restore a signed-out user when an earlier request finishes late", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    render(
      <AuthProvider>
        <Consumer label="Header" />
        <Consumer label="Course" />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear Header" }));
    await act(async () =>
      resolve(Response.json({ user: { id: "old-session", name: "Old user" } })),
    );
    expect(screen.getByLabelText("Header")).toHaveTextContent("Anonymous");
    expect(screen.getByLabelText("Course")).toHaveTextContent("Anonymous");
  });

  it("settles network failures without blocking the public page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    render(
      <AuthProvider>
        <Consumer label="Header" />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByLabelText("Header")).toHaveTextContent("Anonymous"));
  });

  it("checks a new route immediately even when the previous route's session check is pending", async () => {
    let finishOld!: (value: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((done) => {
            finishOld = done;
          }),
      )
      .mockResolvedValueOnce(Response.json({ user: { id: "new-session", name: "Signed in" } }));
    vi.stubGlobal("fetch", fetcher);
    const tree = () => (
      <AuthProvider>
        <Consumer label="Header" />
      </AuthProvider>
    );
    const view = render(tree());
    route.pathname = "/dashboard";
    view.rerender(tree());
    await waitFor(() => expect(screen.getByLabelText("Header")).toHaveTextContent("Signed in"));
    await act(async () => finishOld(new Response(null, { status: 401 })));
    expect(screen.getByLabelText("Header")).toHaveTextContent("Signed in");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
