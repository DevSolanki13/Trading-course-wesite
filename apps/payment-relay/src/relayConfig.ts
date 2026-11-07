import type { RelayConfig } from "./types";
// Operator credentials are entered on the device, never bundled into the APK.
export const RELAY_CONFIG: RelayConfig = {
  targets: [
    {
      name: "IndianXtrade & Academy",
      serverUrl: "https://indianxtrade.com",
      secret: "",
      markers: [],
      sharedGateway: true,
    },
  ],
  senders: ["SBI", "CANBNK", "CANARA", "HDFC", "INDUS", "IDFC", "PHONEPE", "PHONPE"],
  deviceLabel: "IndianXtrade payment phone",
};
