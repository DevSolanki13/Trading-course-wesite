#!/usr/bin/env python3
"""Display-only Academy bank mirror. Runs beside the gateway, never in its code.

Reads the existing PostgreSQL container in a read-only transaction. Sends only
Academy's UPI deposit states and unconsumed credits in the shared collection
account. No SMS bodies, trading customers, admin cookies or USDT data leave it.
"""
import argparse
import fcntl
import json
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

SQL = r"""
begin transaction isolation level repeatable read read only;
set local statement_timeout='15s';
select jsonb_build_object(
 'version',1,'complete',true,'sourceAt',clock_timestamp(),
 'deposits',coalesce((select jsonb_agg(jsonb_build_object(
   'token',d."checkoutToken",'amount',d."amountInr",'status',d.status,
   'utr',coalesce(c.utr,d."claimedUtr"),'updatedAt',d."updatedAt") order by d.id)
   from "Deposit" d join "User" u on u.id=d."userId"
   left join "BankCredit" c on c.id=d."matchedCreditId"
   where u.email=:'collector' and upper(d.method)='UPI' and d."amountInr">0),'[]'::jsonb),
 'credits',coalesce((select jsonb_agg(jsonb_build_object(
   'id',c.id,'utr',c.utr,'amount',c."amountInr",'receivedAt',c."receivedAt") order by c.id)
   from "BankCredit" c where not c.consumed and c."amountInr">0
   and string_to_array(:'vpas',',') && regexp_split_to_array(lower(trim(c.vpa)),'\s*,\s*')),'[]'::jsonb)
);
rollback;
"""


def collection_vpas(config):
    entries = config.get("vpas", [config.get("vpa", "")])
    if not isinstance(entries, list) or not 1 <= len(entries) <= 32:
        raise ValueError("invalid collection accounts")
    if any(not isinstance(vpa, str) or not re.fullmatch(r"[a-z0-9._-]{1,256}@[a-z0-9._-]{1,64}", vpa.strip().lower()) for vpa in entries):
        raise ValueError("invalid collection accounts")
    return list(dict.fromkeys(vpa.strip().lower() for vpa in entries))


def snapshot(config):
    vpas = collection_vpas(config)
    result = subprocess.run(
        ["docker", "exec", "-i", config["container"], "psql", "-XqAt",
         "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", config["database"],
         "-v", "collector=" + config["collector"], "-v", "vpas=" + ",".join(vpas)],
        input=SQL, text=True, capture_output=True, timeout=25, check=True,
    )
    if len(result.stdout) > 10_000_000:
        raise ValueError("snapshot too large")
    data = json.loads(result.stdout)
    if not data.get("complete") or not isinstance(data.get("deposits"), list) or not isinstance(data.get("credits"), list):
        raise ValueError("incomplete snapshot")
    return data


def publish(config, data):
    origin = urllib.parse.urlsplit(config["supabaseUrl"])
    if origin.scheme != "https" or origin.path not in ("", "/") or origin.username or origin.password:
        raise ValueError("invalid destination")
    # No bearer admin key: the only write authority is the display-only sync secret.
    request = urllib.request.Request(
        config["supabaseUrl"].rstrip("/") + "/rest/v1/rpc/academy_upi_sync_snapshot",
        data=json.dumps({"p_secret": config["syncSecret"], "p_snapshot": data}).encode(),
        headers={"Content-Type": "application/json", "apikey": config["publishableKey"]},
        method="POST",
    )
    # Never forward the ingestion credential through an HTTP redirect.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    with urllib.request.build_opener(NoRedirect).open(request, timeout=25) as response:
        if response.status not in (200, 204):
            raise ValueError("snapshot rejected")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    config_file = pathlib.Path(args.config)
    # The secret permits only display-mirror updates, but is still private.
    if config_file.stat().st_mode & 0o077:
        raise ValueError("configuration permissions must be 600")
    with open(str(config_file) + ".lock", "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        config = json.loads(config_file.read_text())
        data = snapshot(config)
        if not args.dry_run:
            publish(config, data)
        print(json.dumps({"synced": not args.dry_run, "academyDeposits": len(data["deposits"]),
                          "sharedUnmatchedCredits": len(data["credits"])}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Driver/HTTP errors can contain SQL, URLs or secrets; withhold their text.
        print("Academy UPI sync failed (" + type(error).__name__ + "). Previous snapshot retained.", file=sys.stderr)
        sys.exit(1)
