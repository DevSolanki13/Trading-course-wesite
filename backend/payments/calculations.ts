export type Coupon = { kind: "fixed" | "percent"; value: number };
export type TotalInput = {
  basePaise: number;
  gstEnabled: boolean;
  gstRateBps: number;
  coupon?: Coupon | null;
};
export function calculateTotal({ basePaise, gstEnabled, gstRateBps, coupon }: TotalInput) {
  const discountPaise = coupon
    ? coupon.kind === "fixed"
      ? Math.min(basePaise, coupon.value)
      : Math.floor((basePaise * coupon.value) / 10000)
    : 0;
  const taxablePaise = basePaise - discountPaise;
  const taxPaise = gstEnabled ? Math.floor((taxablePaise * gstRateBps) / 10000) : 0;
  return { basePaise, discountPaise, taxPaise, totalPaise: taxablePaise + taxPaise };
}
