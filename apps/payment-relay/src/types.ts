export interface RelayTarget {
  name: string;
  serverUrl: string;
  secret: string;
  markers: string[];
  sharedGateway?: boolean;
}
export interface RelayConfig {
  targets: RelayTarget[];
  senders: string[];
  deviceLabel: string;
}
