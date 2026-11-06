export function StudentBillingSkeleton() {
  return (
    <div className="student-orders-card student-billing-skeleton" role="status" aria-busy="true">
      <span className="sr-only">Loading billing & receipts…</span>
      <table className="student-orders-table" aria-hidden="true">
        <thead>
          <tr>
            {["Order", "Course", "Date (IST)", "Amount", "Status", "Receipt"].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3].map((row) => (
            <tr key={row}>
              {["order", "course", "date", "amount", "status", "receipt"].map((column) => (
                <td
                  key={column}
                  className={
                    column === "course"
                      ? "student-order-course"
                      : column === "receipt"
                        ? "student-order-action"
                        : undefined
                  }
                >
                  <div className={`skeleton student-billing-placeholder ${column}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
