import type { RelayConfig } from "./types";
// Operator credentials are entered on the device, never bundled into the APK.
export const RELAY_CONFIG: RelayConfig = {
  targets: [
    { name: "IndianXtrade", serverUrl: "https://asmtrader.com", secret: "", markers: [] },
    { name: "Academy", serverUrl: "", secret: "", markers: [] },
  ],
  senders: ["SBI", "CANBNK", "CANARA", "HDFC", "INDUS", "IDFC", "PHONEPE", "PHONPE"],
  deviceLabel: "IndianXtrade payment phone",
};
