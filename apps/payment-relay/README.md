# IndianXtrade Payments (Android)

A standalone operator app for IndianXtrade and Academy bank-payment confirmation. Adapted from IndianXtrade's native SMS/PhonePe relay. It runs natively in the background and keeps a durable delivery queue.

```sh
npm ci
npx tsc --noEmit
npx expo prebuild --platform android --no-install
cd android
./gradlew :sms-reader:testDebugUnitTest assembleRelease -PreactNativeArchitectures=arm64-v8a
```

The generated APK is `android/app/build/outputs/apk/release/app-release.apk`. Expo's generated local release uses its development signing key; configure the owner's release signing key for ongoing production distribution and updates. No credentials are baked into the bundle. Enter the two site addresses, separate relay secrets and distinct account markers on the phone before enabling. Backups and cleartext HTTP are disabled. Keep the operator phone private: its saved relay secrets authorize bank-credit reports.

Use separate collection accounts whose bank SMS include distinguishable account text. Only a message matching exactly one destination is sent; unclear messages are shown in activity and remain in the original inbox for manual review. PhonePe notifications without an account marker cannot be automatically routed. Read [the deployment guide](../../docs/UPI-PAYMENTS.md) before enabling real payments.

Stop the relay before editing configuration. A queued message remains tied to the original destination name and origin. When replacing a phone/app, keep the old installation until its queue has drained, then disable it. Pending notifications can only be recovered from that installation's durable queue; SMS can also be recovered from the phone inbox. The app cannot recover alerts from before its initial enable checkpoint.
