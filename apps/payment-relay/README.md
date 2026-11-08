# IndianXtrade Payments (Android)

A standalone operator app for IndianXtrade and Academy bank-payment confirmation. Adapted from IndianXtrade's native SMS/PhonePe relay. It runs natively in the background and keeps a durable delivery queue.

```sh
npm ci
npx tsc --noEmit
npx expo prebuild --platform android --no-install
cd android
./gradlew :sms-reader:testDebugUnitTest assembleRelease -PreactNativeArchitectures=arm64-v8a
```

The generated APK is `android/app/build/outputs/apk/release/app-release.apk`. The production operator APK is signed with a private release key kept under ignored artifacts/payment-relay. Future builds must reuse that key to update installed operator phones. Supply PAYMENT_RELAY_KEYSTORE, PAYMENT_RELAY_STORE_PASSWORD, PAYMENT_RELAY_KEY_ALIAS and PAYMENT_RELAY_KEY_PASSWORD when building; the Expo signing plugin applies them without bundling secrets into the source. Keep the key and its password file in the owner's private backup. A build without those variables uses Expo's development signing key and is for local testing only. The owner build is preconfigured from this app’s ignored `.env.local` using `EXPO_PUBLIC_RELAY_SECRET` (the existing IndianXtrade SMS relay secret). The URL and sender filters are supplied by us. The owner never enters configuration or sees secrets. This private APK contains the relay credential and must only be given to the owner; never publish it as a public download. Shared mode forwards alerts for both websites to the same unchanged gateway. Backups and cleartext HTTP are disabled. Keep the operator phone private: its saved relay secrets authorize bank-credit reports.

Both sites use the same collection account and IndianXtrade's existing central deposit allocator. Academy consumes its own bound deposit's confirmed status through the existing API. No separate account markers or second bank-feed destination are required. Read [the deployment guide](../../docs/UPI-PAYMENTS.md) before enabling real payments.

Configuration changes are made by us before rebuilding the private APK. A queued message remains tied to the original destination name and origin. When replacing a phone/app, keep the old installation until its queue has drained, then disable it. Pending notifications can only be recovered from that installation's durable queue; SMS can also be recovered from the phone inbox. The app cannot recover alerts from before its initial enable checkpoint.

## Testing through an Expo QR code

Install the custom **IndianXtrade Payments Dev** Android APK once on the phone. Expo Go cannot load this app's native SMS/notification module. The development app uses `com.indianxtrade.payments.dev`, so it can be installed beside the production operator relay without replacing its saved settings.

Keep the computer and phone on the same Wi-Fi, then run from this folder:

```sh
npm run start:qr
```

Scan the terminal QR using the phone camera or open the development app and scan it there. For a phone on another network, use `npm run start:qr -- --tunnel` (Expo may offer to install its tunnel helper). No USB connection is needed after the development APK is installed. The prepared local environment also configures QR development sessions; do not enable two relay apps on the operator phone unintentionally.

To rebuild that development APK without attaching a phone:

```sh
npm run prebuild:dev
PAYMENT_RELAY_VARIANT=development ./android/gradlew -p android :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
```

The output is `android/app/build/outputs/apk/debug/app-debug.apk`. This variant permits local HTTP only to reach the development server; the production configuration keeps cleartext traffic disabled. Before rebuilding the production operator APK, run `npm run prebuild` to restore its native package and use the release signing environment described above.

## Owner interface

The screen contains separate IndianXtrade / Trading payments and Academy / Course payments rows, status, and only two controls: **Grant access** and **Start listening** (changes to **Stop listening**). Grant access walks the owner through Android SMS and notification-access prompts. One Start enables both the SMS receiver and PhonePe notification listener; one Stop disables both. There are no URL, secret, account, sender or payment-type inputs. Basic delivery counts and the last delivery time are shown without exposing bank-message text.

Differentiation is automatic in the existing gateway: amounts are reserved centrally, and an Academy order is bound to its own gateway deposit token. Only that deposit’s `COMPLETED` status can unlock that course. A trading deposit with no Academy binding cannot grant course access. The two business rows are readiness indicators, not invented per-business settlement counts. The phone forwards an alert once; the owner never chooses which business receives it.

Before building, prepare `apps/payment-relay/.env.local` with `EXPO_PUBLIC_RELAY_SECRET` using the owner’s existing IndianXtrade relay credential. This file is ignored and must never be committed. Run `npm run test:relay-ui` from the repository root (after installing this app’s dependencies) for permission denial, grant/start/stop, service-failure rollback and no-setup-fields checks. Native behavior still requires an Android device.

## Background operation

Start listening enables a native persistent service with an ongoing **Listening • IndianXtrade and Academy** notification, the static SMS receiver, and the Android notification listener. Neither SMS ingestion nor retry delivery uses React/JavaScript timers. Incoming alerts are synchronously saved before any network request. A failed request stays in the private outbox and retries on connectivity return, a native 30-second catch-up loop and a persisted system job. On reboot (after the first unlock) or app update, the previous listening preference is restored automatically. Stop disables both inputs and cancels recovery jobs.

The continuous monitoring service declares its specific operator-monitoring use case rather than Android's six-hour-limited `dataSync` service type. Android still controls scheduling: the owner must allow notifications and unrestricted battery/background operation. Device manufacturers may also require enabling Auto-start or removing the app from sleeping-app lists. Explicit Android **Force stop**, disabling permissions, uninstalling, or the Android active-app **Stop** control can stop background delivery; reopening and starting is required after an explicit stop. No app can promise delivery while the phone has no internet; its queued messages are sent when connectivity returns.
