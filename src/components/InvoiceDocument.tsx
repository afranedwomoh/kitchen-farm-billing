import { forwardRef } from "react";
import { formatMoney, formatDate } from "@/lib/format";

export type DocData = {
  kind: "INVOICE" | "QUOTATION";
  number: string;
  date: string;
  status?: string;
  business: { name: string; address?: string | null; phone?: string | null; email?: string | null; logoUrl?: string | null };
  customer: { name: string; phone?: string | null; email?: string | null; address?: string | null };
  items: { product_name: string; product_image_url_signed?: string | null; unit_price: number; quantity: number; line_total: number }[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  currency_symbol: string;
  notes?: string | null;
};

/**
 * A5 landscape invoice — actually A5 portrait 148mm x 210mm.
 * Rendered at ~3x for crisp html2canvas output: 559px x 793px (roughly A5 at 96dpi × 1.4).
 */
export const InvoiceDocument = forwardRef<HTMLDivElement, { data: DocData }>(function InvoiceDocument({ data }, ref) {
  const { business, customer, items, currency_symbol: sym } = data;
  return (
    <div
      ref={ref}
      style={{
        width: "559px",
        minHeight: "793px",
        background: "white",
        color: "#111",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        position: "relative",
        overflow: "hidden",
        padding: "28px 32px",
        boxSizing: "border-box",
      }}
    >
      {/* Watermark logo */}
      {business.logoUrl && (
        <img
          src={business.logoUrl}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(-18deg)",
            width: "420px",
            opacity: 0.06,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
        <div>
          {business.logoUrl && <img src={business.logoUrl} alt="" crossOrigin="anonymous" style={{ height: 42, marginBottom: 6 }} />}
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.2 }}>{business.name}</div>
          <div style={{ fontSize: 10, color: "#555", lineHeight: 1.4, marginTop: 2, whiteSpace: "pre-line" }}>
            {[business.address, business.phone, business.email].filter(Boolean).join("\n")}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>{data.kind}</div>
          <div style={{ fontSize: 11, color: "#555" }}>{data.number}</div>
          <div style={{ fontSize: 11, color: "#555" }}>{formatDate(data.date)}</div>
          {data.status && (
            <div style={{
              display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: 999,
              fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase",
              background: data.status === "paid" ? "#d1fae5" : "#fee2e2",
              color: data.status === "paid" ? "#065f46" : "#991b1b",
            }}>{data.status}</div>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: "#e5e7eb", margin: "16px 0", position: "relative" }} />

      {/* Bill to */}
      <div style={{ display: "flex", gap: 24, marginBottom: 14, position: "relative" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#888", marginBottom: 3 }}>Billed to</div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{customer.name}</div>
          <div style={{ fontSize: 10, color: "#555", whiteSpace: "pre-line", lineHeight: 1.4 }}>
            {[customer.address, customer.phone, customer.email].filter(Boolean).join("\n")}
          </div>
        </div>
      </div>

      {/* Items */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, position: "relative" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#666" }}>
            <th style={{ padding: "8px 4px", width: 36 }}></th>
            <th style={{ padding: "8px 4px" }}>Item</th>
            <th style={{ padding: "8px 4px", textAlign: "right", width: 40 }}>Qty</th>
            <th style={{ padding: "8px 4px", textAlign: "right", width: 80 }}>Unit</th>
            <th style={{ padding: "8px 4px", textAlign: "right", width: 90 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "6px 4px" }}>
                {it.product_image_url_signed ? (
                  <img src={it.product_image_url_signed} crossOrigin="anonymous" alt="" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 4, border: "1px solid #eee" }} />
                ) : (
                  <div style={{ width: 28, height: 28, background: "#f3f4f6", borderRadius: 4 }} />
                )}
              </td>
              <td style={{ padding: "6px 4px", fontWeight: 500 }}>{it.product_name}</td>
              <td style={{ padding: "6px 4px", textAlign: "right" }}>{it.quantity}</td>
              <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatMoney(it.unit_price, sym)}</td>
              <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 500 }}>{formatMoney(it.line_total, sym)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, position: "relative" }}>
        <div style={{ width: 220, fontSize: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span style={{ color: "#666" }}>Subtotal</span><span>{formatMoney(data.subtotal, sym)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span style={{ color: "#666" }}>VAT ({data.vat_rate}%)</span><span>{formatMoney(data.vat_amount, sym)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid #111", marginTop: 4, fontWeight: 700, fontSize: 13 }}>
            <span>Total</span><span>{formatMoney(data.total, sym)}</span>
          </div>
        </div>
      </div>

      {data.notes && (
        <div style={{ marginTop: 18, fontSize: 9, color: "#666", position: "relative" }}>
          <div style={{ textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Notes</div>
          <div style={{ whiteSpace: "pre-line" }}>{data.notes}</div>
        </div>
      )}

      <div style={{ position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 9, color: "#999", textAlign: "center", borderTop: "1px solid #eee", paddingTop: 8 }}>
        Thank you for your business.
      </div>
    </div>
  );
});
