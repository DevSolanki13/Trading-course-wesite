"use client";
import { useEffect, useRef, useState } from "react";
import type { PurchaseOrder } from "../../shared/purchase";

export function useBillingOrders(
  initialOrders: PurchaseOrder[],
  active: boolean,
  initiallyFresh = false,
) {
  const [snapshot, setSnapshot] = useState({
    source: initialOrders,
    orders: initialOrders,
    loaded: initiallyFresh || initialOrders.length > 0,
  });
  const seeded = useRef<PurchaseOrder[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  if (snapshot.source !== initialOrders)
    setSnapshot({
      source: initialOrders,
      orders: initialOrders,
      loaded: initiallyFresh || initialOrders.length > 0,
    });

  useEffect(() => {
    if (!active) return;
    let alive = true;
    let inFlight = false;
    let refreshRequested = false;
    let checks = 0;
    let cursor = 0;
    // Consume a fresh server snapshot only once, not on later tab visits/manual refreshes.
    const canSeed = initiallyFresh && seeded.current !== initialOrders && attempt === 0;
    if (canSeed) seeded.current = initialOrders;
    let knownOrders: PurchaseOrder[] | null = canSeed ? initialOrders : null;
    let lastHistoryRead = canSeed ? Date.now() : -Infinity;
    const attemptStates = new Map<string, PurchaseOrder["paymentStatus"]>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const readOrders = async () => {
      const response = await fetch("/api/purchase/orders", {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.orders))
        throw new Error(data.error || "Billing history could not be refreshed. Please try again.");
      return data.orders as PurchaseOrder[];
    };
    const refresh = async (forceHistory = false) => {
      if (!alive || document.visibilityState === "hidden") return;
      if (inFlight) {
        if (forceHistory) refreshRequested = true;
        return;
      }
      clearTimeout(timer);
      inFlight = true;
      setSyncing(true);
      try {
        // Poll supported pending statuses every five seconds, but reread full history only
        // every 30s or on focus/manual refresh. Other providers still need each history read.
        const needsHistory =
          forceHistory ||
          !knownOrders ||
          Date.now() - lastHistoryRead >= 30_000 ||
          knownOrders.some(
            (order) => order.status === "pending" && !["cashfree", "demo"].includes(order.provider),
          );
        let orders = needsHistory ? await readOrders() : knownOrders!;
        if (needsHistory) lastHistoryRead = Date.now();
        if (!alive) return;
        const pending = orders.filter(
          (order) => order.status === "pending" && ["cashfree", "demo"].includes(order.provider),
        );
        // Rotate a bounded batch so older pending orders also receive confirmation checks.
        const batch = Array.from(
          { length: Math.min(4, pending.length) },
          (_, index) => pending[(cursor + index) % pending.length],
        );
        cursor += batch.length;
        const results = await Promise.allSettled(
          batch.map(async (order) => {
            const response = await fetch(`/api/checkout/status/${encodeURIComponent(order.id)}`, {
              cache: "no-store",
              signal: controller.signal,
            });
            const data = await response.json();
            if (!response.ok) throw new Error("Payment status could not be checked.");
            return {
              id: order.id,
              status: data.order?.status,
              paymentStatus: data.order?.paymentStatus,
            };
          }),
        );
        if (!alive) return;
        if (
          results.some(
            (result) =>
              result.status === "fulfilled" &&
              result.value.status &&
              result.value.status !== "pending",
          )
        ) {
          orders = await readOrders();
          lastHistoryRead = Date.now();
        }
        if (!alive) return;
        for (const result of results) {
          if (result.status === "fulfilled") {
            const { id, status, paymentStatus } = result.value;
            if (status === "pending" && ["pending", "failed", "cancelled"].includes(paymentStatus))
              attemptStates.set(id, paymentStatus);
            else attemptStates.delete(id);
          }
        }
        orders = orders.map((order) =>
          order.status === "pending" && attemptStates.has(order.id)
            ? { ...order, paymentStatus: attemptStates.get(order.id) }
            : order,
        );
        knownOrders = orders;
        setSnapshot({ source: initialOrders, orders, loaded: true });
        setError(
          results.some((result) => result.status === "rejected")
            ? "Some payments could not be checked. Refresh to try again; avoid paying twice."
            : "",
        );
        if (orders.some((order) => order.status === "pending") && ++checks < 40)
          timer = setTimeout(() => void refresh(), 5000);
      } catch (reason) {
        knownOrders = null;
        if (alive) {
          setError(
            reason instanceof Error ? reason.message : "Billing history could not be refreshed.",
          );
          if (++checks < 40) timer = setTimeout(() => void refresh(), 5000);
        }
      } finally {
        inFlight = false;
        if (alive) setSyncing(false);
        if (alive && refreshRequested) {
          refreshRequested = false;
          void refresh(true);
        }
      }
    };
    const resume = () => {
      if (document.visibilityState !== "hidden") {
        checks = 0;
        void refresh(true);
      }
    };
    void refresh();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [active, initialOrders, initiallyFresh, attempt]);
  return {
    orders: snapshot.orders,
    loaded: snapshot.loaded,
    syncing,
    error,
    refresh: () => setAttempt((value) => value + 1),
  };
}
