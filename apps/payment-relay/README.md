# IndianXtrade Payments (Android)

A standalone operator app for IndianXtrade and Academy bank-payment confirmation. Adapted from IndianXtrade's native SMS/PhonePe relay. It runs natively in the background and keeps a durable delivery queue.

```sh
npm ci
npx tsc --noEmit
npx expo prebuild --platform android --no-install
cd android
./gradlew :sms-reader:testDebugUnitTest assembleRelease -PreactNativeArchitectures=arm64-v8a
```

The generated APK is `android/app/build/outputs/apk/release/app-release.apk`. The production operator APK is signed with a private release key kept under ignored artifacts/payment-relay. Future builds must reuse that key to update installed operator phones. Supply PAYMENT_RELAY_KEYSTORE, PAYMENT_RELAY_STORE_PASSWORD, PAYMENT_RELAY_KEY_ALIAS and PAYMENT_RELAY_KEY_PASSWORD when building; the Expo signing plugin applies them without bundling secrets into the source. Keep the key and its password file in the owner's private backup. A build without those variables uses Expo's development signing key and is for local testing only. No credentials are baked into the bundle. Enter the existing IndianXtrade HTTPS address and SMS_RELAY_SECRET on the phone. Shared mode forwards alerts for both websites to the same unchanged gateway. Backups and cleartext HTTP are disabled. Keep the operator phone private: its saved relay secrets authorize bank-credit reports.

Both sites use the same collection account and IndianXtrade's existing central deposit allocator. Academy consumes its own bound deposit's confirmed status through the existing API. No separate account markers or second bank-feed destination are required. Read [the deployment guide](../../docs/UPI-PAYMENTS.md) before enabling real payments.

Stop the relay before editing configuration. A queued message remains tied to the original destination name and origin. When replacing a phone/app, keep the old installation until its queue has drained, then disable it. Pending notifications can only be recovered from that installation's durable queue; SMS can also be recovered from the phone inbox. The app cannot recover alerts from before its initial enable checkpoint.
