import type { RelayConfig } from "./types";

// Prepared by us in the ignored .env.local before building the owner's private APK.
// Expo requires literal EXPO_PUBLIC_* property access to inline build configuration.
// This operator APK contains its relay credential: distribute only to the owner.
export const RELAY_CONFIG: RelayConfig = {
  targets: [
    {
      // Keep the persisted identity stable so an update can drain the existing outbox.
      name: "IndianXtrade & Academy",
      serverUrl: "https://indianxtrade.com",
      secret: process.env.EXPO_PUBLIC_RELAY_SECRET ?? "",
      markers: [],
      sharedGateway: true,
    },
  ],
  senders: (
    process.env.EXPO_PUBLIC_RELAY_SENDERS ?? "SBI,CANBNK,CANARA,HDFC,INDUS,IDFC,PHONEPE,PHONPE"
  )
    .split(",")
    .map((sender) => sender.trim())
    .filter(Boolean),
  deviceLabel: "IndianXtrade payment phone",
};

export function relayBuildReady() {
  return (
    RELAY_CONFIG.targets.every((target) => target.secret.trim().length >= 32) &&
    RELAY_CONFIG.senders.length > 0
  );
}
