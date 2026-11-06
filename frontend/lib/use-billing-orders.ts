"use client";
import { useEffect, useState } from "react";
import type { PurchaseOrder } from "../../shared/purchase";

export function useBillingOrders(initialOrders: PurchaseOrder[], active: boolean) {
  const [snapshot, setSnapshot] = useState({ source: initialOrders, orders: initialOrders });
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  if (snapshot.source !== initialOrders)
    setSnapshot({ source: initialOrders, orders: initialOrders });

  useEffect(() => {
    if (!active) return;
    let alive = true;
    let inFlight = false;
    let checks = 0;
    let cursor = 0;
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
    const refresh = async () => {
      if (!alive || inFlight || document.visibilityState === "hidden") return;
      clearTimeout(timer);
      inFlight = true;
      setSyncing(true);
      try {
        let orders = await readOrders();
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
        )
          orders = await readOrders();
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
        setSnapshot({ source: initialOrders, orders });
        setError(
          results.some((result) => result.status === "rejected")
            ? "Some payments could not be checked. Refresh to try again; avoid paying twice."
            : "",
        );
        if (orders.some((order) => order.status === "pending") && ++checks < 40)
          timer = setTimeout(() => void refresh(), 5000);
      } catch (reason) {
        if (alive) {
          setError(
            reason instanceof Error ? reason.message : "Billing history could not be refreshed.",
          );
          if (++checks < 40) timer = setTimeout(() => void refresh(), 5000);
        }
      } finally {
        inFlight = false;
        if (alive) setSyncing(false);
      }
    };
    const resume = () => {
      if (document.visibilityState !== "hidden") {
        checks = 0;
        void refresh();
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
  }, [active, initialOrders, attempt]);
  return {
    orders: snapshot.orders,
    syncing,
    error,
    refresh: () => setAttempt((value) => value + 1),
  };
}
