"use client";

import Link from "next/link";
import type { PurchaseOrder } from "../../../shared/purchase";

export interface StudentBillingPanelProps {
  orders: PurchaseOrder[];
  onBrowseCourses: () => void;
}

export function StudentBillingPanel({ orders, onBrowseCourses }: StudentBillingPanelProps) {
  return (
    <div>
      <div className="student-greeting-head">
        <div>
          <h1>Billing & receipts</h1>
          <p>Order history, GST payment receipts, and enrollment invoices.</p>
        </div>
      </div>

      {orders.length ? (
        <div className="student-orders-card">
          <table className="student-orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Course</th>
                <th>Date (IST)</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const formattedDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Kolkata",
                });

                return (
                  <tr key={order.id}>
                    <td>
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
                    <td>
                      <strong>{order.courseTitle}</strong>
                    </td>
                    <td>
                      <span style={{ color: "var(--muted)" }}>{formattedDate}</span>
                    </td>
                    <td>
                      <strong>
                        ₹
                        {(order.amount / 100).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </strong>
                    </td>
                    <td>
                      <span className={`student-order-status-badge ${order.status}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>
                      {["paid", "refunded"].includes(order.status) ? (
                        <Link
                          href={`/dashboard/orders/${order.id}/receipt`}
                          className="button button-secondary button-sm"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                        >
                          View receipt
                        </Link>
                      ) : order.status === "pending" ? (
                        <Link
                          href={`/checkout/status/${order.id}`}
                          className="button button-secondary button-sm"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                        >
                          Check status
                        </Link>
                      ) : (
                        <Link
                          href={`/checkout/${order.slug || order.courseId}`}
                          className="button button-primary button-sm"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
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
          <h3>No purchase history found</h3>
          <p>When you purchase a course, your tax receipt and order invoice will appear here.</p>
          <button type="button" className="button button-primary" onClick={onBrowseCourses}>
            Browse courses
          </button>
        </div>
      )}
    </div>
  );
}
