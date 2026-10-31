/** Compare-and-set completion: a delayed worker cannot overwrite a newer lease. */
export async function finishNotification(db, row, success) {
  const backoff = Math.min(86400, 300 * 2 ** Math.min(row.attempts, 8));
  const result = success
    ? await db.query(
        "update notification_outbox set state='sent',claimed_until=null where id=$1 and state='sending' and attempts=$2 and claimed_until>now() returning id",
        [row.id, row.attempts],
      )
    : await db.query(
        "update notification_outbox set state='failed',claimed_until=null,next_attempt_at=now()+make_interval(secs=>$2) where id=$1 and state='sending' and attempts=$3 and claimed_until>now() returning id",
        [row.id, backoff, row.attempts],
      );
  return result.rows.length === 1;
}
