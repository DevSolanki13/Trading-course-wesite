export function accessPeriodLabel(period: number, unit: "days" | "months") {
  return `${period} ${period === 1 ? unit.slice(0, -1) : unit}`;
}

export function accessExpiryLabel(expiresAt: string) {
  return `${new Date(expiresAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  })} IST`;
}
