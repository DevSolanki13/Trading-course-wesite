export interface RelayTarget {
  name: string;
  serverUrl: string;
  secret: string;
  markers: string[];
}
export interface RelayConfig {
  targets: RelayTarget[];
  senders: string[];
  deviceLabel: string;
}
