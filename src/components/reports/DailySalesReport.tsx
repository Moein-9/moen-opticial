import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";
import { useLanguageStore } from "@/store/languageStore";
import {
  ChartLine,
  CreditCard,
  Wallet,
  Receipt,
  ChevronDown,
  ChevronUp,
  Tag,
  Store,
  RefreshCcw,
  Calendar as CalendarIcon,
} from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PrintService } from "@/utils/PrintService";
import { PrintReportButton } from "./PrintReportButton";
import { Button } from "@/components/ui/button";
import { storeInfo } from "@/assets/logo";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  aggregatePaymentsByDay,
  getPaymentDayKey,
  parsePayments,
  InvoiceLike,
} from "@/utils/paymentAggregation";

// Define interfaces based on Supabase schema
interface Invoice {
  id: string;
  invoice_id: string;
  work_order_id?: string;
  patient_id?: string;
  patient_name: string;
  patient_phone?: string;

  invoice_type: "glasses" | "contacts" | "exam" | "repair";

  lens_type?: string;
  lens_price?: number;
  coating?: string;
  coating_price?: number;
  coating_color?: string;
  thickness?: string;
  thickness_price?: number;

  frame_brand?: string;
  frame_model?: string;
  frame_color?: string;
  frame_size?: string;
  frame_price?: number;

  contact_lens_items?: any;
  contact_lens_rx?: any;

  service_name?: string;
  service_price?: number;

  discount: number;
  deposit: number;
  total: number;
  remaining: number;

  payment_method: string;
  auth_number?: string;
  is_paid: boolean;
  is_refunded?: boolean;
  refund_amount?: number;
  refund_date?: string;
  refund_method?: string;
  refund_reason?: string;
  refund_id?: string;
  staff_notes?: string;

  created_at: string;
  payments?: any;
}

