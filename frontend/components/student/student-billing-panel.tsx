"use client";

import Link from "next/link";
import type { PurchaseOrder, PurchaseOrdersPage } from "../../../shared/purchase";
import { purchaseReceiptHref } from "../../../shared/purchase";
import { StudentBillingSkeleton } from "./student-billing-skeleton";

const billingDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

export interface StudentBillingPanelProps {
  orders: PurchaseOrder[];
  onBrowseCourses: () => void;
  syncing?: boolean;
  error?: string;
  onRefresh?: () => void;
  page?: PurchaseOrdersPage;
  pageNumber?: number;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
  status?: string;
  provider?: string;
  onStatusChange?: (value: string) => void;
  onProviderChange?: (value: string) => void;
}

export function StudentBillingPanel({
  orders,
  onBrowseCourses,
  syncing = false,
  error = "",
  onRefresh,
  page,
  pageNumber = 1,
  onNextPage,
  onPreviousPage,
  status = "all",
  provider = "all",
  onStatusChange,
  onProviderChange,
}: StudentBillingPanelProps) {
  return (
    <div>
      <div className="student-greeting-head">
        <div>
          <h1>Billing & receipts</h1>
          <p>Order history, GST payment receipts, and enrollment invoices.</p>
        </div>
        {onRefresh && (
          <button
            type="button"
            className="button button-secondary"
            onClick={onRefresh}
            disabled={syncing}
          >
            {syncing ? "Checking payments…" : "Refresh payments"}
          </button>
        )}
      </div>
      {onStatusChange && onProviderChange && (
        <div className="student-greeting-head">
          <label>
            Status{" "}
            <select
              aria-label="Order status"
              value={status}
              disabled={syncing}
              onChange={(event) => onStatusChange(event.target.value)}
            >
              {["all", "pending", "paid", "failed", "cancelled", "refunded"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Provider{" "}
            <select
              aria-label="Payment provider"
              value={provider}
              disabled={syncing}
              onChange={(event) => onProviderChange(event.target.value)}
            >
              {["all", "cashfree", "demo", "upi", "razorpay", "mock"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {page && (
        <p role="status">
          {page.totalCount} orders · {page.filteredCount} matching · Total ₹
          {(page.totalAmount / 100).toLocaleString("en-IN")} · Paid ₹
          {(page.paidAmount / 100).toLocaleString("en-IN")} · {page.pendingCount} pending
        </p>
      )}
      {syncing && orders.length > 0 && <p role="status">Syncing your latest transactions…</p>}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {page && onNextPage && onPreviousPage && (
        <nav aria-label="Order history pages">
          <button
            type="button"
            className="button button-secondary"
            disabled={syncing || pageNumber === 1}
            onClick={onPreviousPage}
          >
            Previous orders
          </button>
          <span aria-live="polite"> Page {pageNumber} </span>
          <button
            type="button"
            className="button button-secondary"
            disabled={syncing || !page.nextCursor}
            onClick={onNextPage}
          >
            Next orders
          </button>
        </nav>
      )}

      {syncing && !orders.length ? (
        <StudentBillingSkeleton />
      ) : orders.length ? (
        <div className="student-orders-card">
          <table className="student-orders-table" role="table" aria-label="Billing & receipts">
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">
                  Order
                </th>
                <th scope="col" role="columnheader">
                  Course
                </th>
                <th scope="col" role="columnheader">
                  Date (IST)
                </th>
                <th scope="col" role="columnheader">
                  Amount
                </th>
                <th scope="col" role="columnheader">
                  Status
                </th>
                <th scope="col" role="columnheader">
                  Receipt
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {orders.map((order) => {
                const displayedStatus =
                  order.status === "pending" ? (order.paymentStatus ?? order.status) : order.status;
                const paidTimestamp =
                  ["paid", "refunded"].includes(order.status) &&
                  order.paidAt &&
                  Number.isFinite(Date.parse(order.paidAt))
                    ? order.paidAt
                    : null;
                const timestamp = paidTimestamp ?? order.createdAt;
                const date = new Date(timestamp);
                const formattedDate = Number.isFinite(date.getTime())
                  ? billingDateFormatter.format(date)
                  : null;

                return (
                  <tr key={order.id} role="row">
                    <td role="cell" data-label="Order">
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: "12px",
                          color: "var(--muted)",
                        }}
                      >
                        {order.id.slice(0, 8)}…
                      </span>
                    </td>
                    <td role="cell" data-label="Course" className="student-order-course">
                      <strong>{order.courseTitle}</strong>
                    </td>
                    <td role="cell" data-label="Date (IST)">
                      {formattedDate ? (
                        <time
                          dateTime={timestamp}
                          title={`${paidTimestamp ? "Payment confirmed" : "Order placed"} (IST, UTC+05:30)`}
                          style={{ color: "var(--muted)" }}
                        >
                          {formattedDate}
                        </time>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>Date unavailable</span>
                      )}
                    </td>
                    <td role="cell" data-label="Amount">
                      <strong>
                        ₹
                        {(order.amount / 100).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </strong>
                    </td>
                    <td role="cell" data-label="Status">
                      <span className={`student-order-status-badge ${displayedStatus}`}>
                        {displayedStatus}
                      </span>
                    </td>
                    <td role="cell" data-label="Receipt" className="student-order-action">
                      {["paid", "refunded"].includes(order.status) ? (
                        <Link
                          href={purchaseReceiptHref(order)}
                          className="button button-secondary button-sm"
                        >
                          View receipt
                        </Link>
                      ) : order.status === "pending" ? (
                        <Link
                          href={
                            order.provider === "upi"
                              ? `/checkout/success?orderId=${order.id}`
                              : `/checkout/status/${order.id}`
                          }
                          className="button button-secondary button-sm"
                        >
                          Check status
                        </Link>
                      ) : (
                        <Link
                          href={`/checkout/${order.slug || order.courseId}`}
                          className="button button-primary button-sm"
                        >
                          Retry checkout
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="student-empty-state">
          <h3>
            {page && page.totalCount > 0
              ? "No orders match these filters"
              : "No purchase history found"}
          </h3>
          <p>
            {page && page.totalCount > 0
              ? "Change the status or provider filter to see your other orders."
              : "When you purchase a course, your tax receipt and order invoice will appear here."}
          </p>
          <button type="button" className="button button-primary" onClick={onBrowseCourses}>
            Browse courses
          </button>
        </div>
      )}
    </div>
  );
}
