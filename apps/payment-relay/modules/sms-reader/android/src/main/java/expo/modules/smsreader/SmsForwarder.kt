package expo.modules.smsreader

import android.content.Context
import android.os.Build
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONArray
import org.json.JSONObject

/** Persist first. Queue locking never holds a network request or waits for connectivity. */
object SmsForwarder {
  private val queueLock = Any()
  private val flushing = AtomicBoolean(false)
  private const val QUEUE_LIMIT = 2000

  fun enqueue(context: Context, config: RelayStore.Config, sender: String, body: String,
              receivedAt: Long, source: String = "sms-relay"): Pair<Boolean, String> = synchronized(queueLock) {
    val targets = JSONArray(config.targetsJson)
    val markers = (0 until targets.length()).map { i ->
      val list = targets.getJSONObject(i).getJSONArray("markers")
      (0 until list.length()).map { list.getString(it) }
    }
    val shared = targets.length() == 1 && targets.getJSONObject(0).optBoolean("sharedGateway", false)
    val matches = if (shared) listOf(0) else RelayRouting.matchingTargets(markers, body)
    if (matches.size != 1) return@synchronized true to "Not forwarded: ambiguous or unknown account"
    val target = targets.getJSONObject(matches.single())
    val id = MessageDigest.getInstance("SHA-256").digest("${target.getString("serverUrl")}|$sender|$body|$receivedAt".toByteArray()).joinToString("") { "%02x".format(it) }
    val preferences = context.getSharedPreferences("payment_outbox", Context.MODE_PRIVATE)
    if (preferences.getStringSet("delivered", emptySet())!!.contains(id)) return@synchronized true to "Already delivered"
    val queue = load(context)
    if ((0 until queue.length()).none { queue.getJSONObject(it).getString("id") == id }) {
      if (queue.length() >= QUEUE_LIMIT) return@synchronized false to "Delivery queue full"
      val payload = JSONObject().apply {
        put("sender", sender); put("body", body); put("receivedAt", isoTimestamp(receivedAt))
        put("deviceLabel", config.deviceLabel); put("deviceModel", Build.MODEL ?: "unknown-device"); put("source", source)
      }
      queue.put(JSONObject().put("id", id).put("target", target.getString("name")).put("serverUrl", target.getString("serverUrl")).put("payload", payload))
      if (!save(context, queue)) return@synchronized false to "Could not persist delivery"
    }
    true to "Saved for delivery"
  }

  fun hasPending(context: Context): Boolean = synchronized(queueLock) { load(context).length() > 0 }

  fun flush(context: Context, config: RelayStore.Config, maximum: Int = 10) {
    if (!flushing.compareAndSet(false, true)) return
    try {
      val targets = JSONArray(config.targetsJson)
      val snapshot = synchronized(queueLock) { load(context) }
      val unavailable = mutableSetOf<String>()
      for (i in 0 until minOf(snapshot.length(), maximum)) {
        if (!RelayStore.isEnabled(context)) break
        val entry = snapshot.getJSONObject(i)
        val url = entry.getString("serverUrl")
        val target = (0 until targets.length()).map { targets.getJSONObject(it) }
          .find { it.getString("name") == entry.getString("target") && it.getString("serverUrl") == url }
        if (target == null || url in unavailable) continue
        val payload = entry.getJSONObject("payload")
        if (!post(target, payload)) {
          unavailable.add(url)
          RelayStore.recordAttempt(context, payload.getString("sender"), "", false, "Connection unavailable; retrying automatically")
          continue
        }
        synchronized(queueLock) {
          val preferences = context.getSharedPreferences("payment_outbox", Context.MODE_PRIVATE)
          val queue = load(context)
          val remaining = JSONArray()
          for (n in 0 until queue.length()) if (queue.getJSONObject(n).getString("id") != entry.getString("id")) remaining.put(queue.getJSONObject(n))
          val delivered = (preferences.getStringSet("delivered", emptySet())!!.toList() + entry.getString("id")).takeLast(500).toSet()
          // One commit: a crash cannot remove a message without remembering its successful delivery.
          preferences.edit().putString("pending", remaining.toString()).putStringSet("delivered", delivered).commit()
        }
        RelayStore.recordAttempt(context, payload.getString("sender"), "", true, "Payment alert delivered")
      }
    } finally { flushing.set(false) }
  }

  private fun load(context: Context) = JSONArray(context.getSharedPreferences("payment_outbox", Context.MODE_PRIVATE).getString("pending", "[]"))
  private fun save(context: Context, queue: JSONArray) = context.getSharedPreferences("payment_outbox", Context.MODE_PRIVATE).edit().putString("pending", queue.toString()).commit()

  private fun post(target: JSONObject, payload: JSONObject): Boolean {
    var connection: HttpURLConnection? = null
    return try {
      val url = URL("${target.getString("serverUrl").trimEnd('/')}/api/bank-feed/sms")
      if (url.protocol != "https") return false
      connection = url.openConnection() as HttpURLConnection
      connection.instanceFollowRedirects = false
      connection.requestMethod = "POST"
      connection.setRequestProperty("Content-Type", "application/json")
      connection.setRequestProperty("Authorization", "Bearer ${target.getString("secret")}")
      connection.doOutput = true
      connection.connectTimeout = 5000
      connection.readTimeout = 5000
      connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
      connection.responseCode in listOf(202, 400)
    } catch (_: Exception) { false }
    finally { connection?.disconnect() }
  }

  private fun isoTimestamp(millis: Long): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    formatter.timeZone = TimeZone.getTimeZone("UTC")
    return formatter.format(Date(millis))
  }
}
