import React, { useState, useEffect, useMemo } from "react";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  parseISO,
  isWithinInterval,
  differenceInDays,
} from "date-fns";
import { ar as arLocale, enUS as enLocale } from "date-fns/locale";
import { useLanguageStore } from "@/store/languageStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { DateRange } from "react-day-picker";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Area,
  ComposedChart,
  Cell,
} from "recharts";
import { toast } from "sonner";
import {
  BarChart3,
  LineChart as LineChartIcon,
  Store,
  RefreshCcw,
  Receipt,
  Calendar,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { PrintService } from "@/utils/PrintService";
import { PrintReportButton } from "./PrintReportButton";
import { supabase } from "@/integrations/supabase/client";
import { storeInfo } from "@/assets/logo";
import { useNavigate } from "react-router-dom";
import { CustomPrintService } from "@/utils/CustomPrintService";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  UserRound,
  Search as SearchIcon,
  FileText,
  Eye as EyeIcon,
  ClipboardList,
  X as XIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getPatientById } from "@/services/patientService";
import { printRxReceipt } from "@/components/RxReceiptPrint";
import { PatientProfileInfo } from "@/components/PatientProfileInfo";
import { PatientTransactions } from "@/components/PatientTransactions";
import { PatientPrescriptionDisplay } from "@/components/PatientPrescriptionDisplay";
import {
  aggregatePaymentsByDay,
  InvoiceLike,
} from "@/utils/paymentAggregation";

// Local error boundary used around the customer-profile dialog body so a
// render-time throw inside <PatientProfileInfo>/<PatientTransactions>
// (the symptom the user saw as "white screen of death when clicking
// Profile") cannot bubble up and kill the whole app. The app has no
// top-level ErrorBoundary, so without this any TypeError in the profile
// subtree nukes the page.
class ProfileErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    fallback: React.ReactNode;
    onError?: (error: unknown) => void;
  },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

interface Invoice {
  id: string;
  invoice_id: string;
  patient_name: string;
  invoice_type: "glasses" | "contacts" | "exam" | "repair";
  total: number;
  discount: number;
  deposit: number;
  remaining: number;
  payment_method: string;
  is_paid: boolean;
  is_refunded?: boolean;
  refund_amount?: number;
  refund_date?: string;
  created_at: string;
  payments?: any;
  contact_lens_items?: any;
}

// Real store info — imported from the shared storeInfo in @/assets/logo
// so the printed Comparative Analysis report matches every other
// printable template in the app (invoice, work order, RX receipt, etc.)
// rather than using the old "123 Vision Street" placeholders.
const STORE_LOGO = "/lovable-uploads/d0902afc-d6a5-486b-9107-68104dfd2a68.png";

// Single-source palette aligned with DailySalesReport
const PALETTE = {
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate200: "#e2e8f0",
  emerald: "#10b981",
  emeraldSoft: "#d1fae5",
  rose: "#f43f5e",
  amber: "#f59e0b",
  sky: "#0ea5e9",
};

// Force Latin (English) digits everywhere in this page, regardless of UI language.
const nfKWD = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nfInt = new Intl.NumberFormat("en-US");

const formatKWD = (value: number, lang: "ar" | "en") => {
  const num = nfKWD.format(value || 0);
  // KWD suffix; numbers stay Latin even in Arabic layout.
  return lang === "ar" ? `${num} د.ك` : `${num} KWD`;
};

interface ComparativeAnalysisProps {
  className?: string;
}

type PresetKey = "today" | "last7" | "last30" | "thisMonth" | "lastMonth";

