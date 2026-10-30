"use client";
export function PrintReceipt() {
  return (
    <button className="button button-secondary print-control" onClick={() => window.print()}>
      Print receipt
    </button>
  );
}
