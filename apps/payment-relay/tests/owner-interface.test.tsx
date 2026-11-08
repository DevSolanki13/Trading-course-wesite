import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import Home from "../app/index";

const native = vi.hoisted(() => ({
  configure: vi.fn(),
  getActivityLog: vi.fn(),
  getStats: vi.fn(),
  isEnabled: vi.fn(),
  isNotifAccessGranted: vi.fn(),
  openNotifAccessSettings: vi.fn(),
  requestIgnoreBatteryOptimizations: vi.fn(),
  setEnabled: vi.fn(),
  setNotifEnabled: vi.fn(),
  startForegroundService: vi.fn(),
  stopForegroundService: vi.fn(),
}));
const permissions = vi.hoisted(() => ({
  check: vi.fn(),
  request: vi.fn(),
  requestMultiple: vi.fn(),
  resume: null as null | ((state: string) => void),
  ready: true,
}));
vi.mock("../modules/sms-reader", () => native);
vi.mock("../src/relayConfig", () => ({
  RELAY_CONFIG: {
    targets: [
      {
        name: "IndianXtrade & Academy",
        serverUrl: "https://indianxtrade.com",
        secret: "operator-test-secret",
      },
    ],
    senders: ["HDFC"],
    deviceLabel: "Payment phone",
  },
  relayBuildReady: () => permissions.ready,
}));
vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  AppState: {
    addEventListener: (_: string, listener: (state: string) => void) => {
      permissions.resume = listener;
      return { remove: vi.fn() };
    },
  },
  PermissionsAndroid: {
    PERMISSIONS: { RECEIVE_SMS: "receive", READ_SMS: "read", POST_NOTIFICATIONS: "post" },
    RESULTS: { GRANTED: "granted" },
    check: permissions.check,
    request: permissions.request,
    requestMultiple: permissions.requestMultiple,
  },
  StyleSheet: { create: (styles: unknown) => styles },
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ children, accessibilityRole }: { children?: ReactNode; accessibilityRole?: string }) => (
    <span role={accessibilityRole === "header" ? "heading" : accessibilityRole}>{children}</span>
  ),
  Pressable: ({
    children,
    disabled,
    onPress,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onPress: () => void;
  }) => (
    <button disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
beforeEach(() => {
  vi.useFakeTimers();
  permissions.ready = true;
  for (const fn of Object.values(native)) fn.mockReset().mockResolvedValue(undefined);
  native.getActivityLog.mockResolvedValue([]);
  native.getStats.mockResolvedValue({ sent: 0, failed: 0 });
  native.isEnabled.mockResolvedValue(false);
  native.isNotifAccessGranted.mockResolvedValue(false);
  permissions.check.mockReset().mockResolvedValue(false);
  permissions.request.mockReset().mockResolvedValue("granted");
  permissions.requestMultiple
    .mockReset()
    .mockResolvedValue({ receive: "granted", read: "granted" });
});
afterEach(() => vi.useRealTimers());
async function show() {
  await act(async () => {
    render(<Home />);
  });
}

it("shows both businesses separately with only permissions and listening controls, without setup fields", async () => {
  await show();
  expect(screen.getByText("IndianXtrade")).toBeVisible();
  expect(screen.getByText("Academy")).toBeVisible();
  expect(screen.getAllByRole("button")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Grant access" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Start listening" })).toBeDisabled();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByText(/operator-test-secret|https:\/\//)).toBeNull();
});
it("grants access through Android and enables both payment paths with one Start, then stops both", async () => {
  await show();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Grant access" }));
  });
  expect(native.openNotifAccessSettings).toHaveBeenCalledTimes(1);
  permissions.check.mockResolvedValue(true);
  native.isNotifAccessGranted.mockResolvedValue(true);
  await act(async () => {
    permissions.resume?.("active");
  });
  expect(screen.getByRole("button", { name: "Access granted" })).toBeDisabled();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Start listening" }));
  });
  expect(native.setEnabled).toHaveBeenCalledWith(true);
  expect(native.setNotifEnabled).toHaveBeenCalledWith(true);
  expect(native.startForegroundService).toHaveBeenCalledTimes(1);
  expect(native.configure).toHaveBeenCalledWith(
    expect.stringContaining('"serverUrl":"https://indianxtrade.com"'),
    ["HDFC"],
    "Payment phone",
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Stop listening" }));
  });
  expect(native.setEnabled).toHaveBeenLastCalledWith(false);
  expect(native.setNotifEnabled).toHaveBeenLastCalledWith(false);
  expect(native.stopForegroundService).toHaveBeenCalledTimes(1);
});
it("keeps listening disabled if SMS permission is denied", async () => {
  permissions.requestMultiple.mockResolvedValue({ receive: "denied", read: "denied" });
  await show();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Grant access" }));
  });
  expect(screen.getByRole("alert")).toHaveTextContent("Allow SMS access");
  expect(native.startForegroundService).not.toHaveBeenCalled();
  expect(native.openNotifAccessSettings).not.toHaveBeenCalled();
});
it("rolls back both enabled flags if the background service cannot start", async () => {
  permissions.check.mockResolvedValue(true);
  native.isNotifAccessGranted.mockResolvedValue(true);
  native.startForegroundService.mockRejectedValue(new Error("Android denied service"));
  await show();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Start listening" }));
  });
  expect(native.setEnabled).toHaveBeenLastCalledWith(false);
  expect(native.setNotifEnabled).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole("alert")).toHaveTextContent("Could not change listening status");
});

it("requests visible notification permission and keeps start disabled when it is denied", async () => {
  permissions.request.mockResolvedValue("denied");
  await show();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Grant access" }));
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Allow notifications so the listening status stays visible",
  );
  expect(native.openNotifAccessSettings).not.toHaveBeenCalled();
  expect(native.startForegroundService).not.toHaveBeenCalled();
});