const ComparativeAnalysis: React.FC<ComparativeAnalysisProps> = ({
  className,
}) => {
  const { language, t: tr } = useLanguageStore();
  const navigate = useNavigate();
  const [txFilter, setTxFilter] = useState("");
  const isRtl = language === "ar";

  // Print choice dialog — which invoice the user clicked "Print" on
  const [printTarget, setPrintTarget] = useState<Invoice | null>(null);
  // Profile dialog — which customer to show when "Profile" is clicked.
  // We fetch the data right here inside this component so there's no
  // complex shared state with PatientSearch.
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profilePatient, setProfilePatient] = useState<any | null>(null);
  const [profileDetails, setProfileDetails] = useState<any | null>(null);
  const [profileInvoices, setProfileInvoices] = useState<any[]>([]);

  const openProfile = async (patientId: string) => {
    setProfileOpen(true);
    setProfileLoading(true);
    setProfilePatient(null);
    setProfileDetails(null);
    setProfileInvoices([]);
    try {
      const result = await getPatientById(patientId);
      // Defensively unwrap: `.single()` normally returns a single object,
      // but in this codebase/supabase-js version the `patient` field on
      // the result comes back as a 1-element array. If left as an array,
      // `profilePatient.id` is undefined and the dialog's loading gate
      // stays true forever.
      let patient = (result as any)?.patient;
      if (Array.isArray(patient)) patient = patient[0];
      if (!patient || typeof patient !== "object" || !patient.id) {
        toast.error(
          language === "ar"
            ? "لم يتم العثور على العميل"
            : "Customer not found"
        );
        setProfileOpen(false);
        return;
      }
      setProfilePatient(patient);
      setProfileDetails({
        notes: (result as any).notes || [],
        glassesPrescriptions: (result as any).glassesPrescriptions || [],
        contactLensPrescriptions:
          (result as any).contactLensPrescriptions || [],
      });
      // Invoices for the transactions section below the profile.
      // @ts-ignore
      const { data: invRows } = await supabase
        .from("invoices")
        .select("*")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false });
      const mapped = ((invRows as any[]) || []).map((r) => ({
        invoiceId: r.invoice_id,
        workOrderId: r.work_order_id,
        patientId: r.patient_id,
        patientName: r.patient_name,
        patientPhone: r.patient_phone,
        invoiceType: r.invoice_type,
        total: Number(r.total) || 0,
        deposit: Number(r.deposit) || 0,
        remaining: Number(r.remaining) || 0,
        discount: Number(r.discount) || 0,
        isPaid: !!r.is_paid,
        isPickedUp: !!r.is_picked_up,
        pickedUpAt: r.picked_up_at,
        isRefunded: !!r.is_refunded,
        isArchived: !!r.is_archived,
        archivedAt: r.archived_at,
        paymentMethod: r.payment_method,
        authNumber: r.auth_number,
        payments: r.payments || [],
        createdAt: r.created_at,
        lastEditedAt: r.last_edited_at,
        frameBrand: r.frame_brand,
        frameModel: r.frame_model,
        frameColor: r.frame_color,
        frameSize: r.frame_size,
        framePrice: Number(r.frame_price) || 0,
        lensType: r.lens_type,
        lensPrice: Number(r.lens_price) || 0,
        coating: r.coating,
        coatingPrice: Number(r.coating_price) || 0,
        thickness: r.thickness,
        thicknessPrice: Number(r.thickness_price) || 0,
      }));
      setProfileInvoices(mapped.filter((i) => !i.isArchived));
    } catch (e) {
      console.error("Open profile failed:", e);
      toast.error(
        language === "ar"
          ? "حدث خطأ أثناء تحميل بيانات العميل"
          : "Error loading customer profile"
      );
    } finally {
      setProfileLoading(false);
    }
  };

  // The Supabase `invoices` row is snake_case; ReceiptInvoice /
  // CustomWorkOrderReceipt expect camelCase. Map before handing off to print,
  // otherwise the receipt renders blank.
  const toCamelInvoice = (row: any) => {
    if (!row) return row;
    const payments = Array.isArray(row.payments)
      ? row.payments
      : typeof row.payments === "string"
      ? (() => {
          try {
            return JSON.parse(row.payments);
          } catch {
            return [];
          }
        })()
      : [];
    return {
      id: row.id,
      invoiceId: row.invoice_id,
      workOrderId: row.work_order_id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      patientPhone: row.patient_phone,
      invoiceType: row.invoice_type,
      lensType: row.lens_type,
      lensPrice: Number(row.lens_price) || 0,
      coating: row.coating,
      coatingPrice: Number(row.coating_price) || 0,
      coatingColor: row.coating_color,
      thickness: row.thickness,
      thicknessPrice: Number(row.thickness_price) || 0,
      frameBrand: row.frame_brand,
      frameModel: row.frame_model,
      frameColor: row.frame_color,
      frameSize: row.frame_size,
      framePrice: Number(row.frame_price) || 0,
      contactLensItems: row.contact_lens_items,
      contactLensRx: row.contact_lens_rx,
      serviceName: row.service_name,
      serviceId: row.service_id,
      serviceDescription: row.service_description,
      servicePrice: Number(row.service_price) || 0,
      repairType: row.repair_type,
      repairDescription: row.repair_description,
      repairPrice: Number(row.repair_price) || 0,
      discount: Number(row.discount) || 0,
      deposit: Number(row.deposit) || 0,
      total: Number(row.total) || 0,
      remaining: Number(row.remaining) || 0,
      paymentMethod: row.payment_method,
      authNumber: row.auth_number,
      isPaid: !!row.is_paid,
      isPickedUp: !!row.is_picked_up,
      pickedUpAt: row.picked_up_at,
      isRefunded: !!row.is_refunded,
      refundAmount: Number(row.refund_amount) || 0,
      refundDate: row.refund_date,
      refundMethod: row.refund_method,
      refundId: row.refund_id,
      isArchived: !!row.is_archived,
      archivedAt: row.archived_at,
      payments,
      createdAt: row.created_at,
      lastEditedAt: row.last_edited_at,
    };
  };

  const toCamelWorkOrder = (row: any) => {
    if (!row) return row;
    const parse = (v: any) => {
      if (!v) return v;
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      }
      return v;
    };
    return {
      id: row.id,
      workOrderId: row.work_order_id,
      invoiceId: row.invoice_id,
      patientId: row.patient_id,
      isContactLens: !!row.is_contact_lens,
      isPaid: !!row.is_paid,
      lensType: parse(row.lens_type),
      contactLenses: parse(row.contact_lenses),
      contactLensRx: parse(row.contact_lens_rx),
      rx: parse(row.rx),
      coatingColor: row.coating_color,
      discount: Number(row.discount) || 0,
      status: row.status,
      createdAt: row.created_at,
    };
  };
  const [printBusy, setPrintBusy] = useState<
    null | "rx" | "invoice" | "workorder"
  >(null);

  const [isLoading, setIsLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [refundedInvoices, setRefundedInvoices] = useState<Invoice[]>([]);

  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 6),
    to: new Date(),
  });
  const [activePreset, setActivePreset] = useState<PresetKey | "custom">(
    "last7"
  );

  // Single source of truth for the transactions table: filtered strictly by
  // the selected date range (cash-basis: any payment in range counts) AND by
  // the search box. The header count and the body share this list so they
  // can never disagree. Declared AFTER invoices/refundedInvoices/date to avoid
  // temporal-dead-zone errors.
  const filteredTransactions = useMemo(() => {
    const q = txFilter.trim().toLowerCase();
    const rangeFrom = date?.from ? startOfDay(date.from) : null;
    const rangeTo = date?.to ? endOfDay(date.to) : null;
    const noRange = !rangeFrom || !rangeTo;
    const inRange = (iso?: string | null) => {
      if (noRange) return true; // no range picked → show everything
      if (!iso) return false; // range set but date missing → exclude
      const d = new Date(iso);
      if (isNaN(d.getTime())) return false;
      return d >= rangeFrom! && d <= rangeTo!;
    };
    // Dedupe by invoice_id — `invoices` now contains refunded rows too
    // (so the payment aggregator can credit their original payment day),
    // and `refundedInvoices` is still its own list, so we concat-then-dedupe.
    const byId = new Map<string, any>();
    for (const inv of [...(invoices || []), ...(refundedInvoices || [])]) {
      const id = (inv as any).invoice_id;
      if (id && !byId.has(id)) byId.set(id, inv);
    }
    return Array.from(byId.values())
      .map((inv) => {
        const payments = Array.isArray((inv as any).payments)
          ? (inv as any).payments
          : [];
        const refundDate = (inv as any).refund_date as string | null;
        const createdAt = (inv as any).created_at as string | null;
        // Cash-basis activity date = the payment event that puts this
        // invoice into the selected window. Pick the latest in-range payment,
        // fall back to refund_date, then to created_at for legacy invoices
        // with no payments[].
        const inRangePayments = payments.filter((p: any) => inRange(p?.date));
        const latestInRangePayment = inRangePayments.sort((a: any, b: any) =>
          (b.date || "").localeCompare(a.date || "")
        )[0];
        let activityDate: string | null = null;
        if (latestInRangePayment?.date) {
          activityDate = latestInRangePayment.date;
        } else if (refundDate && inRange(refundDate)) {
          activityDate = refundDate;
        } else if (payments.length === 0 && inRange(createdAt)) {
          activityDate = createdAt;
        }
        return { inv, activityDate };
      })
      .filter((x) => x.activityDate !== null)
      .map((x) => ({
        ...(x.inv as any),
        __activityDate: x.activityDate,
      }))
      .slice()
      .sort((a, b) =>
        ((b as any).__activityDate || "").localeCompare(
          (a as any).__activityDate || ""
        )
      )
      .filter((inv) => {
        if (!q) return true;
        return (
          (inv.patient_name || "").toLowerCase().includes(q) ||
          (inv.invoice_id || "").toLowerCase().includes(q) ||
          (inv.patient_phone || "").toLowerCase().includes(q)
        );
      });
  }, [invoices, refundedInvoices, date, txFilter]);

  const [salesData, setSalesData] = useState<any[]>([]);
  const [productSalesData, setProductSalesData] = useState<any[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalRefunds, setTotalRefunds] = useState(0);
  const [netRevenue, setNetRevenue] = useState(0);
  const [averageDailySales, setAverageDailySales] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [refundCount, setRefundCount] = useState(0);

  const t = {
    pageTitle:
      language === "ar" ? "التحليل المقارن" : "Comparative Analysis",
    storeLabel: storeInfo.name,
    totalSales: language === "ar" ? "إجمالي المبيعات" : "Total Sales",
    avgDaily: language === "ar" ? "متوسط اليومي" : "Average Daily",
    txCount: language === "ar" ? "عدد المعاملات" : "Transactions",
    netRevenue: language === "ar" ? "صافي الإيرادات" : "Net Revenue",
    totalRefunds: language === "ar" ? "إجمالي المستردات" : "Total Refunds",
    refundCount: language === "ar" ? "عدد المستردات" : "Refunds",
    salesTrend: language === "ar" ? "اتجاه المبيعات" : "Sales Trend",
    productSales: language === "ar" ? "مبيعات المنتجات" : "Product Sales",
    noData: language === "ar" ? "لا توجد بيانات" : "No data available",
    loading: language === "ar" ? "جارٍ التحميل..." : "Loading...",
    sales: language === "ar" ? "المبيعات" : "Sales",
    refunds: language === "ar" ? "المستردات" : "Refunds",
    net: language === "ar" ? "صافي" : "Net",
    lenses: language === "ar" ? "العدسات" : "Lenses",
    frames: language === "ar" ? "الإطارات" : "Frames",
    coatings: language === "ar" ? "الطلاءات" : "Coatings",
    customRange: language === "ar" ? "نطاق مخصص" : "Custom range",
  };

  const presets: { key: PresetKey; label: string }[] = [
    { key: "today", label: language === "ar" ? "اليوم" : "Today" },
    { key: "last7", label: language === "ar" ? "آخر ٧ أيام" : "Last 7 days" },
    { key: "last30", label: language === "ar" ? "آخر ٣٠ يوماً" : "Last 30 days" },
    { key: "thisMonth", label: language === "ar" ? "هذا الشهر" : "This month" },
    { key: "lastMonth", label: language === "ar" ? "الشهر الماضي" : "Last month" },
  ];

  const applyPreset = (key: PresetKey) => {
    const now = new Date();
    let from = now;
    let to = now;
    switch (key) {
      case "today":
        from = startOfDay(now);
        to = endOfDay(now);
        break;
      case "last7":
        from = startOfDay(subDays(now, 6));
        to = endOfDay(now);
        break;
      case "last30":
        from = startOfDay(subDays(now, 29));
        to = endOfDay(now);
        break;
      case "thisMonth":
        from = startOfMonth(now);
        to = endOfDay(now);
        break;
      case "lastMonth": {
        const prev = subDays(startOfMonth(now), 1);
        from = startOfMonth(prev);
        to = endOfMonth(prev);
        break;
      }
    }
    setDate({ from, to });
    setActivePreset(key);
  };

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await (supabase as any)
          .from("invoices")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching invoices:", error);
          toast.error("Failed to fetch invoice data");
          return;
        }

        const parsed = (data || []).map((invoice: any) => ({
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

        // Fetch refunded invoices separately with a server-side filter.
        // The main `.select("*")` above is capped at 1000 rows by PostgREST,
        // so a refunded invoice older than the top 1000 by created_at would
        // be silently dropped — causing refunds to appear as 0 here.
        const { data: refundsData, error: refundsError } = await (
          supabase as any
        )
          .from("invoices")
          .select("*")
          .eq("is_refunded", true)
          .order("refund_date", { ascending: false });

        if (refundsError) {
          console.error("Error fetching refunded invoices:", refundsError);
        }

        const parsedRefunds = (refundsData || []).map((invoice: any) => ({
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

        // Merge refunded rows into main list (dedup by invoice_id) so the
        // aggregator can credit their original payments to the correct day.
        const byId = new Map<string, any>();
        for (const inv of parsed) byId.set(inv.invoice_id, inv);
        for (const inv of parsedRefunds) byId.set(inv.invoice_id, inv);
        setInvoices(Array.from(byId.values()));
        setRefundedInvoices(parsedRefunds);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load report data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  useEffect(() => {
    if (!date?.from || !date?.to) return;

    const startDate = date.from;
    const endDate = date.to;

    const paymentBuckets = aggregatePaymentsByDay(
      invoices as unknown as InvoiceLike[],
      startDate,
      endDate
    );

    const filteredRefunds = refundedInvoices.filter((refund) => {
      const refundDate = parseISO(refund.refund_date || "");
      return isWithinInterval(refundDate, { start: startDate, end: endDate });
    });

    const dailySales: {
      [key: string]: { sales: number; refunds: number };
    } = {};
    const dateRange = Math.abs(differenceInDays(startDate, endDate)) + 1;
    for (let i = 0; i < dateRange; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      dailySales[format(currentDate, "yyyy-MM-dd")] = { sales: 0, refunds: 0 };
    }

    let total = 0;
    let lensSales = 0;
    let frameSales = 0;
    let coatingSales = 0;
    const payingInvoiceIds = new Set<string>();

    paymentBuckets.forEach((bucket, dayKey) => {
      if (!dailySales[dayKey]) dailySales[dayKey] = { sales: 0, refunds: 0 };
      dailySales[dayKey].sales += bucket.total;
      total += bucket.total;
      lensSales += bucket.lens;
      frameSales += bucket.frame;
      coatingSales += bucket.coating;
      for (const entry of bucket.entries) {
        payingInvoiceIds.add(entry.invoice.invoice_id);
      }
    });

    let refundTotal = 0;
    filteredRefunds.forEach((refund) => {
      const dateKey = format(parseISO(refund.refund_date || ""), "yyyy-MM-dd");
      if (!dailySales[dateKey]) dailySales[dateKey] = { sales: 0, refunds: 0 };
      dailySales[dateKey].refunds += refund.refund_amount || 0;
      refundTotal += refund.refund_amount || 0;
    });

    const dateLocale = language === "ar" ? arLocale : enLocale;
    const chartData = Object.entries(dailySales)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, data]) => ({
        date: d,
        // Compact axis label: "6 Apr" / "٦ أبر" — full weekday shows in tooltip.
        displayDate: format(new Date(d), "d MMM", { locale: dateLocale }),
        sales: data.sales,
        refunds: data.refunds,
        net: data.sales - data.refunds,
      }));

    setSalesData(chartData);

    setProductSalesData([
      { name: t.lenses, sales: lensSales },
      { name: t.frames, sales: frameSales },
      { name: t.coatings, sales: coatingSales },
    ]);

    setTotalSales(total);
    setTotalRefunds(refundTotal);
    setNetRevenue(total - refundTotal);
    setTransactionCount(payingInvoiceIds.size);
    setRefundCount(filteredRefunds.length);

    const numberOfDays = Math.max(
      1,
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)
      ) + (dateRange === 1 ? 1 : 0)
    );
    setAverageDailySales((total - refundTotal) / Math.max(1, dateRange));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, invoices, refundedInvoices, language]);

  const handleDateRangeChange = (newDateRange: DateRange | undefined) => {
    if (newDateRange) {
      setDate(newDateRange);
      setActivePreset("custom");
    }
  };

  const handlePrintReport = () => {
    const pageTitle =
      language === "ar"
        ? "تقرير التحليل المقارن"
        : "Comparative Analysis Report";

    const dateRangeDisplay =
      date?.from && date?.to
        ? `${format(date.from, "MM/dd/yyyy")} - ${format(date.to, "MM/dd/yyyy")}`
        : language === "ar"
        ? "غير محدد"
        : "Not specified";

    const row = (label: string, value: string) => `
      <div class="summary-item-row">
        <span class="summary-item-title">${label}:</span>
        <span class="summary-item-value">${value}</span>
      </div>`;

    const reportContent = `
      <div class="store-header">
        <div class="store-logo"><img src="${STORE_LOGO}" alt="${t.storeLabel}" /></div>
        <div class="store-info">
          <p class="store-name"><strong>${storeInfo.name}</strong></p>
          ${storeInfo.address
            .split("\n")
            .map((line) => `<p class="store-address">${line}</p>`)
            .join("")}
          <p class="store-phone">${storeInfo.phone}</p>
        </div>
      </div>
      <div class="report-header">
        <div class="report-title">${pageTitle}</div>
        <div class="report-date">${format(new Date(), "MM/dd/yyyy")}</div>
      </div>
      <div class="summary-section">
        ${row(language === "ar" ? "الفترة" : "Period", dateRangeDisplay)}
      </div>
      <div class="divider"></div>
      <div class="summary-section">
        <div class="section-title">${language === "ar" ? "ملخص المبيعات" : "Sales Summary"}</div>
        ${row(t.totalSales, formatKWD(totalSales, language))}
        ${row(t.netRevenue, formatKWD(netRevenue, language))}
        ${row(t.txCount, nfInt.format(transactionCount))}
        ${row(t.totalRefunds, formatKWD(totalRefunds, language))}
        ${row(t.refundCount, nfInt.format(refundCount))}
      </div>
      <div class="divider"></div>
      <div class="summary-section">
        <div class="section-title">${language === "ar" ? "المنتجات" : "Products"}</div>
        ${productSalesData
          .map((p) => row(p.name, formatKWD(p.sales, language)))
          .join("")}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} ${t.storeLabel}</p>
      </div>
    `;

    const printCss = `
      <style>
        @page { size: 80mm auto; margin: 0; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; width: 76mm; max-width: 76mm; }
        .store-header { text-align: center; padding: 5px; border-bottom: 1px solid #000; }
        .store-logo img { height: 50px; width: auto; }
        .store-name { font-size: 18px; font-weight: bold; margin: 5px 0; }
        .store-address, .store-phone { font-size: 14px; margin: 3px 0; }
        .report-header { text-align: center; margin: 10px 0; }
        .report-title { font-size: 18px; font-weight: bold; padding: 3px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
        .section-title { font-size: 16px; font-weight: bold; background: #eee; padding: 5px; margin-bottom: 10px; text-align: center; border-radius: 3px; }
        .summary-section { margin-bottom: 15px; padding: 0 5px; }
        .summary-item-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .summary-item-title { font-weight: bold; }
        .summary-item-value { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 10px 0; }
        .footer { text-align: center; font-size: 12px; padding-top: 5px; border-top: 1px solid #000; }
      </style>
    `;

    PrintService.printReport(reportContent + printCss, pageTitle, () => {
      toast.success(
        language === "ar" ? "تم إرسال التقرير للطباعة" : "Report sent to printer"
      );
    });
  };

  const hasData = salesData.length > 0;

  // KPI card renderer
  const KpiCard = ({
    label,
    value,
    sublabel,
    accent,
    icon: Icon,
  }: {
    label: string;
    value: string;
    sublabel?: string;
    accent?: "emerald" | "rose" | "slate" | "sky" | "amber";
    icon?: React.ElementType;
  }) => {
    const accentMap: Record<string, string> = {
      emerald: "text-emerald-600",
      rose: "text-rose-600",
      sky: "text-sky-600",
      amber: "text-amber-600",
      slate: "text-slate-900",
    };
    const valueClass = accentMap[accent || "slate"];
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-slate-500">
          {Icon ? <Icon className="h-4 w-4" /> : null}
          <p className="text-sm font-semibold">{label}</p>
        </div>
        <p
          className={`text-3xl font-bold tabular-nums ${valueClass}`}
          dir="ltr"
          style={{ textAlign: isRtl ? "right" : "left" }}
        >
          {value}
        </p>
        {sublabel ? (
          <p
            className="text-xs text-slate-500 tabular-nums"
            dir="ltr"
            style={{ textAlign: isRtl ? "right" : "left" }}
          >
            {sublabel}
          </p>
        ) : null}
      </div>
    );
  };

  const axisTick = { fill: PALETTE.slate500, fontSize: 12 };

  return (
    <div
      className={`space-y-5 bg-stone-50 p-4 sm:p-6 rounded-2xl ${className || ""}`}
      style={{ direction: isRtl ? "rtl" : "ltr" }}
    >
      {/* Header + controls */}
      <Card className="bg-white border-slate-200 rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-slate-900 text-lg font-semibold">
              <Calendar className="h-5 w-5 text-slate-500" />
              {t.pageTitle}
            </span>
            <div className="hidden sm:flex items-center text-sm text-slate-500 gap-1.5">
              <Store className="h-4 w-4" />
              <span>{t.storeLabel}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col gap-4">
            {/* Prominent preset row */}
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => {
                const active = activePreset === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => applyPreset(p.key)}
                    className={[
                      "px-4 py-2 rounded-full text-sm font-semibold border transition-colors",
                      active
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100",
                    ].join(" ")}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="w-full sm:w-auto">
                <DatePicker
                  date={date}
                  onSelect={handleDateRangeChange}
                  defaultMonth={date?.from}
                  className="w-full sm:w-auto"
                />
              </div>
              {activePreset === "custom" && (
                <span className="text-xs text-slate-500">
                  {t.customRange}
                </span>
              )}
              <div className="w-full sm:w-auto sm:ml-auto">
                <PrintReportButton
                  onPrint={handlePrintReport}
                  className="w-full sm:w-auto"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400 mb-2" />
            <p className="text-sm text-slate-500">{t.loading}</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Grid — all numbers rendered with Latin digits */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label={t.totalSales}
              value={formatKWD(totalSales, language)}
              accent="slate"
              icon={Receipt}
            />
            <KpiCard
              label={t.txCount}
              value={nfInt.format(transactionCount)}
              accent="amber"
              icon={BarChart3}
            />
            <KpiCard
              label={t.netRevenue}
              value={formatKWD(netRevenue, language)}
              accent="emerald"
              icon={Receipt}
            />
            <KpiCard
              label={t.totalRefunds}
              value={`-${formatKWD(totalRefunds, language)}`}
              sublabel={`${t.refundCount}: ${nfInt.format(refundCount)}`}
              accent="rose"
              icon={RefreshCcw}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-white border-slate-200 rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-slate-900 text-lg font-semibold">
                  <LineChartIcon className="h-5 w-5 text-slate-500" />
                  {t.salesTrend}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {hasData ? (
                  <ResponsiveContainer width="100%" height={360}>
                    <ComposedChart
                      data={salesData}
                      margin={{ top: 20, right: 24, left: 0, bottom: 16 }}
                    >
                      <defs>
                        <linearGradient
                          id="salesFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={PALETTE.emerald}
                            stopOpacity={0.28}
                          />
                          <stop
                            offset="100%"
                            stopColor={PALETTE.emerald}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={PALETTE.slate200}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="displayDate"
                        // No rotation; compact labels + smart spacing so Arabic
                        // day/month text never collides.
                        height={36}
                        tickMargin={12}
                        // Recharts auto-thins ticks when labels would overlap.
                        interval="preserveStartEnd"
                        minTickGap={24}
                        reversed={isRtl}
                        tick={axisTick}
                        axisLine={{ stroke: PALETTE.slate200 }}
                        tickLine={false}
                        padding={{ left: 12, right: 12 }}
                      />
                      <YAxis
                        tick={axisTick}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => nfInt.format(v)}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          background: "#fff",
                          border: `1px solid ${PALETTE.slate200}`,
                          borderRadius: 12,
                          fontSize: 13,
                        }}
                        formatter={(value: number) =>
                          formatKWD(value, language)
                        }
                        labelFormatter={(label) => {
                          const matchedDate =
                            salesData.find(
                              (item) => item.displayDate === label
                            )?.date || new Date();
                          // "الجمعة، ٢٧ مارس ٢٠٢٦" / "Friday, March 27, 2026"
                          return format(
                            new Date(matchedDate),
                            "EEEE, d MMMM yyyy",
                            { locale: language === "ar" ? arLocale : enLocale }
                          );
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 13, color: PALETTE.slate700 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        stroke="none"
                        fill="url(#salesFill)"
                        name={t.sales}
                      />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        name={t.sales}
                        stroke={PALETTE.slate700}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: PALETTE.slate700 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="refunds"
                        name={t.refunds}
                        stroke={PALETTE.rose}
                        strokeWidth={2}
                        dot={{ r: 2, fill: PALETTE.rose }}
                      />
                      <Line
                        type="monotone"
                        dataKey="net"
                        name={t.net}
                        stroke={PALETTE.emerald}
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[320px]">
                    <p className="text-sm text-slate-500">{t.noData}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-slate-900 text-lg font-semibold">
                  <BarChart3 className="h-5 w-5 text-slate-500" />
                  {t.productSales}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2 pb-6">
                {(() => {
                  // Only show categories with actual sales so the chart
                  // doesn't leave empty rows the user has to visually skip.
                  const rows = (productSalesData || []).filter(
                    (item) => (item?.sales || 0) > 0
                  );
                  const total = rows.reduce(
                    (s, r) => s + (Number(r.sales) || 0),
                    0
                  );
                  const CATEGORY_COLORS: Record<string, string> = {
                    // Category names come from t.sales keys — match by
                    // substring so both AR and EN labels work.
                    lens: PALETTE.sky,
                    عدس: PALETTE.sky,
                    frame: PALETTE.amber,
                    إطار: PALETTE.amber,
                    coating: PALETTE.emerald,
                    طلاء: PALETTE.emerald,
                  };
                  const colorFor = (name: string) => {
                    const key = Object.keys(CATEGORY_COLORS).find((k) =>
                      (name || "").toLowerCase().includes(k)
                    );
                    return key ? CATEGORY_COLORS[key] : PALETTE.slate900;
                  };

                  if (rows.length === 0) {
                    return (
                      <div className="flex items-center justify-center h-[240px]">
                        <p className="text-sm text-slate-500">{t.noData}</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {rows.map((row) => {
                        const pct = total > 0 ? (row.sales / total) * 100 : 0;
                        const color = colorFor(row.name);
                        return (
                          <div key={row.name} className="space-y-1.5">
                            <div className="flex items-baseline justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                                  style={{ backgroundColor: color }}
                                />
                                <span className="text-base font-semibold text-slate-800 truncate">
                                  {row.name}
                                </span>
                              </div>
                              <div className="flex items-baseline gap-2 shrink-0">
                                <span className="text-lg font-bold text-slate-900 tabular-nums" dir="ltr">
                                  {formatKWD(row.sales, language)}
                                </span>
                                <span className="text-xs font-semibold text-slate-500 tabular-nums" dir="ltr">
                                  {pct.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.max(pct, 2)}%`,
                                  backgroundColor: color,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* ================ Transactions table ================ */}
          <Card className="bg-white border-slate-200 rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-900 text-xl font-bold">
                <Receipt className="h-6 w-6 text-slate-500" />
                {language === "ar" ? "المعاملات" : "Transactions"}
                <span className="text-base font-semibold text-slate-500 tabular-nums">
                  ({nfInt.format(filteredTransactions.length)})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Prominent full-width search bar */}
              <div className="relative mb-4">
                <SearchIcon
                  className={`pointer-events-none absolute top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 ${
                    isRtl ? "right-4" : "left-4"
                  }`}
                />
                <Input
                  placeholder={tr("searchTransactions")}
                  value={txFilter}
                  onChange={(e) => setTxFilter(e.target.value)}
                  className={`h-12 text-base bg-slate-50 border-slate-200 focus-visible:ring-slate-400 ${
                    isRtl ? "pr-12 pl-10" : "pl-12 pr-10"
                  }`}
                />
                {txFilter && (
                  <button
                    type="button"
                    onClick={() => setTxFilter("")}
                    className={`absolute top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 ${
                      isRtl ? "left-3" : "right-3"
                    }`}
                    aria-label="Clear search"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              {(() => {
                const rows = filteredTransactions;
                const q = txFilter.trim().toLowerCase();
                if (rows.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-500 text-sm">
                      {q
                        ? language === "ar"
                          ? "لا توجد نتائج مطابقة"
                          : "No matching results"
                        : language === "ar"
                        ? "لا توجد معاملات في هذه الفترة"
                        : "No transactions in this range"}
                    </div>
                  );
                }

                const jumpToProfile = (patientId?: string) => {
                  if (!patientId) {
                    toast.error(
                      language === "ar"
                        ? "لا يوجد رقم عميل مرتبط بهذه الفاتورة"
                        : "No customer linked to this invoice"
                    );
                    return;
                  }
                  openProfile(patientId);
                };

                return (
                  <div className="space-y-3">
                    {rows.map((inv) => {
                      const activityDate =
                        (inv as any).__activityDate ||
                        (inv as any).created_at;
                      const dayLabel = activityDate
                        ? format(new Date(activityDate), "EEE d MMM yyyy", {
                            locale:
                              language === "ar" ? arLocale : enLocale,
                          })
                        : "—";
                      const isPaid =
                        !!(inv as any).is_paid ||
                        Number(inv.remaining || 0) <= 0;
                      const isRefunded = !!(inv as any).is_refunded;

                      // Status-driven accent stripe so a non-technical user
                      // can scan the list and read row type before numbers.
                      const stripe = isRefunded
                        ? "bg-rose-500"
                        : isPaid
                        ? "bg-emerald-500"
                        : "bg-amber-500";
                      const statusBadgeClass = isRefunded
                        ? "bg-rose-100 text-rose-800 hover:bg-rose-100"
                        : isPaid
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                        : "bg-amber-100 text-amber-800 hover:bg-amber-100";
                      const statusLabel = isRefunded
                        ? language === "ar"
                          ? "مسترد"
                          : "Refunded"
                        : isPaid
                        ? language === "ar"
                          ? "مدفوع"
                          : "Paid"
                        : language === "ar"
                        ? "غير مكتمل"
                        : "Unpaid";

                      return (
                        <div
                          key={(inv as any).id || inv.invoice_id}
                          className="relative flex flex-col lg:flex-row lg:items-center gap-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 pl-5 sm:pl-6 shadow-sm hover:border-slate-300 hover:shadow-md transition-all overflow-hidden"
                        >
                          {/* Left accent stripe — absolute so it aligns both LTR and RTL */}
                          <span
                            className={`absolute top-0 bottom-0 w-1.5 ${stripe} ${
                              isRtl ? "right-0" : "left-0"
                            }`}
                            aria-hidden
                          />

                          {/* Customer block — biggest, scans first */}
                          <div className="flex-1 min-w-0">
                            <div className="text-lg font-bold text-slate-900 truncate">
                              {inv.patient_name || "—"}
                            </div>
                            {inv.patient_phone && (
                              <div
                                dir="ltr"
                                className="mt-1 text-sm text-slate-500 tabular-nums text-start"
                              >
                                {inv.patient_phone}
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                              <span className="tabular-nums">{dayLabel}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-xs font-medium text-slate-400 tabular-nums">
                                #{inv.invoice_id}
                              </span>
                            </div>
                          </div>

                          {/* Total + status */}
                          <div className="flex flex-row lg:flex-col items-start lg:items-end justify-between lg:justify-center gap-2 lg:min-w-[140px]">
                            <div
                              className="text-xl font-bold text-slate-900 tabular-nums"
                              dir="ltr"
                            >
                              {formatKWD(inv.total || 0, language)}
                            </div>
                            <Badge
                              className={`${statusBadgeClass} border-0 px-3 py-1 text-sm font-semibold`}
                            >
                              {statusLabel}
                            </Badge>
                          </div>

                          {/* Balance warning — only when unpaid */}
                          {Number(inv.remaining || 0) > 0 && (
                            <div
                              className="text-sm font-semibold text-amber-700 tabular-nums lg:min-w-[140px] lg:text-end"
                              dir="ltr"
                            >
                              {language === "ar" ? "المتبقي: " : "Balance: "}
                              {formatKWD(inv.remaining || 0, language)}
                            </div>
                          )}

                          {/* Actions — same size, stack vertically on narrow */}
                          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:min-w-[140px]">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-11 px-4 gap-2 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap"
                              onClick={() => setPrintTarget(inv)}
                            >
                              <Printer className="h-4 w-4" />
                              {tr("print")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-11 px-4 gap-2 text-sm font-semibold border-slate-300 text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                              onClick={() =>
                                jumpToProfile(inv.patient_id)
                              }
                            >
                              <UserRound className="h-4 w-4" />
                              {tr("profile")}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </>
      )}

      {/* ============== Print choice dialog ============== */}
      <Dialog
        open={!!printTarget}
        onOpenChange={(open) => {
          if (!open) {
            setPrintTarget(null);
            setPrintBusy(null);
          }
        }}
      >
        <DialogContent
          className="sm:max-w-lg rounded-2xl"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <DialogHeader className={isRtl ? "text-right" : "text-left"}>
            <DialogTitle className="text-xl font-bold text-slate-900">
              {tr("printWhat")}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {tr("printWhatDesc")}
              {printTarget?.patient_name ? (
                <span className="block mt-1 text-slate-700 font-medium">
                  {printTarget.patient_name}{" "}
                  <span className="text-xs text-slate-400 tabular-nums">
                    #{printTarget.invoice_id}
                  </span>
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 mt-2">
            {/* RX */}
            <button
              type="button"
              disabled={printBusy !== null}
              onClick={async () => {
                if (!printTarget) return;
                const inv = printTarget;
                if (!inv.patient_id) {
                  toast.error(tr("noRxAvailable"));
                  return;
                }
                try {
                  setPrintBusy("rx");
                  const patientData = await getPatientById(inv.patient_id);
                  // getPatientById returns a wrapper { patient, notes, ...Prescriptions }.
                  const patientRow = (patientData as any)?.patient;
                  const gx = (patientData as any)?.glassesPrescriptions?.[0];
                  if (!patientRow || !gx) {
                    toast.error(tr("noRxAvailable"));
                    return;
                  }
                  const rxData = {
                    sphereOD: gx.od_sph || "",
                    cylOD: gx.od_cyl || "",
                    axisOD: gx.od_axis || "",
                    addOD: gx.od_add || "",
                    sphereOS: gx.os_sph || "",
                    cylOS: gx.os_cyl || "",
                    axisOS: gx.os_axis || "",
                    addOS: gx.os_add || "",
                    pdRight: gx.od_pd || "",
                    pdLeft: gx.os_pd || "",
                    createdAt: gx.prescription_date || gx.created_at,
                  };
                  printRxReceipt({
                    patientName:
                      patientRow.full_name || inv.patient_name,
                    patientPhone:
                      patientRow.phone_number || (inv as any).patient_phone,
                    rx: rxData,
                    forcedLanguage: language,
                  });
                  setPrintTarget(null);
                } catch (err) {
                  console.error("RX print error:", err);
                  toast.error(tr("noRxAvailable"));
                } finally {
                  setPrintBusy(null);
                }
              }}
              className="group flex items-center gap-4 p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-sky-400 hover:bg-sky-50 transition-all text-start disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="h-12 w-12 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 group-hover:bg-sky-200">
                <EyeIcon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-slate-900">
                  {tr("printRx")}
                </div>
                <div className="text-sm text-slate-500">
                  {tr("printRxDesc")}
                </div>
              </div>
              {printBusy === "rx" ? (
                <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
              ) : null}
            </button>

            {/* Invoice */}
            <button
              type="button"
              disabled={printBusy !== null}
              onClick={() => {
                if (!printTarget) return;
                try {
                  setPrintBusy("invoice");
                  CustomPrintService.printInvoice(
                    toCamelInvoice(printTarget) as any
                  );
                  setPrintTarget(null);
                } catch (err) {
                  console.error("Invoice print error:", err);
                  toast.error(
                    language === "ar"
                      ? "تعذرت طباعة الفاتورة"
                      : "Failed to print invoice"
                  );
                } finally {
                  setPrintBusy(null);
                }
              }}
              className="group flex items-center gap-4 p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-all text-start disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-200">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-slate-900">
                  {tr("printInvoiceShort")}
                </div>
                <div className="text-sm text-slate-500">
                  {tr("printInvoiceShortDesc")}
                </div>
              </div>
              {printBusy === "invoice" ? (
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              ) : null}
            </button>

            {/* Work Order */}
            <button
              type="button"
              disabled={printBusy !== null}
              onClick={async () => {
                if (!printTarget) return;
                const inv = printTarget;
                try {
                  setPrintBusy("workorder");
                  // Fetch the work order linked to this invoice.
                  // Try the direct FK first (work_order_id on invoice), then
                  // fall back to reverse lookup by invoice_id.
                  const woId = (inv as any).work_order_id;
                  let wo: any = null;
                  if (woId) {
                    const { data } = await (supabase as any)
                      .from("work_orders")
                      .select("*")
                      .eq("work_order_id", woId)
                      .maybeSingle();
                    wo = data;
                  }
                  if (!wo) {
                    const { data } = await (supabase as any)
                      .from("work_orders")
                      .select("*")
                      .eq("invoice_id", inv.invoice_id)
                      .maybeSingle();
                    wo = data;
                  }
                  if (!wo) {
                    toast.error(tr("noWorkOrderAvailable"));
                    return;
                  }
                  // Fetch patient (optional; work order print tolerates missing).
                  let patient: any = undefined;
                  if (inv.patient_id) {
                    try {
                      const p = await getPatientById(inv.patient_id);
                      const pRow = (p as any)?.patient;
                      if (pRow) {
                        patient = {
                          patientId: pRow.id,
                          name: pRow.full_name,
                          phone: pRow.phone_number,
                          dob: pRow.date_of_birth || "",
                          notes: pRow.notes || "",
                          rx: {} as any,
                        };
                      }
                    } catch {
                      /* ignore */
                    }
                  }
                  CustomPrintService.printWorkOrder(
                    toCamelWorkOrder(wo) as any,
                    toCamelInvoice(inv) as any,
                    patient
                  );
                  setPrintTarget(null);
                } catch (err) {
                  console.error("Work order print error:", err);
                  toast.error(tr("noWorkOrderAvailable"));
                } finally {
                  setPrintBusy(null);
                }
              }}
              className="group flex items-center gap-4 p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-all text-start disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 group-hover:bg-amber-200">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-slate-900">
                  {tr("printWorkOrderShort")}
                </div>
                <div className="text-sm text-slate-500">
                  {tr("printWorkOrderShortDesc")}
                </div>
              </div>
              {printBusy === "workorder" ? (
                <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
              ) : null}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline customer profile dialog — self-contained: data lives
          entirely in local state managed by openProfile(). No shared
          state with PatientSearch.

          NOTE: the heavy children (<PatientProfileInfo>, <PatientTransactions>)
          are only mounted AFTER the fetch resolves. Mounting them with
          half-built props (e.g. before `profilePatient.full_name` is set, or
          while `profileDetails.glassesPrescriptions` is still null) is what
          triggered the white-screen crash on click — PatientProfileInfo
          reads `patient.name.trim()`/`.charAt()` and <PatientTransactions>'s
          internal useEffect reads `patient.patientId` immediately on mount.
          A separate <ProfileErrorBoundary> catches any stray runtime error
          inside those subtrees so the whole app can't die again. */}
      <Dialog
        open={profileOpen}
        onOpenChange={(open) => {
          setProfileOpen(open);
          if (!open) {
            setProfilePatient(null);
            setProfileDetails(null);
            setProfileInvoices([]);
          }
        }}
      >
        <DialogContent className="max-w-[95vw] lg:max-w-[90vw] max-h-[92vh] overflow-y-auto p-0 bg-stone-50">
          {profileLoading ||
          !profilePatient ||
          !profilePatient.id ||
          !profileDetails ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>
                  {language === "ar" ? "جارٍ التحميل" : "Loading"}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center gap-3 p-16">
                <Loader2 className="w-12 h-12 animate-spin text-slate-500" />
                <p className="text-sm text-slate-500">
                  {language === "ar"
                    ? "جارٍ تحميل ملف العميل..."
                    : "Loading customer profile..."}
                </p>
              </div>
            </>
          ) : (
            <ProfileErrorBoundary
              onError={(err) => {
                console.error("[ComparativeAnalysis] profile render error:", err);
                toast.error(
                  language === "ar"
                    ? "تعذّر عرض ملف العميل"
                    : "Could not display customer profile"
                );
              }}
              fallback={
                <div className="p-10 text-center text-sm text-slate-500">
                  {language === "ar"
                    ? "تعذّر عرض ملف العميل. حاول مرة أخرى."
                    : "Could not display customer profile. Please try again."}
                </div>
              }
            >
              <DialogHeader className="px-6 lg:px-8 pt-6 pb-5 bg-white border-b border-slate-200 sticky top-0 z-10">
                <DialogTitle className="text-2xl font-bold text-slate-900 tracking-tight">
                  {language === "ar" ? "ملف العميل" : "Client Profile"}
                </DialogTitle>
                <DialogDescription className="text-base text-slate-500 mt-1">
                  {language === "ar"
                    ? "تفاصيل بيانات العميل وسجل المعاملات"
                    : "Client details and transaction history"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 p-6 lg:p-8">
                <div className="md:col-span-1">
                  <PatientProfileInfo
                    patient={{
                      patientId: profilePatient.id,
                      name: profilePatient.full_name || "—",
                      phone: profilePatient.phone_number || "",
                      dob: profilePatient.date_of_birth
                        ? new Date(profilePatient.date_of_birth).toISOString()
                        : "",
                      notes: "",
                      // Always provide a fully-formed rx object (empty strings)
                      // — matches PatientSearch.tsx and avoids `.rx.createdAt`
                      // style crashes in downstream components.
                      rx: {
                        sphereOD:
                          profileDetails.glassesPrescriptions[0]?.od_sph || "",
                        cylOD:
                          profileDetails.glassesPrescriptions[0]?.od_cyl || "",
                        axisOD:
                          profileDetails.glassesPrescriptions[0]?.od_axis ||
                          "",
                        addOD:
                          profileDetails.glassesPrescriptions[0]?.od_add || "",
                        pdRight:
                          profileDetails.glassesPrescriptions[0]?.od_pd || "",
                        sphereOS:
                          profileDetails.glassesPrescriptions[0]?.os_sph || "",
                        cylOS:
                          profileDetails.glassesPrescriptions[0]?.os_cyl || "",
                        axisOS:
                          profileDetails.glassesPrescriptions[0]?.os_axis ||
                          "",
                        addOS:
                          profileDetails.glassesPrescriptions[0]?.os_add || "",
                        pdLeft:
                          profileDetails.glassesPrescriptions[0]?.os_pd || "",
                      },
                      createdAt: profilePatient.created_at || "",
                    } as any}
                    invoices={profileInvoices as any}
                    onPrintPrescription={() => {
                      /* print from the row-level Print dialog instead */
                    }}
                  />
                </div>
                <div className="md:col-span-2 space-y-6">
                  <PatientPrescriptionDisplay
                    rx={{
                      sphereOD:
                        profileDetails.glassesPrescriptions[0]?.od_sph || "",
                      cylOD:
                        profileDetails.glassesPrescriptions[0]?.od_cyl || "",
                      axisOD:
                        profileDetails.glassesPrescriptions[0]?.od_axis || "",
                      addOD:
                        profileDetails.glassesPrescriptions[0]?.od_add || "",
                      pdRight:
                        profileDetails.glassesPrescriptions[0]?.od_pd || "",
                      sphereOS:
                        profileDetails.glassesPrescriptions[0]?.os_sph || "",
                      cylOS:
                        profileDetails.glassesPrescriptions[0]?.os_cyl || "",
                      axisOS:
                        profileDetails.glassesPrescriptions[0]?.os_axis || "",
                      addOS:
                        profileDetails.glassesPrescriptions[0]?.os_add || "",
                      pdLeft:
                        profileDetails.glassesPrescriptions[0]?.os_pd || "",
                    }}
                    rxHistory={(profileDetails.glassesPrescriptions || []).map(
                      (rx: any) => ({
                        sphereOD: rx.od_sph || "",
                        cylOD: rx.od_cyl || "",
                        axisOD: rx.od_axis || "",
                        addOD: rx.od_add || "",
                        pdRight: rx.od_pd || "",
                        sphereOS: rx.os_sph || "",
                        cylOS: rx.os_cyl || "",
                        axisOS: rx.os_axis || "",
                        addOS: rx.os_add || "",
                        pdLeft: rx.os_pd || "",
                        createdAt: rx.created_at,
                      })
                    )}
                    contactLensRx={
                      profileDetails.contactLensPrescriptions[0]
                        ? {
                            rightEye: {
                              sphere:
                                profileDetails.contactLensPrescriptions[0]
                                  .od_sphere || "",
                              cylinder:
                                profileDetails.contactLensPrescriptions[0]
                                  .od_cylinder || "",
                              axis:
                                profileDetails.contactLensPrescriptions[0]
                                  .od_axis || "",
                              bc:
                                profileDetails.contactLensPrescriptions[0]
                                  .od_base_curve || "",
                              dia:
                                profileDetails.contactLensPrescriptions[0]
                                  .od_diameter || "",
                            },
                            leftEye: {
                              sphere:
                                profileDetails.contactLensPrescriptions[0]
                                  .os_sphere || "",
                              cylinder:
                                profileDetails.contactLensPrescriptions[0]
                                  .os_cylinder || "",
                              axis:
                                profileDetails.contactLensPrescriptions[0]
                                  .os_axis || "",
                              bc:
                                profileDetails.contactLensPrescriptions[0]
                                  .os_base_curve || "",
                              dia:
                                profileDetails.contactLensPrescriptions[0]
                                  .os_diameter || "",
                            },
                            createdAt:
                              profileDetails.contactLensPrescriptions[0]
                                .created_at,
                          }
                        : undefined
                    }
                    contactLensRxHistory={(
                      profileDetails.contactLensPrescriptions || []
                    ).map((rx: any) => ({
                      rightEye: {
                        sphere: rx.od_sphere || "",
                        cylinder: rx.od_cylinder || "",
                        axis: rx.od_axis || "",
                        bc: rx.od_base_curve || "",
                        dia: rx.od_diameter || "",
                      },
                      leftEye: {
                        sphere: rx.os_sphere || "",
                        cylinder: rx.os_cylinder || "",
                        axis: rx.os_axis || "",
                        bc: rx.os_base_curve || "",
                        dia: rx.os_diameter || "",
                      },
                      createdAt: rx.created_at,
                    }))}
                    onPrintPrescription={() => {
                      /* printing is available from the per-row Print button
                         in the transactions list above */
                    }}
                    onPrintContactLensPrescription={() => {
                      /* same — use the row-level Print */
                    }}
                  />

                  <PatientTransactions
                    key={`cmp-tx-${profilePatient.id}`}
                    workOrders={[]}
                    invoices={profileInvoices as any}
                    patient={
                      {
                        patientId: profilePatient.id,
                        name: profilePatient.full_name || "—",
                        phone: profilePatient.phone_number || "",
                        dob: profilePatient.date_of_birth
                          ? new Date(profilePatient.date_of_birth).toISOString()
                          : "",
                        notes: "",
                        rx: {
                          sphereOD: "",
                          cylOD: "",
                          axisOD: "",
                          addOD: "",
                          pdRight: "",
                          sphereOS: "",
                          cylOS: "",
                          axisOS: "",
                          addOS: "",
                          pdLeft: "",
                        },
                        createdAt: profilePatient.created_at || "",
                      } as any
                    }
                  />
                </div>
              </div>
            </ProfileErrorBoundary>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComparativeAnalysis;
