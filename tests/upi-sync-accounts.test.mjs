import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";

test("bank mirror includes all approved collection accounts and excludes unrelated credits", async () => {
  const pythonBin = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
  const fixture = JSON.parse(
    execFileSync(
      pythonBin,
      [
        "-B",
        "-c",
        `
import importlib.util, json
spec = importlib.util.spec_from_file_location('mirror', 'backend/scripts/sync-academy-upi.py')
mirror = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirror)
assert mirror.collection_vpas({'vpa': ' FIRST@BANK '}) == ['first@bank']
assert mirror.collection_vpas({'vpas': [' FIRST@BANK ', 'second@bank', 'first@bank']}) == ['first@bank', 'second@bank']
for invalid in [[], ['first@bank', 'bad'], 'first@bank', [None]]:
    try:
        mirror.collection_vpas({'vpas': invalid})
    except ValueError:
        pass
    else:
        raise AssertionError('invalid accounts accepted')
print(json.dumps({'sql': mirror.SQL, 'vpas': ','.join(mirror.collection_vpas({'vpas': ['FIRST@BANK', 'second@bank']}))}))
`,
      ],
      { encoding: "utf8" },
    ),
  );
  const db = new PGlite();
  try {
    await db.exec(`
      create table "User"(id text,email text);
      create table "Deposit"(id text,"userId" text,"checkoutToken" text,"amountInr" integer,status text,"claimedUtr" text,"updatedAt" timestamptz,"matchedCreditId" text,method text);
      create table "BankCredit"(id text,utr text,"amountInr" integer,"receivedAt" timestamptz,consumed boolean,vpa text);
      insert into "User" values('collector','collector@example.invalid'),('trader','trader@example.invalid');
      insert into "Deposit" values('academy','collector','academy-token',100000,'AWAITING_PAYMENT',null,now(),null,'UPI'),('trading','trader','trading-token',100000,'AWAITING_PAYMENT',null,now(),null,'UPI');
      insert into "BankCredit" values
       ('first','111111111111',100000,now(),false,'first@bank'),
       ('second','222222222222',100001,now(),false,'SECOND@BANK'),
       ('multi','333333333333',100002,now(),false,'elsewhere@bank, second@bank'),
       ('foreign','444444444444',100003,now(),false,'elsewhere@bank'),
       ('consumed','555555555555',100004,now(),true,'first@bank');
    `);
    const query = fixture.sql
      .replaceAll(":'collector'", "'collector@example.invalid'")
      .replaceAll(":'vpas'", `'${fixture.vpas}'`);
    const results = await db.exec(query);
    const snapshot = results[2].rows[0].jsonb_build_object;
    assert.deepEqual(
      snapshot.credits.map((credit) => credit.id),
      ["first", "multi", "second"],
    );
    assert.deepEqual(
      snapshot.deposits.map((deposit) => deposit.token),
      ["academy-token"],
    );
  } finally {
    await db.close();
  }
});
