// Disposable local fixture only; it never creates a deposit with a payment provider.
import { localDatabase } from "../../backend/local/database.ts";
const db = await localDatabase();
try {
  const user = (
    await db.query<{ id: string }>("select id from auth.users where email='demo@example.com'")
  ).rows[0].id;
  const order = (
    await db.query<{ id: string }>(
      "select purchase_create_order($1,'advance-course-with-live-qna','upi','http://127.0.0.1:3102')as id",
      [user],
    )
  ).rows[0].id;
  await db.query(
    'update orders set discount_paise=50000,total_paise=249900,course_snapshot=course_snapshot||\'{"coupon_code":"NIKHIL","discount_paise":50000}\' where id=$1 and provider_order_id is null',
    [order],
  );
  const claim = "99999999-9999-4999-8999-999999999999";
  const token = "test_only_gateway_fixture_not_a_deposit";
  await db.query("select purchase_upi_gateway_prepare($1,$2,$3)", [user, order, claim]);
  await db.query("select purchase_upi_gateway_save($1,$2,$3,$4)", [user, order, claim, token]);
  await db.query(
    "select purchase_upi_gateway_bind($1,$2,$3,$4,247914,'preview@invalid','ASM Trade',clock_timestamp()+interval '40 minutes','upi://pay?pa=preview%40invalid&pn=ASM%20Trade&am=2479.14&cu=INR')",
    [user, order, claim, token],
  );
} finally {
  await db.close();
}
