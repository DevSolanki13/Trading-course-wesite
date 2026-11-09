import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAnnouncements } from "../frontend/lib/use-announcements";
import type { Announcement } from "../shared/announcements";

const initial = [{ id: "one", title: "Server notice", active: true }] as Announcement[];
const fresh = [{ id: "two", title: "Fresh notice", active: true }] as Announcement[];
const request = vi.fn();
function Harness({ items, owner = "user-one" }: { items?: Announcement[]; owner?: string }) {
  const data = useAnnouncements(items, owner);
  return <output>{data.map((item) => item.title).join(",") || "Empty"}</output>;
}
beforeEach(() => {
  vi.useFakeTimers();
  request.mockReset().mockResolvedValue(Response.json({ announcements: fresh }));
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("uses even an empty server snapshot without an immediate duplicate request", async () => {
  render(<Harness items={[]} />);
  await act(async () => vi.advanceTimersByTimeAsync(59_999));
  expect(request).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status")).toHaveTextContent("Fresh notice");
});

it("fetches immediately when no server snapshot was supplied", async () => {
  render(<Harness />);
  await act(async () => {});
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status")).toHaveTextContent("Fresh notice");
});

it("refreshes visible stale notices but coalesces focus and visibility events", async () => {
  render(<Harness items={initial} />);
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  await act(async () => vi.advanceTimersByTimeAsync(120_000));
  expect(request).not.toHaveBeenCalled();
  hidden.mockRestore();
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status")).toHaveTextContent("Fresh notice");
});

it("keeps confirmed notices on errors and aborts work after unmount", async () => {
  request.mockRejectedValueOnce(new Error("Offline"));
  const view = render(<Harness items={initial} />);
  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  expect(screen.getByRole("status")).toHaveTextContent("Server notice");
  const signal = request.mock.calls[0][1].signal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(120_000));
  expect(request).toHaveBeenCalledTimes(1);
});

it("ignores an obsolete response after server props change", async () => {
  let finish!: (value: Response) => void;
  request.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<Harness />);
  view.rerender(<Harness items={fresh} owner="user-two" />);
  await act(async () => finish(Response.json({ announcements: initial })));
  expect(screen.getByRole("status")).toHaveTextContent("Fresh notice");
});
