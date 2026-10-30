"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
/** Native form controls stay disabled until React can handle their events. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