export const DailySalesReport: React.FC = () => {
  const { language } = useLanguageStore();

  const [isLoading, setIsLoading] = useState(true);
  const [todaySales, setTodaySales] = useState<Invoice[]>([]);
  // Cash-basis list for the on-screen "Today's Invoice List" card:
  // every invoice that either (a) was created today OR (b) received at
  // least one payment today. Deduped by invoice_id, refunded invoices
  // filtered out. Populated in fetchTodayData alongside todaySales so
  // remaining-balance payments on older invoices are visible to staff.
  const [invoicesWithActivityToday, setInvoicesWithActivityToday] = useState<
    Invoice[]
  >([]);
  const [todayRefunds, setTodayRefunds] = useState<Invoice[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<
    {
      method: string;
      amount: number;
      count: number;
    }[]
  >([]);
  const [refundBreakdown, setRefundBreakdown] = useState<
    {
      method: string;
      amount: number;
      count: number;
    }[]
  >([]);

  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalLensRevenue, setTotalLensRevenue] = useState(0);
  const [totalFrameRevenue, setTotalFrameRevenue] = useState(0);
  const [totalCoatingRevenue, setTotalCoatingRevenue] = useState(0);
  const [totalDeposit, setTotalDeposit] = useState(0);
  const [totalRefunds, setTotalRefunds] = useState(0);
  const [netRevenue, setNetRevenue] = useState(0);
  // Cash-basis: list of individual payments received today (one row per
  // payment, not per invoice), for the print report invoice list.
  const [todaysPaymentEntries, setTodaysPaymentEntries] = useState<
    Array<{
      invoice: Invoice;
      amount: number;
      method: string;
      date: string;
    }>
  >([]);

  const [expandedInvoices, setExpandedInvoices] = useState<
    Record<string, boolean>
  >({});

  const t = {
    dailySalesReport:
      language === "ar" ? "تقرير المبيعات اليومي" : "Daily Sales Report",
    printReport: language === "ar" ? "طباعة التقرير" : "Print Report",
    totalSales: language === "ar" ? "إجمالي المبيعات" : "Total Sales",
    forDay: language === "ar" ? "لليوم" : "For day",
    invoiceCount: language === "ar" ? "عدد الفواتير" : "Invoice Count",
    inTodaysTransactions:
      language === "ar" ? "في معاملات اليوم" : "In today's transactions",
    totalPayments: language === "ar" ? "إجمالي المدفوعات" : "Total Payments",
    actuallyReceived:
      language === "ar" ? "المستلم فعلياً" : "Actually received",
    remainingAmounts:
      language === "ar" ? "المبالغ المتبقية" : "Remaining Amounts",
    deferredAmounts: language === "ar" ? "المبالغ المؤجلة" : "Deferred amounts",
    salesDistribution:
      language === "ar" ? "توزيع المبيعات" : "Sales Distribution",
    paymentMethods: language === "ar" ? "طرق الدفع" : "Payment Methods",
    transactions: language === "ar" ? "معاملات" : "transactions",
    todaysInvoiceList:
      language === "ar" ? "قائمة الفواتير اليوم" : "Today's Invoice List",
    noInvoices: language === "ar" ? "لا توجد فواتير" : "No Invoices",
    noInvoicesToday:
      language === "ar"
        ? "لم يتم إنشاء أي فواتير لليوم الحالي"
        : "No invoices have been created for today",
    lensRevenue: language === "ar" ? "مبيعات العدسات" : "Lens Revenue",
    frameRevenue: language === "ar" ? "مبيعات الإطارات" : "Frame Revenue",
    coatingRevenue: language === "ar" ? "مبيعات الطلاءات" : "Coating Revenue",
    customerInfo: language === "ar" ? "معلومات العميل" : "Customer Information",
    fileNumber: language === "ar" ? "رقم الملف" : "File Number",
    paymentInfo: language === "ar" ? "معلومات الدفع" : "Payment Information",
    total: language === "ar" ? "المجموع" : "Total",
    paid: language === "ar" ? "المدفوع" : "Paid",
    remaining: language === "ar" ? "المتبقي" : "Remaining",
    discount: language === "ar" ? "الخصم" : "Discount",
    paymentMethod: language === "ar" ? "طريقة الدفع" : "Payment Method",
    invoiceStatus: language === "ar" ? "حالة الفاتورة" : "Invoice Status",
    fullyPaid: language === "ar" ? "مدفوعة بالكامل" : "Fully Paid",
    partiallyPaid: language === "ar" ? "مدفوعة جزئياً" : "Partially Paid",
    creationDate: language === "ar" ? "تاريخ الإنشاء" : "Creation Date",
    lenses: language === "ar" ? "العدسات" : "Lenses",
    price: language === "ar" ? "السعر" : "Price",
    frame: language === "ar" ? "الإطار" : "Frame",
    color: language === "ar" ? "اللون" : "Color",
    coating: language === "ar" ? "الطلاء" : "Coating",
    currency: language === "ar" ? "د.ك" : "KWD",
    totalRefunds:
      language === "ar" ? "إجمالي المبالغ المستردة" : "Total Refunds",
    todaysRefunds:
      language === "ar" ? "المبالغ المستردة اليوم" : "Today's refunds",
    refundMethods: language === "ar" ? "طرق الاسترداد" : "Refund Methods",
    netRevenue: language === "ar" ? "صافي الإيرادات" : "Net Revenue",
    afterRefunds: language === "ar" ? "بعد الاستردادات" : "After refunds",
    refundedItems: language === "ar" ? "العناصر المستردة" : "Refunded Items",
    refundedInvoices:
      language === "ar" ? "الفواتير المستردة" : "Refunded Invoices",
    noRefunds: language === "ar" ? "لا توجد استردادات" : "No Refunds",
    noRefundsToday:
      language === "ar"
        ? "لم يتم إجراء أي استردادات لليوم الحالي"
        : "No refunds have been processed for today",
    reason: language === "ar" ? "السبب" : "Reason",
  };

  const toggleInvoiceExpansion = (invoiceId: string) => {
    setExpandedInvoices((prev) => ({
      ...prev,
      [invoiceId]: !prev[invoiceId],
    }));
  };

  useEffect(() => {
    const fetchTodayData = async () => {
      setIsLoading(true);

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startOfDay = new Date(today);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        // Format dates for Supabase query
        const startDateStr = startOfDay.toISOString();
        const endDateStr = endOfDay.toISOString();

        console.log("Fetching invoices from", startDateStr, "to", endDateStr);

        // Fetch today's sales from Supabase
        // @ts-ignore - Supabase type definitions may be incomplete for our schema
        const { data: salesData, error: salesError } = await supabase
          .from("invoices")
          .select("*")
          .gte("created_at", startDateStr)
          .lte("created_at", endDateStr)
          .order("created_at", { ascending: false });

        if (salesError) {
          console.error("Error fetching today's sales:", salesError);
          toast.error("Failed to fetch today's sales data");
          return;
        }

        // Fetch today's refunds from Supabase
        // @ts-ignore - Supabase type definitions may be incomplete for our schema
        const { data: refundsData, error: refundsError } = await supabase
          .from("invoices")
          .select("*")
          .eq("is_refunded", true)
          .gte("refund_date", startDateStr)
          .lte("refund_date", endDateStr)
          .order("refund_date", { ascending: false });

        if (refundsError) {
          console.error("Error fetching today's refunds:", refundsError);
          toast.error("Failed to fetch today's refund data");
          return;
        }

        // Fetch invoices touched today — covers today-created, today-paid
        // (remaining-balance payments bump updated_at), and today-refunded.
        // Server-side filter keeps us well under PostgREST's 1000-row cap
        // (the old ".neq('payments', null)" returned 1000 silently truncated
        //  rows, dropping older invoices paid today — e.g. شيماء).
        // @ts-ignore - Supabase type definitions may be incomplete for our schema
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("invoices")
          .select("*")
          .gte("updated_at", startDateStr)
          .lte("updated_at", endDateStr);

        if (paymentsError) {
          console.error("Error fetching invoices with payments:", paymentsError);
          toast.error("Failed to fetch payment data");
          return;
        }

        // Parse JSON fields
        const parsedSalesData = salesData.map((invoice: any) => ({
          ...invoice,
          contact_lens_items:
            typeof invoice.contact_lens_items === "string"
              ? JSON.parse(invoice.contact_lens_items)
              : invoice.contact_lens_items,
          payments:
            typeof invoice.payments === "string"
              ? JSON.parse(invoice.payments)
              : invoice.payments || [],
        }));

        const parsedRefundsData = refundsData.map((invoice: any) => ({
          ...invoice,
          contact_lens_items:
            typeof invoice.contact_lens_items === "string"
              ? JSON.parse(invoice.contact_lens_items)
              : invoice.contact_lens_items,
          payments:
            typeof invoice.payments === "string"
              ? JSON.parse(invoice.payments)
              : invoice.payments || [],
        }));

        const parsedPaymentsData = paymentsData.map((invoice: any) => ({
          ...invoice,
          contact_lens_items:
            typeof invoice.contact_lens_items === "string"
              ? JSON.parse(invoice.contact_lens_items)
              : invoice.contact_lens_items,
          payments:
            typeof invoice.payments === "string"
              ? JSON.parse(invoice.payments)
              : invoice.payments || [],
        }));

        setTodaySales(parsedSalesData);
        setTodayRefunds(parsedRefundsData);

        // Unified invoice list for the "Today's Invoice List" UI card:
        // invoices created today PLUS older invoices that received a
        // payment today (remaining-balance payments). Deduped by
        // invoice_id so an invoice created AND paid today appears once.
        // Non-refunded only — refunded invoices are surfaced elsewhere.
        const todayKeyForList = getPaymentDayKey(startOfDay.toISOString());
        const activityMap = new Map<string, Invoice>();
        for (const inv of parsedSalesData as Invoice[]) {
          if (!inv.is_refunded) activityMap.set(inv.invoice_id, inv);
        }
        for (const inv of parsedPaymentsData as Invoice[]) {
          if (inv.is_refunded) continue;
          if (activityMap.has(inv.invoice_id)) continue;
          const pays = parsePayments((inv as any).payments);
          const hasTodayPayment = pays.some(
            (p) => getPaymentDayKey(p.date) === todayKeyForList
          );
          if (hasTodayPayment) activityMap.set(inv.invoice_id, inv);
        }
        setInvoicesWithActivityToday(Array.from(activityMap.values()));

        // --- Cash-basis revenue (grouped by payment date, not invoice date) ---
        // Combine: invoices created today + other invoices with payments today.
        // Deduplicate by invoice_id so we don't double-count an invoice that
        // appears in both lists.
        const allInvoicesById = new Map<string, InvoiceLike>();
        for (const inv of parsedSalesData as InvoiceLike[]) {
          allInvoicesById.set(inv.invoice_id, inv);
        }
        for (const inv of parsedPaymentsData as InvoiceLike[]) {
          if (!allInvoicesById.has(inv.invoice_id)) {
            allInvoicesById.set(inv.invoice_id, inv);
          }
        }
        const allInvoices = Array.from(allInvoicesById.values());

        const todayAggregate = aggregatePaymentsByDay(
          allInvoices,
          startOfDay,
          endOfDay
        ).get(getPaymentDayKey(startOfDay.toISOString()));

        const revenue = todayAggregate?.total ?? 0;
        const lensRevenue = todayAggregate?.lens ?? 0;
        const frameRevenue = todayAggregate?.frame ?? 0;
        const coatingRevenue = todayAggregate?.coating ?? 0;
        const depositsTotal = revenue; // same thing under cash-basis

        // Flat list of today's payments, each with a reference back to its
        // invoice (used by the print report's "Invoice List" table).
        const paymentEntries: Array<{
          invoice: Invoice;
          amount: number;
          method: string;
          date: string;
        }> = (todayAggregate?.entries || []).map((e) => ({
          invoice: e.invoice as unknown as Invoice,
          amount: Number(e.payment.amount) || 0,
          method: e.payment.method || e.invoice.payment_method || "Unknown",
          date: e.payment.date,
        }));

        // Refund total (refunds are keyed by refund_date — unchanged).
        const refundsTotal = parsedRefundsData.reduce(
          (sum: number, invoice: Invoice) => sum + (invoice.refund_amount || 0),
          0
        );

        // Payment method breakdown for today.
        const paymentMethods = todayAggregate?.paymentsByMethod || {};

        // Refund method breakdown.
        const refundMethods: {
          [key: string]: { amount: number; count: number };
        } = {};

        parsedRefundsData.forEach((invoice: Invoice) => {
          const method = invoice.refund_method || "Unknown";
          if (!refundMethods[method]) {
            refundMethods[method] = { amount: 0, count: 0 };
          }

          refundMethods[method].amount += invoice.refund_amount || 0;
          refundMethods[method].count += 1;
        });

        setTotalRevenue(revenue);
        setTotalLensRevenue(lensRevenue);
        setTotalFrameRevenue(frameRevenue);
        setTotalCoatingRevenue(coatingRevenue);
        setTotalDeposit(depositsTotal);
        setTotalRefunds(refundsTotal);
        setNetRevenue(depositsTotal - refundsTotal);
        setTodaysPaymentEntries(paymentEntries);

        setPaymentBreakdown(
          Object.entries(paymentMethods).map(([method, data]) => ({
            method,
            amount: data.amount,
            count: data.count,
          }))
        );

        setRefundBreakdown(
          Object.entries(refundMethods).map(([method, data]) => ({
            method,
            amount: data.amount,
            count: data.count,
          }))
        );
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load report data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTodayData();
  }, []);

  // Inline edit of a payment method within an invoice's payments[] JSONB.
  // Safe because we refetch the full row, mutate only payments[index].method,
  // and write the whole array back. No amount/date is touched.
  const [savingPaymentEdit, setSavingPaymentEdit] = useState<string | null>(null);
  const handleUpdatePaymentMethod = async (
    invoiceId: string,
    paymentIndex: number,
    newMethod: string
  ) => {
    const editKey = `${invoiceId}:${paymentIndex}`;
    setSavingPaymentEdit(editKey);
    try {
      // @ts-ignore
      const { data: row, error: fetchErr } = await supabase
        .from("invoices")
        .select("*")
        .eq("invoice_id", invoiceId)
        .single();
      if (fetchErr) throw fetchErr;

      // Fallback: if the typed supabase-js client strips `payments` (happens
      // when the generated Database type is out of date vs. the actual DB
      // schema), fetch the JSONB column via raw REST to get the real data.
      let paymentsRaw: any = (row as any)?.payments;
      if (paymentsRaw === undefined || paymentsRaw === null) {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/invoices?invoice_id=eq.${encodeURIComponent(invoiceId)}&select=payments`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );
        const arr = await resp.json();
        paymentsRaw = arr?.[0]?.payments;
      }
      const pays = parsePayments(paymentsRaw);
      if (!pays[paymentIndex]) {
        toast.error(
          language === "ar"
            ? "لم يتم العثور على الدفعة"
            : "Payment row not found"
        );
        return;
      }
      const prevMethod = pays[paymentIndex].method;
      pays[paymentIndex] = { ...pays[paymentIndex], method: newMethod };

      // If the edited row is the first payment, also update the invoice's
      // top-level payment_method so legacy displays stay consistent.
      const updatePayload: any = { payments: pays };
      if (paymentIndex === 0) updatePayload.payment_method = newMethod;

      // @ts-ignore
      const { error: updErr } = await supabase
        .from("invoices")
        .update(updatePayload)
        .eq("invoice_id", invoiceId);
      if (updErr) throw updErr;

      // Mutate local state in place so UI updates without full refetch.
      const patch = (list: Invoice[]) =>
        list.map((inv) =>
          inv.invoice_id === invoiceId
            ? {
                ...inv,
                payments: pays,
                payment_method:
                  paymentIndex === 0 ? newMethod : inv.payment_method,
              }
            : inv
        );
      setTodaySales((prev) => patch(prev));
      setInvoicesWithActivityToday((prev) => patch(prev));

      // Recompute today's payment-method breakdown off the updated list.
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const updatedList = patch(invoicesWithActivityToday);
      const dayAggMap = aggregatePaymentsByDay(
        updatedList as unknown as InvoiceLike[],
        start
      );
      const todayBucket = dayAggMap.get(getPaymentDayKey(start.toISOString()));
      const methodMap = todayBucket?.paymentsByMethod || {};
      setPaymentBreakdown(
        Object.entries(methodMap).map(([method, data]) => ({
          method,
          amount: data.amount,
          count: data.count,
        }))
      );

      toast.success(
        language === "ar"
          ? `تم تعديل طريقة الدفع من ${prevMethod} إلى ${newMethod}`
          : `Payment method changed from ${prevMethod} to ${newMethod}`
      );
    } catch (e) {
      console.error("Failed to update payment method:", e);
      toast.error(
        language === "ar"
          ? "فشل تعديل طريقة الدفع"
          : "Failed to update payment method"
      );
    } finally {
      setSavingPaymentEdit(null);
    }
  };

  // Render the right icon for a payment method label (Arabic or English)
  const renderMethodIcon = (method: string, size: "sm" | "md" = "sm") => {
    const box = size === "md" ? "h-6 w-8" : "h-4 w-6";
    const walletSize = size === "md" ? 20 : 14;
    const normalized = (method || "").toLowerCase();
    if (
      method === "نقداً" ||
      method === "نقدا" ||
      normalized === "cash"
    ) {
      return (
        <Wallet
          size={walletSize}
          className="text-emerald-600 shrink-0"
        />
      );
    }
    if (
      method === "كي نت" ||
      normalized === "knet" ||
      normalized === "k-net"
    ) {
      return (
        <img
          src="https://kabkg.com/staticsite/images/knet.png"
          alt="KNET"
          className={`${box} object-contain bg-white rounded shrink-0`}
        />
      );
    }
    if (normalized === "visa") {
      return (
        <img
          src="https://cdn-icons-png.flaticon.com/512/196/196578.png"
          alt="Visa"
          className={`${box} object-contain bg-white rounded shrink-0`}
        />
      );
    }
    return (
      <CreditCard
        size={walletSize}
        className="text-slate-500 shrink-0"
      />
    );
  };

  const handlePrintReport = () => {
    const today = format(new Date(), "MM/dd/yyyy", { locale: enUS });
    const pageTitle =
      language === "ar"
        ? `تقرير المبيعات اليومي - ${today}`
        : `Daily Sales Report - ${today}`;

    let paymentBreakdownHTML = "";
    paymentBreakdown.forEach((payment) => {
      paymentBreakdownHTML += `
        <tr>
          <td class="payment-method">${payment.method}</td>
          <td class="payment-count">${payment.count}</td>
          <td class="payment-amount">${payment.amount.toFixed(2)} ${
        t.currency
      }</td>
        </tr>
      `;
    });

    let refundBreakdownHTML = "";
    refundBreakdown.forEach((refund) => {
      refundBreakdownHTML += `
        <tr>
          <td class="refund-method">${refund.method}</td>
          <td class="refund-count">${refund.count}</td>
          <td class="refund-amount">${refund.amount.toFixed(2)} ${
        t.currency
      }</td>
        </tr>
      `;
    });

    let refundsHTML = "";
    todayRefunds.forEach((refund) => {
      // Find the associated invoice
      const relatedInvoice = todaySales.find(
        (inv) => inv.invoice_id === refund.refund_id
      );

      refundsHTML += `
        <tr>
          <td class="refund-id" style="width: 20%; max-width: 20%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${
            refund.refund_id
          }</td>
          <td class="refund-customer" style="width: 30%; max-width: 30%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${
            relatedInvoice?.patient_name || "-"
          }</td>
          <td class="refund-amount" style="width: 25%; max-width: 25%;">${refund.refund_amount?.toFixed(
            2
          )} ${t.currency}</td>
          <td class="refund-method" style="width: 25%; max-width: 25%;">${
            refund.refund_method || "-"
          }</td>
        </tr>
      `;
    });

    // Cash-basis: one row per payment received today (an invoice paid in two
    // instalments on two different days will appear on each day's report for
    // the amount actually received that day).
    let invoicesHTML = "";
    todaysPaymentEntries.forEach((entry) => {
      invoicesHTML += `
        <tr>
          <td class="invoice-customer">${entry.invoice.patient_name}</td>
          <td class="invoice-total">${entry.invoice.total.toFixed(2)} ${
        t.currency
      }</td>
          <td class="invoice-paid">${entry.amount.toFixed(2)} ${
        t.currency
      }</td>
          <td class="invoice-method">${entry.method || "-"}</td>
        </tr>
      `;
    });

    const reportDate = format(new Date(), "dd/MM/yyyy", { locale: enUS });

    // Create the report content with improved styling for thermal printer and bilingual support with vertical stacking
    const reportContent = `
      <div class="report-container">
        <div class="report-header">
          <div class="store-logo">
            <img src="/lovable-uploads/d0902afc-d6a5-486b-9107-68104dfd2a68.png" alt="${
              storeInfo.name
            }" />
          </div>
          <div class="store-info">
            <h2 class="store-name">${storeInfo.name}</h2>
            <p class="store-address">${storeInfo.address}</p>
            <p class="store-phone">${language === "ar" ? "هاتف:" : "Phone:"} ${
      storeInfo.phone
    }</p>
          </div>
        </div>

        <div class="report-title-box">
          <div class="report-title">
            <div class="bilingual-text">
              <div class="ar-text">${t.dailySalesReport}</div>
              <div class="en-text">Daily Sales Report</div>
            </div>
          </div>
          <div class="report-date">
            <div class="bilingual-text">
              <div class="ar-text">التاريخ: ${reportDate}</div>
              <div class="en-text">Date: ${reportDate}</div>
            </div>
          </div>
        </div>

        <div class="summary-section">
          <div class="section-header">
            <div class="bilingual-text">
              <div class="ar-text">ملخص المبيعات</div>
              <div class="en-text">Sales Summary</div>
            </div>
          </div>
          <table class="summary-table">
            <tr>
              <td class="summary-label">
                <div class="bilingual-text">
                  <div class="ar-text">${t.totalSales}:</div>
                  <div class="en-text">Total Sales:</div>
                </div>
              </td>
              <td class="summary-value">${totalRevenue.toFixed(2)} ${
      t.currency
    }</td>
            </tr>
            <tr>
              <td class="summary-label">
                <div class="bilingual-text">
                  <div class="ar-text">${t.totalRefunds}:</div>
                  <div class="en-text">Total Refunds:</div>
                </div>
              </td>
              <td class="summary-value">${totalRefunds.toFixed(2)} ${
      t.currency
    }</td>
            </tr>
            <tr>
              <td class="summary-label">
                <div class="bilingual-text">
                  <div class="ar-text">${t.netRevenue}:</div>
                  <div class="en-text">Net Revenue:</div>
                </div>
              </td>
              <td class="summary-value">${netRevenue.toFixed(2)} ${
      t.currency
    }</td>
            </tr>
            <tr>
              <td class="summary-label">
                <div class="bilingual-text">
                  <div class="ar-text">${t.totalPayments}:</div>
                  <div class="en-text">Total Payments:</div>
                </div>
              </td>
              <td class="summary-value">${totalDeposit.toFixed(2)} ${
      t.currency
    }</td>
            </tr>
            <tr>
              <td class="summary-label">
                <div class="bilingual-text">
                  <div class="ar-text">عدد الفواتير:</div>
                  <div class="en-text">Invoice Count:</div>
                </div>
              </td>
              <td class="summary-value">${
                new Set(todaysPaymentEntries.map((e) => e.invoice.invoice_id))
                  .size
              }</td>
            </tr>
          </table>
        </div>

        <div class="summary-section">
          <div class="section-header">
            <div class="bilingual-text">
              <div class="ar-text">تفاصيل المبيعات</div>
              <div class="en-text">Sales Details</div>
            </div>
          </div>
          <table class="summary-table">
            <tr>
              <td class="summary-label">
                <div class="bilingual-text">
                  <div class="ar-text">${t.lensRevenue}:</div>
                  <div class="en-text">Lens Revenue:</div>
                </div>
              </td>
              <td class="summary-value">${totalLensRevenue.toFixed(2)} ${
      t.currency
    }</td>
            </tr>
            <tr>
              <td class="summary-label">
                <div class="bilingual-text">
                  <div class="ar-text">${t.frameRevenue}:</div>
                  <div class="en-text">Frame Revenue:</div>
                </div>
              </td>
              <td class="summary-value">${totalFrameRevenue.toFixed(2)} ${
      t.currency
    }</td>
            </tr>
            <tr>
              <td class="summary-label">
                <div class="bilingual-text">
                  <div class="ar-text">${t.coatingRevenue}:</div>
                  <div class="en-text">Coating Revenue:</div>
                </div>
              </td>
              <td class="summary-value">${totalCoatingRevenue.toFixed(2)} ${
      t.currency
    }</td>
            </tr>
          </table>
        </div>

        <div class="summary-section">
          <div class="section-header">
            <div class="bilingual-text">
              <div class="ar-text">طرق الدفع</div>
              <div class="en-text">Payment Methods</div>
            </div>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>
                  <div class="bilingual-text">
                    <div class="ar-text">الطريقة</div>
                    <div class="en-text">Method</div>
                  </div>
                </th>
                <th>
                  <div class="bilingual-text">
                    <div class="ar-text">العدد</div>
                    <div class="en-text">Count</div>
                  </div>
                </th>
                <th>
                  <div class="bilingual-text">
                    <div class="ar-text">المبلغ</div>
                    <div class="en-text">Amount</div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              ${
                paymentBreakdownHTML ||
                `
                <tr>
                  <td colspan="3" class="no-data">
                    <div class="bilingual-text">
                      <div class="ar-text">لا توجد بيانات</div>
                      <div class="en-text">No data</div>
                    </div>
                  </td>
                </tr>
              `
              }
            </tbody>
          </table>
        </div>

        ${
          todaysPaymentEntries.length > 0
            ? `
          <div class="summary-section">
            <div class="section-header">
              <div class="bilingual-text">
                <div class="ar-text">قائمة الفواتير</div>
                <div class="en-text">Invoice List</div>
              </div>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>
                    <div class="bilingual-text">
                      <div class="ar-text">العميل</div>
                      <div class="en-text">Customer</div>
                    </div>
                  </th>
                  <th>
                    <div class="bilingual-text">
                      <div class="ar-text">المجموع</div>
                      <div class="en-text">Total</div>
                    </div>
                  </th>
                  <th>
                    <div class="bilingual-text">
                      <div class="ar-text">المدفوع</div>
                      <div class="en-text">Paid</div>
                    </div>
                  </th>
                  <th>
                    <div class="bilingual-text">
                      <div class="ar-text">الطريقة</div>
                      <div class="en-text">Method</div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                ${invoicesHTML}
              </tbody>
            </table>
          </div>
        `
            : ""
        }

        ${
          todayRefunds.length > 0
            ? `
          <div class="summary-section">
            <div class="section-header">
              <div class="bilingual-text">
                <div class="ar-text">طرق الاسترداد</div>
                <div class="en-text">Refund Methods</div>
              </div>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>
                    <div class="bilingual-text">
                      <div class="ar-text">الطريقة</div>
                      <div class="en-text">Method</div>
                    </div>
                  </th>
                  <th>
                    <div class="bilingual-text">
                      <div class="ar-text">العدد</div>
                      <div class="en-text">Count</div>
                    </div>
                  </th>
                  <th>
                    <div class="bilingual-text">
                      <div class="ar-text">المبلغ</div>
                      <div class="en-text">Amount</div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                ${
                  refundBreakdownHTML ||
                  `
                  <tr>
                    <td colspan="3" class="no-data">
                      <div class="bilingual-text">
                        <div class="ar-text">لا توجد بيانات</div>
                        <div class="en-text">No data</div>
                      </div>
                    </td>
                  </tr>
                `
                }
              </tbody>
            </table>
          </div>

          <div class="summary-section">
            <div class="section-header">
              <div class="bilingual-text">
                <div class="ar-text">الفواتير المستردة</div>
                <div class="en-text">Refunded Invoices</div>
              </div>
            </div>
            <table class="data-table small-table">
              <thead>
                <tr>
                  <th style="width: 20%;">
                    <div class="bilingual-text">
                      <div class="ar-text">رقم</div>
                      <div class="en-text">ID</div>
                    </div>
                  </th>
                  <th style="width: 30%;">
                    <div class="bilingual-text">
                      <div class="ar-text">العميل</div>
                      <div class="en-text">Customer</div>
                    </div>
                  </th>
                  <th style="width: 25%;">
                    <div class="bilingual-text">
                      <div class="ar-text">المبلغ</div>
                      <div class="en-text">Amount</div>
                    </div>
                  </th>
                  <th style="width: 25%;">
                    <div class="bilingual-text">
                      <div class="ar-text">الطريقة</div>
                      <div class="en-text">Method</div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                ${
                  refundsHTML ||
                  `
                  <tr>
                    <td colspan="4" class="no-data">
                      <div class="bilingual-text">
                        <div class="ar-text">لا توجد استردادات</div>
                        <div class="en-text">No refunds</div>
                      </div>
                    </td>
                  </tr>
                `
                }
              </tbody>
            </table>
          </div>
        `
            : ""
        }

        <div class="report-footer">
          <p>${
            language === "ar"
              ? `© ${new Date().getFullYear()} ${
                  storeInfo.name
                } - جميع الحقوق محفوظة`
              : `© ${new Date().getFullYear()} ${
                  storeInfo.name
                } - All rights reserved`
          }</p>
        </div>
      </div>
      
      <style>
        @media print {
          @page {
            size: 80mm auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          body {
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            font-family: 'Arial', sans-serif !important;
          }
          
          .report-container {
            width: 72mm !important;
            margin: 4mm auto !important;
            padding: 0 !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            background: white !important;
            font-family: 'Arial', sans-serif !important;
          }
          
          /* Ensure all content is visible */
          * {
            visibility: visible !important;
            opacity: 1 !important;
          }
        }
        
        .report-container {
          text-align: center;
          font-family: 'Arial', sans-serif;
          width: 72mm;
          margin: 0 auto;
        }
        
        .report-header {
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid #000;
          text-align: center;
        }
        
        .store-logo {
          text-align: center;
          margin-bottom: 5px;
        }
        
        .store-logo img {
          max-height: 40px;
          max-width: 100%;
        }
        
        .store-info {
          text-align: center;
        }
        
        .store-name {
          font-size: 16px;
          font-weight: bold;
          margin: 0;
        }
        
        .store-address, .store-phone {
          font-size: 12px;
          margin: 2px 0;
        }
        
        .report-title-box {
          border: 2px solid #000;
          padding: 5px;
          margin-bottom: 10px;
        }
        
        .report-title {
          font-size: 14px;
          font-weight: bold;
        }
        
        .report-date {
          font-size: 12px;
        }
        
        /* Bilingual text styling for vertical stacking */
        .bilingual-text {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        
        .ar-text {
          font-weight: bold;
          margin-bottom: 1px;
          direction: rtl;
        }
        
        .en-text {
          font-size: 90%;
          direction: ltr;
        }
        
        .section-header {
          background-color: #000;
          color: #fff;
          padding: 5px;
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 5px;
          text-align: center;
        }
        
        .summary-section {
          margin-bottom: 10px;
          border: 1px solid #000;
        }
        
        .summary-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        
        .summary-table td {
          padding: 4px;
        }
        
        .summary-label {
          text-align: left;
          font-weight: bold;
        }
        
        .summary-value {
          text-align: right;
          font-weight: bold;
        }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          table-layout: fixed;
        }
        
        .data-table th, .data-table td {
          border: 1px solid #000;
          padding: 3px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: normal;
          max-width: 100%;
          word-break: break-word;
        }
        
        .data-table th {
          background-color: #f2f2f2;
          font-weight: bold;
          padding: 5px 2px;
        }
        
        .small-table {
          font-size: 10px;
        }
        
        .small-table th, .small-table td {
          padding: 2px;
        }
        
        .payment-method, .invoice-customer, .refund-method, .refund-id, .refund-customer {
          text-align: left;
        }
        
        .payment-count, .payment-amount, .invoice-total, .invoice-paid, .invoice-method, .refund-count, .refund-amount {
          text-align: right;
        }
        
        .no-data {
          text-align: center;
          padding: 10px;
        }
        
        .report-footer {
          margin-top: 10px;
          padding-top: 5px;
          border-top: 1px solid #000;
          font-size: 10px;
          text-align: center;
        }
      </style>
    `;

    PrintService.printReport(reportContent, pageTitle, () => {
      toast(
        language === "ar"
          ? "تم إرسال التقرير للطباعة"
          : "Report sent to printer"
      );
    });
  };

  const todayLabel =
    language === "ar"
      ? format(new Date(), "EEEE، d MMMM yyyy", { locale: ar })
      : format(new Date(), "EEEE, MMM d, yyyy", { locale: enUS });
  // Count of distinct invoices with activity today (created-today OR
  // received a remaining payment today). invoicesWithActivityToday is
  // already refunded-filtered and deduped.
  const nonRefundedCount = invoicesWithActivityToday.length;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-slate-900 tracking-tight">
            {t.dailySalesReport}
          </h2>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" />
            {todayLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center text-sm text-slate-500 gap-1.5">
            <Store className="h-4 w-4" />
            <span>{storeInfo.name}</span>
          </div>
          <PrintReportButton onPrint={handlePrintReport} />
        </div>
      </div>

      {/* KPI stat cards — clean, calm, consistent */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <Receipt className="h-4 w-4 text-sky-600" />
            <span className="text-sm font-medium">{t.totalSales}</span>
          </div>
          <div className="mt-3 text-2xl md:text-3xl font-semibold text-slate-900 tabular-nums">
            {totalRevenue.toFixed(2)}
            <span className="text-base font-medium text-slate-400 ms-1.5">
              {t.currency}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{t.actuallyReceived}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <ChartLine className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium">{t.netRevenue}</span>
          </div>
          <div className="mt-3 text-2xl md:text-3xl font-semibold text-emerald-700 tabular-nums">
            {netRevenue.toFixed(2)}
            <span className="text-base font-medium text-emerald-400 ms-1.5">
              {t.currency}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{t.afterRefunds}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <Tag className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium">{t.invoiceCount}</span>
          </div>
          <div className="mt-3 text-2xl md:text-3xl font-semibold text-slate-900 tabular-nums">
            {nonRefundedCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">{t.inTodaysTransactions}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <RefreshCcw className="h-4 w-4 text-rose-600" />
            <span className="text-sm font-medium">{t.totalRefunds}</span>
          </div>
          <div className="mt-3 text-2xl md:text-3xl font-semibold text-rose-700 tabular-nums">
            {totalRefunds.toFixed(2)}
            <span className="text-base font-medium text-rose-300 ms-1.5">
              {t.currency}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{t.todaysRefunds}</p>
        </div>
      </div>

      {/* Payment Methods — full width, calm list */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <CreditCard className="h-4 w-4 text-slate-500" />
          <h3 className="text-base font-semibold text-slate-900">
            {t.paymentMethods}
          </h3>
        </div>
        <div className="px-5 pb-5">
          {paymentBreakdown.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-6">
              {t.noInvoices}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {paymentBreakdown.map((payment, index) => {
                const isCash =
                  payment.method === "نقداً" || payment.method === "Cash";
                const isKnet =
                  payment.method === "كي نت" || payment.method === "KNET";
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                          isCash
                            ? "bg-emerald-50 text-emerald-600"
                            : isKnet
                            ? "bg-sky-50 text-sky-600"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isCash ? (
                          <Wallet className="h-4 w-4" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-base font-medium text-slate-900">
                          {payment.method}
                        </div>
                        <div className="text-xs text-slate-400">
                          {payment.count} {t.transactions}
                        </div>
                      </div>
                    </div>
                    <div className="text-base font-semibold text-slate-900 tabular-nums">
                      {payment.amount.toFixed(2)}
                      <span className="text-xs font-medium text-slate-400 ms-1">
                        {t.currency}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Receipt className="h-4 w-4 text-slate-500" />
          <h3 className="text-base font-semibold text-slate-900">
            {t.todaysInvoiceList}
          </h3>
          {nonRefundedCount > 0 && (
            <Badge
              variant="secondary"
              className="ms-1 bg-slate-100 text-slate-600 font-medium"
            >
              {nonRefundedCount}
            </Badge>
          )}
        </div>
        <div className="px-3 md:px-5 pb-5">
          {invoicesWithActivityToday.length > 0 ? (
            <div className="space-y-2.5">
              {invoicesWithActivityToday
                .map((invoice) => {
                  // Balance source of truth = DB flags (is_paid, remaining).
                  // payments[] is only used for the per-day highlight in the
                  // hover card. Legacy invoices may have empty payments[] but
                  // still be paid, so we trust is_paid/remaining for the row.
                  const allPayments = parsePayments((invoice as any).payments);
                  const todayKey = getPaymentDayKey(new Date().toISOString());
                  const rawPaidToday = allPayments
                    .filter((p) => getPaymentDayKey(p.date) === todayKey)
                    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
                  const balanceAfter = invoice.is_paid
                    ? 0
                    : Math.max(0, Number(invoice.remaining) || 0);
                  const totalPaid = Math.max(
                    0,
                    (invoice.total || 0) - balanceAfter
                  );
                  // If payments[] is empty but the invoice was created & paid
                  // today, attribute the paid amount to today's column so the
                  // row doesn't silently lie about deposits collected today.
                  const paidToday =
                    allPayments.length === 0 &&
                    invoice.created_at &&
                    getPaymentDayKey(invoice.created_at) === todayKey
                      ? totalPaid
                      : rawPaidToday;

                  // Build the hover-card payment list. If payments[] is empty
                  // (legacy invoices), synthesize one pseudo-entry per known
                  // top-level field (deposit, remaining-if-paid) so the tooltip
                  // shows something meaningful instead of "no payments".
                  type PaymentRow = {
                    date: string;
                    amount: number;
                    method: string;
                    synthetic?: boolean;
                  };
                  const displayPayments: PaymentRow[] =
                    allPayments.length > 0
                      ? (allPayments as PaymentRow[])
                      : [
                          ...((invoice.deposit || 0) > 0
                            ? [
                                {
                                  date: invoice.created_at || "",
                                  amount: Number(invoice.deposit) || 0,
                                  method: invoice.payment_method || "-",
                                  synthetic: true,
                                },
                              ]
                            : []),
                          // Any remaining-paid portion beyond the deposit that
                          // we can't attribute to a specific date — fold into
                          // a single "balance payment" on the creation day.
                          ...(totalPaid > (Number(invoice.deposit) || 0)
                            ? [
                                {
                                  date: invoice.created_at || "",
                                  amount:
                                    totalPaid - (Number(invoice.deposit) || 0),
                                  method: invoice.payment_method || "-",
                                  synthetic: true,
                                },
                              ]
                            : []),
                        ];

                  return (
                  <div
                    key={invoice.invoice_id}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:border-slate-300 hover:shadow-sm transition-all"
                  >
                    <HoverCard openDelay={150} closeDelay={50}>
                      <HoverCardTrigger asChild>
                    <div
                      className={`flex flex-wrap md:flex-nowrap justify-between items-start md:items-center p-3 md:p-4 cursor-pointer gap-3 ${
                        expandedInvoices[invoice.invoice_id]
                          ? "bg-slate-50 border-b border-slate-200"
                          : ""
                      }`}
                      onClick={() => toggleInvoiceExpansion(invoice.invoice_id)}
                    >
                      <div className="flex items-center gap-4 w-full md:w-auto min-w-0">
                        <div
                          className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                            invoice.is_paid
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          <Receipt size={22} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-slate-900 truncate">
                            {invoice.patient_name}
                          </h3>
                          <p className="text-sm text-slate-500 tabular-nums">
                            {invoice.invoice_id}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between w-full md:w-auto gap-4 md:gap-6">
                        <div className="text-end space-y-1">
                          <div className="flex items-baseline gap-2 justify-end">
                            <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                              {language === "ar" ? "الإجمالي" : "Total"}
                            </span>
                            <span className="text-xl font-bold text-slate-900 tabular-nums">
                              {invoice.total.toFixed(2)}{" "}
                              <span className="text-sm text-slate-400 font-medium">
                                {t.currency}
                              </span>
                            </span>
                          </div>
                          {paidToday > 0 && (
                            <div className="flex items-baseline gap-2 justify-end">
                              <span className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
                                {language === "ar" ? "اليوم" : "Today"}
                              </span>
                              <span className="text-lg font-bold text-emerald-700 tabular-nums">
                                +{paidToday.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {balanceAfter > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5 justify-end">
                              <span className="text-xs uppercase tracking-wide text-amber-700 font-semibold">
                                {language === "ar" ? "المتبقي" : "Balance"}
                              </span>
                              <span className="text-lg font-bold text-amber-700 tabular-nums">
                                {balanceAfter.toFixed(2)}
                              </span>
                              {paidToday > 0 &&
                                invoice.created_at &&
                                getPaymentDayKey(invoice.created_at) !== todayKey && (
                                  <Badge className="bg-amber-500 text-white hover:bg-amber-500 border-0 text-[10px] font-bold px-1.5 py-0.5">
                                    {language === "ar"
                                      ? "دفعة متبقي"
                                      : "Balance payment"}
                                  </Badge>
                                )}
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5 justify-end">
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0 text-xs font-semibold px-2 py-0.5">
                                {language === "ar" ? "مدفوعة بالكامل" : "Fully paid"}
                              </Badge>
                              {paidToday > 0 &&
                                invoice.created_at &&
                                getPaymentDayKey(invoice.created_at) !== todayKey && (
                                  <Badge className="bg-amber-500 text-white hover:bg-amber-500 border-0 text-[10px] font-bold px-1.5 py-0.5">
                                    {language === "ar"
                                      ? "دفعة متبقي"
                                      : "Balance payment"}
                                  </Badge>
                                )}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-700"
                        >
                          {expandedInvoices[invoice.invoice_id] ? (
                            <ChevronUp size={18} />
                          ) : (
                            <ChevronDown size={18} />
                          )}
                        </Button>
                      </div>
                    </div>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80" align="end">
                        <div className="space-y-3">
                          <div>
                            <div className="font-semibold text-sm">
                              {invoice.patient_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {invoice.invoice_id}
                            </div>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-md bg-slate-50 border">
                            <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                              {language === "ar" ? "إجمالي الفاتورة" : "Invoice total"}
                            </span>
                            <span className="text-lg font-bold tabular-nums">
                              {invoice.total.toFixed(2)} {t.currency}
                            </span>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1.5">
                              {language === "ar" ? "سجل الدفعات" : "Payment history"}
                            </div>
                            {displayPayments.length === 0 ? (
                              <div className="text-sm text-muted-foreground italic">
                                {language === "ar" ? "لا توجد دفعات" : "No payments recorded"}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {displayPayments
                                  .slice()
                                  .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
                                  .map((p, idx) => {
                                    const isToday = getPaymentDayKey(p.date) === todayKey;
                                    const isDeposit = idx === 0;
                                    const label = isDeposit
                                      ? (language === "ar" ? "دفعة أولى" : "Deposit")
                                      : (language === "ar" ? "دفعة متبقي" : "Balance payment");
                                    return (
                                      <div
                                        key={idx}
                                        className={`flex items-center justify-between text-sm gap-2 px-2 py-1.5 rounded ${
                                          isToday
                                            ? "bg-emerald-50 border border-emerald-200"
                                            : "bg-white border border-slate-100"
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <Badge
                                            variant="secondary"
                                            className={`text-[10px] font-semibold px-1.5 py-0 ${
                                              isDeposit
                                                ? "bg-sky-100 text-sky-800"
                                                : "bg-amber-100 text-amber-800"
                                            }`}
                                          >
                                            {label}
                                          </Badge>
                                          <span className="text-xs text-muted-foreground truncate">
                                            {p.date ? format(new Date(p.date), "dd/MM/yy") : "-"}
                                          </span>
                                          <span className="text-[10px] text-muted-foreground">
                                            · {p.method || "-"}
                                          </span>
                                        </div>
                                        <span className="font-semibold tabular-nums text-sm">
                                          {Number(p.amount).toFixed(2)}
                                        </span>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-md border-t border-dashed pt-2">
                            <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                              {balanceAfter > 0
                                ? (language === "ar" ? "المتبقي" : "Remaining balance")
                                : (language === "ar" ? "الحالة" : "Status")}
                            </span>
                            <span
                              className={`text-base font-bold tabular-nums ${
                                balanceAfter > 0 ? "text-amber-700" : "text-emerald-700"
                              }`}
                            >
                              {balanceAfter > 0
                                ? `${balanceAfter.toFixed(2)} ${t.currency}`
                                : (language === "ar" ? "مدفوع بالكامل" : "Fully paid")}
                            </span>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>

                    {expandedInvoices[invoice.invoice_id] && (
                      <div className="p-4 bg-slate-50/60 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                              {t.customerInfo}
                            </h4>
                            <p className="text-base font-semibold text-slate-900">
                              {invoice.patient_name}
                            </p>
                            <p className="text-sm text-slate-600 mt-0.5">
                              {invoice.patient_phone}
                            </p>
                            {invoice.patient_id && (
                              <p className="text-xs text-slate-400 mt-1">
                                {t.fileNumber}: {invoice.patient_id}
                              </p>
                            )}
                          </div>

                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                              {t.paymentInfo}
                            </h4>
                            <div className="flex justify-between items-baseline">
                              <span className="text-sm text-slate-600">
                                {t.total}
                              </span>
                              <span className="text-base font-semibold text-slate-900 tabular-nums">
                                {invoice.total.toFixed(2)} {t.currency}
                              </span>
                            </div>
                            <div className="flex justify-between items-baseline mt-1.5">
                              <span className="text-sm text-sky-700">
                                {t.paid}
                              </span>
                              <span className="text-sm font-semibold text-sky-700 tabular-nums">
                                {invoice.deposit.toFixed(2)} {t.currency}
                              </span>
                            </div>
                            {invoice.remaining > 0 && (
                              <div className="flex justify-between items-baseline mt-1.5 bg-amber-50 px-2 py-1 rounded-md">
                                <span className="text-sm font-medium text-amber-700">
                                  {t.remaining}
                                </span>
                                <span className="text-sm font-semibold text-amber-700 tabular-nums">
                                  {invoice.remaining.toFixed(2)} {t.currency}
                                </span>
                              </div>
                            )}
                            {invoice.discount > 0 && (
                              <div className="flex justify-between items-baseline mt-1.5 bg-emerald-50 px-2 py-1 rounded-md">
                                <span className="flex items-center gap-1 text-sm font-medium text-emerald-700">
                                  <Tag size={12} />
                                  {t.discount}
                                </span>
                                <span className="text-sm font-semibold text-emerald-700 tabular-nums">
                                  {invoice.discount.toFixed(2)} {t.currency}
                                </span>
                              </div>
                            )}
                            <div className="mt-3 pt-2 border-t border-slate-100">
                              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                {t.paymentMethod}
                              </span>
                              <div className="flex items-center gap-1.5 mt-1">
                                {invoice.payment_method === "نقداً" ||
                                invoice.payment_method === "Cash" ? (
                                  <Wallet className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <CreditCard className="h-4 w-4 text-sky-600" />
                                )}
                                <span className="text-sm text-slate-700">
                                  {invoice.payment_method}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                              {t.invoiceStatus}
                            </h4>
                            <div
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                invoice.is_paid
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {invoice.is_paid ? t.fullyPaid : t.partiallyPaid}
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                              {t.creationDate}:{" "}
                              {new Date(
                                invoice.created_at
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {language === "ar" ? "سجل الدفعات" : "Payment timeline"}
                            </h4>
                            <span className="text-[10px] text-slate-400">
                              {displayPayments.length}{" "}
                              {language === "ar"
                                ? displayPayments.length === 1
                                  ? "دفعة"
                                  : "دفعات"
                                : displayPayments.length === 1
                                  ? "payment"
                                  : "payments"}
                            </span>
                          </div>
                          {displayPayments.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">
                              {language === "ar"
                                ? "لا توجد دفعات مسجلة"
                                : "No payments recorded"}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {displayPayments
                                .map((p, origIdx) => ({ p, origIdx }))
                                .sort((a, b) =>
                                  (a.p.date || "").localeCompare(b.p.date || "")
                                )
                                .map(({ p, origIdx }, idx) => {
                                  const isPayToday =
                                    getPaymentDayKey(p.date) === todayKey;
                                  const isDeposit = idx === 0;
                                  const isSynthetic = (p as any).synthetic;
                                  const editKey = `${invoice.invoice_id}:${origIdx}`;
                                  const isSaving =
                                    savingPaymentEdit === editKey;
                                  const label = isDeposit
                                    ? language === "ar"
                                      ? "دفعة أولى"
                                      : "Deposit"
                                    : language === "ar"
                                      ? "دفعة متبقي"
                                      : "Balance payment";
                                  const methodOptions =
                                    language === "ar"
                                      ? ["نقداً", "كي نت", "Visa"]
                                      : ["Cash", "KNET", "Visa"];
                                  // Unify Arabic/English labels so edits to
                                  // "Cash" overwrite rows saved as "نقداً"
                                  // with the user's picked label verbatim.
                                  const dateStr = p.date
                                    ? new Date(p.date).toLocaleDateString(
                                        language === "ar" ? "ar-KW" : "en-GB",
                                        {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                        }
                                      )
                                    : "-";
                                  return (
                                    <div
                                      key={idx}
                                      className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                                        isPayToday
                                          ? "bg-emerald-50 border-emerald-200"
                                          : isDeposit
                                            ? "bg-sky-50/60 border-sky-100"
                                            : "bg-amber-50/40 border-amber-100"
                                      }`}
                                    >
                                      <Badge
                                        className={`text-[10px] font-bold shrink-0 border-0 px-2 py-0.5 ${
                                          isDeposit
                                            ? "bg-sky-600 text-white"
                                            : "bg-amber-500 text-white"
                                        }`}
                                      >
                                        {label}
                                      </Badge>
                                      {isPayToday && (
                                        <Badge className="text-[9px] font-bold shrink-0 border-0 px-1.5 py-0 bg-emerald-600 text-white uppercase">
                                          {language === "ar" ? "اليوم" : "Today"}
                                        </Badge>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-700">
                                          {dateStr}
                                        </div>
                                        <div className="mt-0.5">
                                          {isSynthetic ? (
                                            <span className="text-xs text-slate-500">
                                              {p.method || "-"}
                                            </span>
                                          ) : (
                                            <Popover>
                                              <PopoverTrigger asChild>
                                                <button
                                                  type="button"
                                                  disabled={isSaving}
                                                  className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800 bg-sky-100 hover:bg-sky-200 active:bg-sky-300 border border-sky-300 hover:border-sky-500 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-60 shadow-sm"
                                                  onClick={(e) => e.stopPropagation()}
                                                  title={
                                                    language === "ar"
                                                      ? "انقر لتغيير طريقة الدفع"
                                                      : "Click to change payment method"
                                                  }
                                                >
                                                  <Pencil size={14} className="text-sky-700" />
                                                  <span className="font-bold">
                                                    {language === "ar" ? "تعديل" : "Edit"}
                                                  </span>
                                                  <span className="text-sky-400">·</span>
                                                  <span className="bg-white text-sky-800 px-2 py-0.5 rounded-md font-bold border border-sky-200 inline-flex items-center gap-1.5">
                                                    {renderMethodIcon(p.method || "", "sm")}
                                                    {p.method || "-"}
                                                  </span>
                                                </button>
                                              </PopoverTrigger>
                                              <PopoverContent
                                                className="w-48 p-2"
                                                align="start"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold px-1 pb-1.5">
                                                  {language === "ar"
                                                    ? "تغيير طريقة الدفع"
                                                    : "Change payment method"}
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                  {methodOptions.map((m) => (
                                                    <button
                                                      key={m}
                                                      type="button"
                                                      disabled={
                                                        isSaving || m === p.method
                                                      }
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUpdatePaymentMethod(
                                                          invoice.invoice_id,
                                                          origIdx,
                                                          m
                                                        );
                                                      }}
                                                      className={`flex items-center gap-2.5 text-sm text-start px-2.5 py-2 rounded hover:bg-slate-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                                                        m === p.method
                                                          ? "bg-slate-100 font-semibold"
                                                          : ""
                                                      }`}
                                                    >
                                                      {renderMethodIcon(m, "md")}
                                                      <span className="flex-1">
                                                        {m}
                                                      </span>
                                                      {m === p.method && (
                                                        <span className="text-[10px] text-slate-400">
                                                          {language === "ar"
                                                            ? "(الحالي)"
                                                            : "(current)"}
                                                        </span>
                                                      )}
                                                    </button>
                                                  ))}
                                                </div>
                                              </PopoverContent>
                                            </Popover>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-base font-bold tabular-nums text-slate-900 shrink-0">
                                        {Number(p.amount).toFixed(2)}{" "}
                                        <span className="text-xs text-slate-400 font-medium">
                                          {t.currency}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              <div className="flex items-center justify-between pt-2 mt-2 border-t border-dashed border-slate-200">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                  {language === "ar"
                                    ? "إجمالي المدفوع"
                                    : "Total paid"}
                                </span>
                                <span className="text-base font-bold text-slate-900 tabular-nums">
                                  {displayPayments
                                    .reduce(
                                      (s, p) => s + (Number(p.amount) || 0),
                                      0
                                    )
                                    .toFixed(2)}{" "}
                                  <span className="text-xs text-slate-400 font-medium">
                                    {t.currency}
                                  </span>
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-600 mb-1.5">
                              {t.lenses}
                            </h4>
                            <p className="text-base font-medium text-slate-900">
                              {invoice.lens_type || "—"}
                            </p>
                            <div className="flex justify-between mt-2 text-sm">
                              <span className="text-slate-500">{t.price}</span>
                              <span className="font-semibold text-slate-900 tabular-nums">
                                {invoice.lens_price?.toFixed(2) || "0.00"}{" "}
                                {t.currency}
                              </span>
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-1.5">
                              {t.frame}
                            </h4>
                            <p className="text-base font-medium text-slate-900">
                              {invoice.frame_brand} {invoice.frame_model}
                            </p>
                            {invoice.frame_color && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                {t.color}: {invoice.frame_color}
                              </p>
                            )}
                            <div className="flex justify-between mt-2 text-sm">
                              <span className="text-slate-500">{t.price}</span>
                              <span className="font-semibold text-slate-900 tabular-nums">
                                {invoice.frame_price?.toFixed(2) || "0.00"}{" "}
                                {t.currency}
                              </span>
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-1.5">
                              {t.coating}
                            </h4>
                            <p className="text-base font-medium text-slate-900">
                              {invoice.coating || "—"}
                            </p>
                            <div className="flex justify-between mt-2 text-sm">
                              <span className="text-slate-500">{t.price}</span>
                              <span className="font-semibold text-slate-900 tabular-nums">
                                {invoice.coating_price?.toFixed(2) || "0.00"}{" "}
                                {t.currency}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50/60 rounded-xl">
              <Receipt className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-semibold text-slate-700 mb-1">
                {t.noInvoices}
              </h3>
              <p className="text-sm text-slate-400">{t.noInvoicesToday}</p>
            </div>
          )}
        </div>
      </div>

      {/* Refund sections - calm rose palette, collapsed by default */}
      {todayRefunds.length > 0 && (
        <CollapsibleCard
          title={`${t.refundedItems} (${todayRefunds.length})`}
          className="border-slate-200 rounded-2xl shadow-sm bg-white"
          headerClassName="bg-white rounded-t-2xl border-b border-slate-100"
          titleClassName="text-slate-900 font-semibold text-base"
          defaultOpen={false}
        >
          <div className="p-4 md:p-5 space-y-4">
            {/* Refund methods summary */}
            {refundBreakdown.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  {t.refundMethods}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {refundBreakdown.map((refund, index) => (
                    <div
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-full"
                    >
                      {refund.method === "نقداً" ||
                      refund.method === "Cash" ? (
                        <Wallet className="h-3.5 w-3.5 text-rose-600" />
                      ) : (
                        <CreditCard className="h-3.5 w-3.5 text-rose-600" />
                      )}
                      <span className="text-sm font-medium text-rose-800">
                        {refund.method}
                      </span>
                      <span className="text-xs text-rose-500">
                        ({refund.count})
                      </span>
                      <span className="text-sm font-semibold text-rose-700 tabular-nums">
                        {refund.amount?.toFixed(2)} {t.currency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Refund list */}
            <div className="space-y-2.5">
              {todayRefunds.map((refund) => {
                const relatedInvoice = todaySales.find(
                  (inv) => inv.invoice_id === refund.refund_id
                );
                return (
                  <div
                    key={refund.refund_id}
                    className="border border-slate-200 rounded-xl p-4 bg-white hover:border-rose-200 transition-colors"
                  >
                    <div className="flex flex-wrap md:flex-nowrap justify-between items-start gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <RefreshCcw className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-base font-semibold text-slate-900">
                              {relatedInvoice?.patient_name ||
                                (language === "ar" ? "عميل" : "Customer")}
                            </span>
                            <span className="text-xs text-slate-400 tabular-nums">
                              {refund.refund_id}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                            <CalendarIcon className="h-3 w-3" />
                            {formatDate(refund.refund_date)}
                          </div>
                          {refund.refund_reason && (
                            <div className="text-sm text-slate-600 mt-1.5">
                              <span className="font-medium">{t.reason}:</span>{" "}
                              {refund.refund_reason}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <div className="text-xl font-semibold text-rose-700 tabular-nums">
                          −{refund.refund_amount?.toFixed(2)}
                          <span className="text-sm font-medium text-rose-400 ms-1">
                            {t.currency}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {refund.refund_method}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleCard>
      )}

      {/* Refunded invoices - original invoice still shown if it was refunded */}
      {todaySales.filter((invoice) => invoice.is_refunded).length > 0 && (
        <CollapsibleCard
          title={`${t.refundedInvoices} (${
            todaySales.filter((i) => i.is_refunded).length
          })`}
          className="border-slate-200 rounded-2xl shadow-sm bg-white"
          headerClassName="bg-white rounded-t-2xl border-b border-slate-100"
          titleClassName="text-slate-900 font-semibold text-base"
          defaultOpen={false}
        >
          <div className="space-y-2.5 p-4 md:p-5">
            {todaySales
              .filter((invoice) => invoice.is_refunded)
              .map((invoice) => (
                <div
                  key={invoice.invoice_id}
                  className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:border-rose-200 transition-colors"
                >
                  <div
                    className={`flex flex-wrap md:flex-nowrap justify-between items-start md:items-center p-3 md:p-4 cursor-pointer gap-3 ${
                      expandedInvoices[invoice.invoice_id]
                        ? "bg-rose-50/40 border-b border-slate-200"
                        : ""
                    }`}
                    onClick={() => toggleInvoiceExpansion(invoice.invoice_id)}
                  >
                    <div className="flex items-center gap-3 w-full md:w-auto min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                        <RefreshCcw size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-900 truncate">
                          {invoice.patient_name}
                        </h3>
                        <p className="text-xs text-slate-400 tabular-nums">
                          {invoice.invoice_id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full md:w-auto gap-3">
                      <div className="text-end">
                        <p className="text-base font-semibold text-slate-900 tabular-nums">
                          {invoice.total.toFixed(2)}{" "}
                          <span className="text-xs text-slate-400">
                            {t.currency}
                          </span>
                        </p>
                        {invoice.refund_amount ? (
                          <p className="text-sm font-semibold text-rose-700 tabular-nums">
                            −{invoice.refund_amount.toFixed(2)} {t.currency}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400">
                            {invoice.payment_method}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-700"
                      >
                        {expandedInvoices[invoice.invoice_id] ? (
                          <ChevronUp size={18} />
                        ) : (
                          <ChevronDown size={18} />
                        )}
                      </Button>
                    </div>
                  </div>

                  {expandedInvoices[invoice.invoice_id] && (
                    <div className="p-4 bg-slate-50/60 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                            {t.customerInfo}
                          </h4>
                          <p className="text-base font-semibold text-slate-900">
                            {invoice.patient_name}
                          </p>
                          <p className="text-sm text-slate-600 mt-0.5">
                            {invoice.patient_phone}
                          </p>
                          {invoice.patient_id && (
                            <p className="text-xs text-slate-400 mt-1">
                              {t.fileNumber}: {invoice.patient_id}
                            </p>
                          )}
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                            {t.paymentInfo}
                          </h4>
                          <div className="flex justify-between items-baseline">
                            <span className="text-sm text-slate-600">
                              {t.total}
                            </span>
                            <span className="text-base font-semibold text-slate-900 tabular-nums">
                              {invoice.total.toFixed(2)} {t.currency}
                            </span>
                          </div>
                          <div className="flex justify-between items-baseline mt-1.5">
                            <span className="text-sm text-sky-700">
                              {t.paid}
                            </span>
                            <span className="text-sm font-semibold text-sky-700 tabular-nums">
                              {invoice.deposit.toFixed(2)} {t.currency}
                            </span>
                          </div>
                          {invoice.refund_amount ? (
                            <div className="flex justify-between items-baseline mt-1.5 bg-rose-50 px-2 py-1 rounded-md">
                              <span className="text-sm font-medium text-rose-700">
                                {language === "ar" ? "مسترد" : "Refunded"}
                              </span>
                              <span className="text-sm font-semibold text-rose-700 tabular-nums">
                                −{invoice.refund_amount.toFixed(2)} {t.currency}
                              </span>
                            </div>
                          ) : null}
                          <div className="mt-3 pt-2 border-t border-slate-100">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              {t.paymentMethod}
                            </span>
                            <div className="flex items-center gap-1.5 mt-1">
                              {invoice.payment_method === "نقداً" ||
                              invoice.payment_method === "Cash" ? (
                                <Wallet className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <CreditCard className="h-4 w-4 text-sky-600" />
                              )}
                              <span className="text-sm text-slate-700">
                                {invoice.payment_method}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                            {t.invoiceStatus}
                          </h4>
                          <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700">
                            {language === "ar" ? "مسترد" : "Refunded"}
                          </div>
                          <p className="text-xs text-slate-400 mt-2">
                            {t.creationDate}:{" "}
                            {new Date(invoice.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-600 mb-1.5">
                            {t.lenses}
                          </h4>
                          <p className="text-base font-medium text-slate-900">
                            {invoice.lens_type || "—"}
                          </p>
                          <div className="flex justify-between mt-2 text-sm">
                            <span className="text-slate-500">{t.price}</span>
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {invoice.lens_price?.toFixed(2) || "0.00"}{" "}
                              {t.currency}
                            </span>
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-1.5">
                            {t.frame}
                          </h4>
                          <p className="text-base font-medium text-slate-900">
                            {invoice.frame_brand} {invoice.frame_model}
                          </p>
                          {invoice.frame_color && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {t.color}: {invoice.frame_color}
                            </p>
                          )}
                          <div className="flex justify-between mt-2 text-sm">
                            <span className="text-slate-500">{t.price}</span>
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {invoice.frame_price?.toFixed(2) || "0.00"}{" "}
                              {t.currency}
                            </span>
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-1.5">
                            {t.coating}
                          </h4>
                          <p className="text-base font-medium text-slate-900">
                            {invoice.coating || "—"}
                          </p>
                          <div className="flex justify-between mt-2 text-sm">
                            <span className="text-slate-500">{t.price}</span>
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {invoice.coating_price?.toFixed(2) || "0.00"}{" "}
                              {t.currency}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </CollapsibleCard>
      )}
    </div>
  );
};
