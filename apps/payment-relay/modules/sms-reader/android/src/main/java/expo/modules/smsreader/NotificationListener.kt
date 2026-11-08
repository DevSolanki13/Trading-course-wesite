package expo.modules.smsreader

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * Reads system notifications posted by the PhonePe Business app (or any
 * package the operator has allowlisted) and forwards each unique one to the
 * same bank-feed ingestion endpoint the SMS pipeline uses. Required because
 * a PhonePe merchant QR does NOT trigger a bank SMS — the money sits with
 * PhonePe until end-of-day settlement, and the Business app's own system
 * notification is the only per-payment signal the device ever sees.
 *
 * Fragile by design: PhonePe can change its notification text at any
 * release. The server-side parser is deliberately format-agnostic (currency
 * prefix + credit keyword + a bare digit string for the UTR), so moderate
 * copy edits don't break ingestion. A full redesign of the message would.
 *
 * The service runs in a system-managed process the OS binds whenever any
 * app posts a notification, so nothing on our side needs to keep it alive —
 * but the user must enable "Notification access" in system settings. Until
 * that's granted this service is just an idle manifest entry.
 */
class NotificationListener : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    val notification = sbn ?: return

    if (!RelayStore.isNotifEnabled(applicationContext)) return
    if (!RelayStore.isEnabled(applicationContext)) return

    val packages = RelayStore.getNotifPackages(applicationContext)
    if (notification.packageName !in packages) return

    val extras = notification.notification?.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
    val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()

    // Prefer EXTRA_BIG_TEXT when present — it carries the full UPI "Received
    // ₹X from Y, UTR: ..." line, where EXTRA_TEXT is sometimes just a short
    // "₹X received" summary without the reference number.
    val body = buildString {
      if (title.isNotBlank()) append(title)
      val longer = if (bigText.length > text.length) bigText else text
      if (longer.isNotBlank()) {
        if (isNotEmpty()) append(" | ")
        append(longer)
      }
    }.trim()

    if (body.isBlank()) {
      Log.d(TAG, "ignored: empty notification from ${notification.packageName}")
      return
    }

    val postedAt = notification.postTime
    if (postedAt < RelayStore.listeningStartedAt(applicationContext)) return
    // The durable outbox and server UTR constraint deduplicate deliveries.
    // Do not mark a notification seen before its payload has been persisted.

    val config = RelayStore.getConfig(applicationContext) ?: return
    val queued = SmsForwarder.enqueue(applicationContext, config, notification.packageName, body, postedAt, SOURCE)
    if (!queued.first) RelayStore.recordAttempt(applicationContext, notification.packageName, "", false, queued.second)
    RelayJobs.kick(applicationContext)
    Thread { SmsForwarder.flush(applicationContext, config, 1) }.start()
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    if (!RelayStore.isEnabled(applicationContext)) return
    for (notification in activeNotifications.orEmpty()) onNotificationPosted(notification)
    RelayJobs.kick(applicationContext)
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    if (RelayStore.isEnabled(applicationContext)) {
      requestRebind(android.content.ComponentName(this, NotificationListener::class.java))
    }
  }

  // onNotificationRemoved intentionally not overridden — PhonePe may clear
  // or re-post a notification many times for a single payment, and we rely
  // on the dedup key, not notification lifecycle, to deliver exactly once.

  companion object {
    private const val TAG = "NotifListener"
    private const val SOURCE = "phonepe-notif"
  }
}
