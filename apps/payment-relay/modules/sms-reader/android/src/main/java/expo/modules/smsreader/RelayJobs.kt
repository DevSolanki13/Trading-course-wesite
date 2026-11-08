package expo.modules.smsreader

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/** System-persisted recovery independent of React Native and the foreground-service process. */
object RelayJobs {
  private const val PERIODIC_ID = 7041
  private const val DELIVERY_ID = 7042
  fun schedule(context: Context) {
    val scheduler = context.getSystemService(JobScheduler::class.java)
    val component = ComponentName(context, RelayRetryService::class.java)
    scheduler.schedule(JobInfo.Builder(PERIODIC_ID, component)
      .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true)
      .setPeriodic(15 * 60_000L).build())
  }
  fun kick(context: Context) {
    if (!RelayStore.isEnabled(context)) return
    val scheduler = context.getSystemService(JobScheduler::class.java)
    if (scheduler.getPendingJob(DELIVERY_ID) != null) return
    scheduler.schedule(JobInfo.Builder(DELIVERY_ID, ComponentName(context, RelayRetryService::class.java))
      .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setMinimumLatency(1000)
      .setBackoffCriteria(10_000, JobInfo.BACKOFF_POLICY_EXPONENTIAL).setPersisted(true).build())
  }
  fun cancel(context: Context) {
    val scheduler = context.getSystemService(JobScheduler::class.java)
    scheduler.cancel(PERIODIC_ID); scheduler.cancel(DELIVERY_ID)
  }
}

class RelayRetryService : JobService() {
  override fun onStartJob(params: JobParameters): Boolean {
    Thread {
      if (!RelayStore.isEnabled(applicationContext)) { jobFinished(params, false); return@Thread }
      runCatching { SmsCatchUp.run(applicationContext) }
      jobFinished(params, RelayStore.isEnabled(applicationContext) && SmsForwarder.hasPending(applicationContext))
    }.start()
    return true
  }
  override fun onStopJob(params: JobParameters): Boolean = RelayStore.isEnabled(applicationContext)
}

/** Android delivers these after unlock; persisted listening preference survives upgrades/reboots. */
class RelayBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action !in listOf(Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED)) return
    if (!RelayStore.isEnabled(context)) return
    RelayJobs.schedule(context); RelayJobs.kick(context)
    runCatching { ContextCompat.startForegroundService(context, Intent(context, RelayForegroundService::class.java)) }
  }
}
