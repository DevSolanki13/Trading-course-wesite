import { useEffect, useState } from "react";
import {
  AppState,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  configure,
  getActivityLog,
  getStats,
  isEnabled,
  isNotifAccessGranted,
  openNotifAccessSettings,
  requestIgnoreBatteryOptimizations,
  setEnabled,
  setNotifEnabled,
  startForegroundService,
  stopForegroundService,
} from "../modules/sms-reader";
import { RELAY_CONFIG, relayBuildReady } from "../src/relayConfig";

const SMS_PERMISSIONS = [
  PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
  PermissionsAndroid.PERMISSIONS.READ_SMS,
];

async function smsAccessGranted() {
  if (Platform.OS !== "android") return false;
  const permissions = [...SMS_PERMISSIONS];
  if (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS && Number(Platform.Version) >= 33)
    permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  return (
    await Promise.all(permissions.map((permission) => PermissionsAndroid.check(permission)))
  ).every(Boolean);
}

async function savePreparedConfiguration() {
  if (!relayBuildReady()) throw new Error("App setup is incomplete. Please contact support.");
  await configure(
    JSON.stringify(RELAY_CONFIG.targets),
    RELAY_CONFIG.senders,
    RELAY_CONFIG.deviceLabel,
  );
}

export default function Home() {
  const [listening, setListening] = useState(false);
  const [smsGranted, setSmsGranted] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(false);
  const [stats, setStats] = useState({ sent: 0, failed: 0 });
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = smsGranted && notificationGranted && relayBuildReady();

  useEffect(() => {
    let active = true;
    let refreshing = false;
    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const [enabled, sms, notifications, counts, activity] = await Promise.all([
          isEnabled(),
          smsAccessGranted(),
          isNotifAccessGranted(),
          getStats(),
          getActivityLog(),
        ]);
        if (!active) return;
        setListening(enabled);
        setSmsGranted(sms);
        setNotificationGranted(notifications);
        setStats(counts);
        setLastSentAt(activity.find((entry) => entry.ok && entry.sender !== "system")?.at ?? null);
        // One Start/Stop controls both native ingestion paths, including after permission changes.
        await setNotifEnabled(enabled && sms && notifications && relayBuildReady());
      } catch {
        if (active) setError("Could not check listening status. Please reopen the app.");
      } finally {
        refreshing = false;
      }
    }
    void savePreparedConfiguration()
      .then(refresh)
      .catch(() => {
        if (active) setError("App setup is incomplete. Please contact support.");
      });
    const interval = setInterval(() => void refresh(), 2000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  async function grantAccess() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await savePreparedConfiguration();
      const results = await PermissionsAndroid.requestMultiple(SMS_PERMISSIONS);
      const sms = SMS_PERMISSIONS.every(
        (permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED,
      );
      setSmsGranted(sms);
      if (!sms) {
        setError("Allow SMS access to receive payment confirmations.");
        return;
      }
      if (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
        const notificationPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (notificationPermission !== PermissionsAndroid.RESULTS.GRANTED) {
          setError("Allow notifications so the listening status stays visible.");
          return;
        }
      }
      const notifications = await isNotifAccessGranted();
      setNotificationGranted(notifications);
      if (!notifications) await openNotifAccessSettings();
    } catch {
      setError("Could not request access. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleListening() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (listening) {
        await setNotifEnabled(false);
        await setEnabled(false);
        await stopForegroundService();
        setListening(false);
        return;
      }
      await savePreparedConfiguration();
      if (!(await smsAccessGranted()) || !(await isNotifAccessGranted())) {
        setError("Grant access before starting.");
        return;
      }
      await requestIgnoreBatteryOptimizations().catch(() => {});
      await setEnabled(true);
      await setNotifEnabled(true);
      try {
        await startForegroundService();
      } catch (reason) {
        await setNotifEnabled(false);
        await setEnabled(false);
        throw reason;
      }
      setListening(true);
    } catch {
      setError("Could not change listening status. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const status = listening ? (ready ? "Listening" : "Access needed") : "Stopped";
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.label}>Payment listener</Text>
        <View style={styles.statusRow}>
          <View
            style={[styles.dot, { backgroundColor: listening && ready ? "#2fbd85" : "#93a2b4" }]}
          />
          <Text accessibilityRole="header" style={styles.status}>
            {status}
          </Text>
        </View>
        <Text style={styles.muted}>Payment confirmations are handled automatically.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.siteRow}>
          <View>
            <Text style={styles.siteName}>IndianXtrade</Text>
            <Text style={styles.muted}>Trading payments</Text>
          </View>
          <Text style={styles.siteStatus}>{listening && ready ? "Listening" : "Ready"}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.siteRow}>
          <View>
            <Text style={styles.siteName}>Academy</Text>
            <Text style={styles.muted}>Course payments</Text>
          </View>
          <Text style={styles.siteStatus}>{listening && ready ? "Listening" : "Ready"}</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || ready }}
        disabled={busy || ready}
        onPress={() => void grantAccess()}
        style={[styles.button, styles.secondary, ready && styles.dimmed]}
      >
        <Text style={styles.secondaryText}>{ready ? "Access granted" : "Grant access"}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || (!ready && !listening) }}
        disabled={busy || (!ready && !listening)}
        onPress={() => void toggleListening()}
        style={[
          styles.button,
          { backgroundColor: listening ? "#e0526a" : "#2fbd85" },
          !ready && !listening && styles.dimmed,
        ]}
      >
        <Text style={[styles.buttonText, { color: listening ? "#ffffff" : "#06231a" }]}>
          {busy ? "Please wait…" : listening ? "Stop listening" : "Start listening"}
        </Text>
      </Pressable>
      {!ready && !error && (
        <Text style={styles.hint}>
          Allow SMS and notification access, then tap Start listening.
        </Text>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <View style={styles.summary}>
        <Text style={styles.muted}>
          Sent {stats.sent} · Retry attempts {stats.failed}
        </Text>
        {lastSentAt ? (
          <Text style={styles.muted}>Last sent {new Date(lastSentAt).toLocaleTimeString()}</Text>
        ) : null}
      </View>
      <Text style={styles.hint}>You can leave the app in the background while listening.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, padding: 24, paddingBottom: 40, gap: 14, justifyContent: "center" },
  card: {
    backgroundColor: "#16202c",
    borderColor: "#253243",
    borderWidth: 1,
    borderRadius: 10,
    padding: 18,
    gap: 10,
  },
  label: {
    color: "#a9b5c5",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  status: { fontSize: 26, fontWeight: "700", color: "#e8edf3" },
  muted: { color: "#a9b5c5", fontSize: 12, lineHeight: 18 },
  siteRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  siteName: { color: "#e8edf3", fontSize: 15, fontWeight: "600" },
  siteStatus: { color: "#9fdcc2", fontSize: 12 },
  divider: { height: 1, backgroundColor: "#253243", marginVertical: 4 },
  button: { borderRadius: 10, paddingVertical: 16, alignItems: "center", minHeight: 50 },
  secondary: { backgroundColor: "#1e2a3a", borderColor: "#34475f", borderWidth: 1 },
  secondaryText: { color: "#e8edf3", fontSize: 15, fontWeight: "600" },
  buttonText: { fontSize: 15, fontWeight: "700" },
  dimmed: { opacity: 0.55 },
  hint: { color: "#a9b5c5", fontSize: 12, lineHeight: 18, textAlign: "center" },
  error: { color: "#ffc2cb", fontSize: 13, lineHeight: 19, textAlign: "center" },
  summary: { alignItems: "center", gap: 3, paddingVertical: 6 },
});
