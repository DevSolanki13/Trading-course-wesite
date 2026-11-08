package expo.modules.smsreader

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log

/**
 * Manifest-declared (static) receiver — unlike a dynamically registered one,
 * this fires even if the app process was killed, waking it briefly to
 * handle the broadcast. SMS_RECEIVED is one of the implicit broadcasts
 * Android still exempts from the API 26+ manifest-receiver restrictions.
 *
 * The whole forward — filter, HTTP POST, log the result — happens here in
 * Kotlin on a background thread, deliberately not routed through JS. JS
 * timers are suspended while the app is backgrounded, which is exactly the
 * failure mode this replaces (forwarding only happened when the app was
 * reopened).
 */
class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    Log.d(TAG, "onReceive action=${intent.action}")
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

    if (!RelayStore.isEnabled(context)) {
      Log.d(TAG, "ignored: not enabled")
      return
    }

    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
    if (messages.isEmpty()) return

    val sender = messages[0].displayOriginatingAddress ?: "unknown"
    val body = messages.joinToString("") { it.displayMessageBody ?: "" }

    if (body.isBlank()) return

    val config = RelayStore.getConfig(context)
    if (config == null) {
      Log.d(TAG, "ignored: no config saved")
      return
    }
    if (!RelayStore.isAllowedSender(sender, config.senders)) {
      Log.d(TAG, "ignored: sender not in allowlist ${config.senders}")
      return
    }

    // Commit before returning from the receiver: Android may terminate the process afterwards.
    val receivedAt = messages[0].timestampMillis
    val queued = SmsForwarder.enqueue(context, config, sender, body, receivedAt)
    if (!queued.first) RelayStore.recordAttempt(context, sender, "", false, queued.second)
    RelayJobs.kick(context)
    val pending = goAsync()
    Thread {
      try { SmsForwarder.flush(context, config, 1) }
      finally { pending.finish() }
    }.start()
  }

  companion object {
    private const val TAG = "SmsReceiver"
  }
}
