package expo.modules.smsreader

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.PendingIntent
import android.os.Handler
import android.os.Looper
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Holds foreground-service priority so Android doesn't kill the app process
 * while backgrounded — the existing static SMS receiver keeps working
 * regardless, but this also gives a good, long-lived place to watch for
 * connectivity coming back and run the backlog catch-up scan then, which is
 * the clearest "phone just came online" signal available.
 */
class RelayForegroundService : Service() {
  private val retryHandler = Handler(Looper.getMainLooper())
  private val retryTask = object : Runnable {
    override fun run() {
      Thread { SmsCatchUp.run(applicationContext) }.start()
      retryHandler.postDelayed(this, 30_000)
    }
  }


  private var networkCallback: ConnectivityManager.NetworkCallback? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!RelayStore.isEnabled(this)) { stopSelf(); return START_NOT_STICKY }
    RelayJobs.schedule(this)
    createNotificationChannel()

    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("IndianXtrade Payments")
      .setContentText("Listening • IndianXtrade and Academy")
      .setStyle(NotificationCompat.BigTextStyle().bigText("Listening for payment messages in the background. IndianXtrade and Academy payments are matched automatically."))
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setOnlyAlertOnce(true)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .setContentIntent(packageManager.getLaunchIntentForPackage(packageName)?.let {
        PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      })
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setOngoing(true)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }

    registerNetworkCallback()
    retryHandler.removeCallbacks(retryTask)
    retryHandler.postDelayed(retryTask, 30_000)
    // Also catch up right away — covers "was off/disabled while offline,
    // now reopening/re-enabling" without waiting for a network transition.
    Thread { SmsCatchUp.run(applicationContext) }.start()

    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // Swiping away the screen must not disable native capture or its retry queue.
    if (RelayStore.isEnabled(this)) RelayJobs.kick(this)
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    retryHandler.removeCallbacks(retryTask)
    unregisterNetworkCallback()
    super.onDestroy()
  }

  private fun registerNetworkCallback() {
    if (networkCallback != null) return

    val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val request = NetworkRequest.Builder()
      .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .build()

    val callback = object : ConnectivityManager.NetworkCallback() {
      override fun onAvailable(network: Network) {
        Log.d(TAG, "network available, running catch-up")
        Thread { SmsCatchUp.run(applicationContext) }.start()
      }
    }

    runCatching { connectivityManager.registerNetworkCallback(request, callback) }
      .onSuccess { networkCallback = callback }
      .onFailure { Log.d(TAG, "failed to register network callback: ${it.message}") }
  }

  private fun unregisterNetworkCallback() {
    val callback = networkCallback ?: return
    val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    runCatching { connectivityManager.unregisterNetworkCallback(callback) }
    networkCallback = null
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java)
      val channel = NotificationChannel(
        CHANNEL_ID,
        "IndianXtrade Payments listening",
        NotificationManager.IMPORTANCE_LOW,
      )
      manager.createNotificationChannel(channel)
    }
  }

  companion object {
    private const val TAG = "RelayForegroundService"
    private const val CHANNEL_ID = "relay_listening"
    private const val NOTIFICATION_ID = 1
  }
}
