/**
 * Payment-based revenue aggregation (cash-basis reporting).
 *
 * The invoices.payments jsonb column is the source of truth for when cash was
 * actually received. A single invoice can have multiple entries in payments[]
 * spanning different days (e.g. 40 KWD deposit on Apr 20, 40 KWD balance on
 * Apr 27 for an 80 KWD invoice).
 *
 * Reports must group by payment.date, NOT by invoice.created_at, so that each
 * day's report / monthly total reflects the cash received that day.
 *
 * Refunds: the original payments[] entries stay on their original days (cash
 * WAS received that day). The refund itself is a separate negative event on
 * refund_date and is handled by the caller — this aggregator INCLUDES payments
 * from refunded invoices so the original day's total is not retroactively
 * rewritten. Nets out across the range: +100 on payment day, -100 on refund
 * day = 0 total, which is how the store owner thinks about the books.
 */
export interface InvoicePayment {
  date: string;
  amount: number;
  method?: string;
  auth_number?: string;
}

export interface InvoiceLike {
  invoice_id: string;
  total: number;
  deposit?: number;
  discount?: number;
  payment_method?: string;
  is_refunded?: boolean;
  invoice_type?: string;
  lens_price?: number;
  frame_price?: number;
  coating_price?: number;
  contact_lens_items?: any;
  created_at?: string;
  payments?: InvoicePayment[] | string | null;
  patient_name?: string;
  [k: string]: any;
}

/** Normalise the payments field (it may come back as a JSON string). */
export function parsePayments(raw: any): InvoicePayment[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
}

/**
 * Day key "YYYY-MM-DD" in the user's local timezone. This matches how the
 * existing "today's payments" logic in DailySalesReport groups by day
 * (it compares Date objects against local start/end-of-day) and how the
 * store owner thinks about "the day" in Kuwait.
 *
 * TODO: If the store ever runs reporting from a non-Kuwait machine, switch
 * this to use `Intl.DateTimeFormat` with timeZone: "Asia/Kuwait".
 */
export function getPaymentDayKey(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Sum of payments for glasses-invoice categories. We scale the raw
 * (lens_price, frame_price, coating_price) so they sum to invoice.total,
 * absorbing any discount pro-rata. A payment is then split across categories
 * by the same ratio.
 */
function categoryWeights(invoice: InvoiceLike): {
  lens: number;
  frame: number;
  coating: number;
} {
  const lens = Number(invoice.lens_price) || 0;
  const frame = Number(invoice.frame_price) || 0;
  const coating = Number(invoice.coating_price) || 0;
  const sum = lens + frame + coating;
  if (sum <= 0) return { lens: 0, frame: 0, coating: 0 };
  return { lens: lens / sum, frame: frame / sum, coating: coating / sum };
}

/** Amount to attribute to lens/frame/coating for a given payment. */
export function proratePayment(
  invoice: InvoiceLike,
  payment: InvoicePayment
): { lens: number; frame: number; coating: number } {
  if (invoice.invoice_type !== "glasses") {
    return { lens: 0, frame: 0, coating: 0 };
  }
  const w = categoryWeights(invoice);
  const amt = Number(payment.amount) || 0;
  return {
    lens: amt * w.lens,
    frame: amt * w.frame,
    coating: amt * w.coating,
  };
}

export interface DailyAggregate {
  /** "YYYY-MM-DD" in local TZ */
  day: string;
  total: number;
  lens: number;
  frame: number;
  coating: number;
  paymentsByMethod: Record<string, { amount: number; count: number }>;
  /** Flat list of {invoice, payment} pairs recorded this day */
  entries: Array<{ invoice: InvoiceLike; payment: InvoicePayment }>;
}

/**
 * Flatten invoices[].payments[] across a date range (inclusive), grouped by
 * payment day. Refunded invoices are INCLUDED — their payments stay on their
 * original payment day so "Apr 15 revenue" does not silently change after a
 * refund is processed on Apr 20. Callers subtract the refund separately on
 * refund_date so the totals net out over the full range.
 *
 * @param invoices All invoices from Supabase (refunded and non-refunded mixed)
 * @param from    Start of range (inclusive). If omitted, no lower bound.
 * @param to      End of range (inclusive). If omitted, no upper bound.
 */
export function aggregatePaymentsByDay(
  invoices: InvoiceLike[],
  from?: Date,
  to?: Date
): Map<string, DailyAggregate> {
  const buckets = new Map<string, DailyAggregate>();
  const fromMs = from ? from.getTime() : -Infinity;
  // end-of-day on the "to" boundary
  const toMs = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime() : Infinity;
  // start-of-day on the "from" boundary
  const fromStartMs = from ? new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0).getTime() : -Infinity;

  for (const invoice of invoices) {
    // Include refunded invoices: the cash genuinely was received on the
    // payment date. The refund is a separate negative event keyed on
    // refund_date that the caller subtracts. See block comment above.
    const payments = parsePayments(invoice.payments);
    for (const payment of payments) {
      const t = new Date(payment.date).getTime();
      if (Number.isNaN(t) || t < fromStartMs || t > toMs) continue;
      const day = getPaymentDayKey(payment.date);
      if (!day) continue;

      let bucket = buckets.get(day);
      if (!bucket) {
        bucket = {
          day,
          total: 0,
          lens: 0,
          frame: 0,
          coating: 0,
          paymentsByMethod: {},
          entries: [],
        };
        buckets.set(day, bucket);
      }

      const amt = Number(payment.amount) || 0;
      bucket.total += amt;

      const split = proratePayment(invoice, payment);
      bucket.lens += split.lens;
      bucket.frame += split.frame;
      bucket.coating += split.coating;

      const method = payment.method || invoice.payment_method || "Unknown";
      const m = bucket.paymentsByMethod[method] || { amount: 0, count: 0 };
      m.amount += amt;
      m.count += 1;
      bucket.paymentsByMethod[method] = m;

      bucket.entries.push({ invoice, payment });
    }
  }

  return buckets;
}

/** Convenience: sum of a single day across all aggregate fields. */
export function aggregateSingleDay(
  invoices: InvoiceLike[],
  day: Date
): DailyAggregate {
  const map = aggregatePaymentsByDay(invoices, day, day);
  const key = getPaymentDayKey(day.toISOString());
  return (
    map.get(key) || {
      day: key,
      total: 0,
      lens: 0,
      frame: 0,
      coating: 0,
      paymentsByMethod: {},
      entries: [],
    }
  );
}
