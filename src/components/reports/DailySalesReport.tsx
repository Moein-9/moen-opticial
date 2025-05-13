import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { useLanguageStore } from "@/store/languageStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartLine,
  CreditCard,
  Wallet,
  Receipt,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Tag,
  MapPin,
  Store,
  Phone,
  RefreshCcw,
  Calendar as CalendarIcon,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SalesChart } from "./SalesChart";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { PrintService } from "@/utils/PrintService";
import { PrintReportButton } from "./PrintReportButton";
import { Button } from "@/components/ui/button";
import { MoenLogo, storeInfo } from "@/assets/logo";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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

        // Fetch invoices with payments made today (not necessarily created today)
        // @ts-ignore - Supabase type definitions may be incomplete for our schema
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("invoices")
          .select("*")
          .neq("payments", null);

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

        // Calculate total revenue (excluding refunded invoices)
        const revenue = parsedSalesData
          .filter((invoice: Invoice) => !invoice.is_refunded)
          .reduce((sum: number, invoice: Invoice) => {
            if (
              invoice.invoice_type === "contacts" &&
              invoice.contact_lens_items?.length
            ) {
              const contactLensTotal = invoice.contact_lens_items.reduce(
                (lensSum: number, lens: any) =>
                  lensSum + (lens.price || 0) * (lens.qty || 1),
                0
              );
              return (
                sum + Math.max(0, contactLensTotal - (invoice.discount || 0))
              );
            }
            return sum + invoice.total;
          }, 0);

        // Calculate product type revenues
        const lensRevenue = parsedSalesData
          .filter((invoice: Invoice) => !invoice.is_refunded)
          .reduce(
            (sum: number, invoice: Invoice) => sum + (invoice.lens_price || 0),
            0
          );

        const frameRevenue = parsedSalesData
          .filter((invoice: Invoice) => !invoice.is_refunded)
          .reduce(
            (sum: number, invoice: Invoice) => sum + (invoice.frame_price || 0),
            0
          );

        const coatingRevenue = parsedSalesData
          .filter((invoice: Invoice) => !invoice.is_refunded)
          .reduce(
            (sum: number, invoice: Invoice) =>
              sum + (invoice.coating_price || 0),
            0
          );

        // Calculate all payments received today
        let todaysPayments: {
          method: string;
          amount: number;
          count: number;
          invoiceId: string;
        }[] = [];
        
        // First add initial deposits from invoices created today
        parsedSalesData
          .filter((invoice: Invoice) => !invoice.is_refunded)
          .forEach((invoice: Invoice) => {
            // If the invoice has no payments array but has deposit, count it as a single payment
            if ((!invoice.payments || invoice.payments.length === 0) && invoice.deposit > 0) {
              todaysPayments.push({
                method: invoice.payment_method || "Unknown",
                amount: invoice.deposit,
                count: 1,
                invoiceId: invoice.invoice_id
              });
            } 
            // If it has payments array, add only today's payments
            else if (invoice.payments && invoice.payments.length > 0) {
              invoice.payments.forEach((payment: any) => {
                const paymentDate = new Date(payment.date);
                if (
                  paymentDate >= startOfDay &&
                  paymentDate <= endOfDay
                ) {
                  todaysPayments.push({
                    method: payment.method || invoice.payment_method || "Unknown",
                    amount: payment.amount || 0,
                    count: 1,
                    invoiceId: invoice.invoice_id
                  });
                }
              });
            }
          });
        
        // Then add payments from other invoices that have payments made today
        parsedPaymentsData
          .filter((invoice: Invoice) => 
            !invoice.is_refunded && 
            // Skip invoices already processed (created today)
            !parsedSalesData.some(todayInvoice => todayInvoice.invoice_id === invoice.invoice_id)
          )
          .forEach((invoice: Invoice) => {
            if (invoice.payments && invoice.payments.length > 0) {
              invoice.payments.forEach((payment: any) => {
                const paymentDate = new Date(payment.date);
                if (
                  paymentDate >= startOfDay &&
                  paymentDate <= endOfDay
                ) {
                  todaysPayments.push({
                    method: payment.method || invoice.payment_method || "Unknown",
                    amount: payment.amount || 0,
                    count: 1,
                    invoiceId: invoice.invoice_id
                  });
                }
              });
            }
          });

        // Calculate total deposits
        const depositsTotal = todaysPayments.reduce(
          (sum: number, payment) => sum + payment.amount, 
          0
        );

        // Calculate refund total
        const refundsTotal = parsedRefundsData.reduce(
          (sum: number, invoice: Invoice) => sum + (invoice.refund_amount || 0),
          0
        );

        // Payment method breakdown
        const paymentMethods: {
          [key: string]: { amount: number; count: number };
        } = {};

        todaysPayments.forEach((payment) => {
          const method = payment.method;
          if (!paymentMethods[method]) {
            paymentMethods[method] = { amount: 0, count: 0 };
          }

          paymentMethods[method].amount += payment.amount;
          paymentMethods[method].count += 1;
        });

        // Refund method breakdown
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

    let invoicesHTML = "";
    todaySales.forEach((invoice) => {
      invoicesHTML += `
        <tr>
          <td class="invoice-customer">${invoice.patient_name}</td>
          <td class="invoice-total">${invoice.total.toFixed(2)} ${
        t.currency
      }</td>
          <td class="invoice-paid">${invoice.deposit.toFixed(2)} ${
        t.currency
      }</td>
          <td class="invoice-method">${invoice.payment_method || "-"}</td>
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
              <td class="summary-value">${todaySales.length}</td>
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
          todaySales.length > 0
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

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl md:text-2xl font-bold">{t.dailySalesReport}</h2>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center text-sm text-muted-foreground gap-1">
            <Store className="h-4 w-4" />
            <span>{storeInfo.name}</span>
          </div>
          <PrintReportButton
            onPrint={handlePrintReport}
            className="w-full sm:w-auto"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-2 px-3 md:px-4">
            <CardTitle className="text-xs md:text-sm font-medium text-blue-700">
              {t.totalSales}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-4">
            <div className="text-xl md:text-2xl font-bold text-blue-900">
              {totalRevenue.toFixed(2)} {t.currency}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              {t.forDay}: {format(new Date(), "MM/dd/yyyy", { locale: enUS })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="pb-2 px-3 md:px-4">
            <CardTitle className="text-xs md:text-sm font-medium text-green-700">
              {t.netRevenue}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-4">
            <div className="text-xl md:text-2xl font-bold text-green-900">
              {netRevenue.toFixed(2)} {t.currency}
            </div>
            <p className="text-xs text-green-600 mt-1">{t.afterRefunds}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="pb-2 px-3 md:px-4">
            <CardTitle className="text-xs md:text-sm font-medium text-purple-700">
              {t.invoiceCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-4">
            <div className="text-xl md:text-2xl font-bold text-purple-900">
              {todaySales.length}
            </div>
            <p className="text-xs text-purple-600 mt-1">
              {t.inTodaysTransactions}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardHeader className="pb-2 px-3 md:px-4">
            <CardTitle className="text-xs md:text-sm font-medium text-red-700">
              {t.totalRefunds}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-4">
            <div className="text-xl md:text-2xl font-bold text-red-900">
              {totalRefunds.toFixed(2)} {t.currency}
            </div>
            <p className="text-xs text-red-600 mt-1">{t.todaysRefunds}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-4 md:mt-6">
        <Card className="border-indigo-200">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-t-lg py-3 px-3 md:p-4">
            <CardTitle className="text-indigo-700 text-sm md:text-base">
              {t.salesDistribution}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-4">
            <SalesChart
              lensRevenue={totalLensRevenue}
              frameRevenue={totalFrameRevenue}
              coatingRevenue={totalCoatingRevenue}
            />
          </CardContent>
        </Card>

        <Card className="border-teal-200">
          <CardHeader className="bg-gradient-to-r from-teal-50 to-teal-100 rounded-t-lg py-3 px-3 md:p-4">
            <CardTitle className="text-teal-700 text-sm md:text-base">
              {t.paymentMethods}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col space-y-3 md:space-y-4 p-3 md:p-4">
            {paymentBreakdown.map((payment, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 md:p-3 rounded-md bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2">
                  {payment.method === "نقداً" || payment.method === "Cash" ? (
                    <Wallet className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                  ) : payment.method === "كي نت" ||
                    payment.method === "KNET" ? (
                    <CreditCard className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
                  ) : payment.method === "Visa" ? (
                    <CreditCard className="h-4 w-4 md:h-5 md:w-5 text-indigo-500" />
                  ) : payment.method === "MasterCard" ? (
                    <CreditCard className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
                  ) : (
                    <Receipt className="h-4 w-4 md:h-5 md:w-5 text-gray-500" />
                  )}
                  <span className="font-medium text-sm md:text-base">
                    {payment.method}
                  </span>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                  <span className="text-xs md:text-sm text-gray-600 bg-gray-100 px-1.5 py-0.5 md:px-2 md:py-1 rounded-full">
                    {payment.count} {t.transactions}
                  </span>
                  <span className="font-medium text-sm md:text-base text-gray-900">
                    {payment.amount.toFixed(2)} {t.currency}
                  </span>
                </div>
              </div>
            ))}

            {paymentBreakdown.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                {t.noInvoices}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg py-3 px-3 md:p-4">
          <CardTitle className="text-gray-700 text-sm md:text-base">
            {t.todaysInvoiceList}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-4">
          {todaySales.length > 0 ? (
            <div className="space-y-3 md:space-y-4">
              {todaySales
                .filter((invoice) => !invoice.is_refunded)
                .map((invoice) => (
                  <div
                    key={invoice.invoice_id}
                    className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-all duration-200 border-gray-200"
                  >
                    <div
                      className={`flex flex-wrap md:flex-nowrap justify-between items-start md:items-center p-3 md:p-4 cursor-pointer gap-2 ${
                        expandedInvoices[invoice.invoice_id]
                          ? "bg-gray-50 border-b"
                          : ""
                      }`}
                      onClick={() => toggleInvoiceExpansion(invoice.invoice_id)}
                    >
                      <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
                        <div
                          className={`p-1.5 md:p-2 rounded-full ${
                            invoice.is_paid
                              ? "bg-green-100 text-green-600"
                              : "bg-amber-100 text-amber-600"
                          }`}
                        >
                          <Receipt
                            size={16}
                            className="md:w-[18px] md:h-[18px]"
                          />
                        </div>
                        <div>
                          <h3 className="font-medium text-sm md:text-base">
                            {invoice.patient_name}
                          </h3>
                          <p className="text-xs md:text-sm text-gray-500">
                            {invoice.invoice_id}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between w-full md:w-auto gap-2 md:gap-6">
                        <div className="text-right">
                          <p className="font-medium text-sm md:text-base">
                            {invoice.total.toFixed(2)} {t.currency}
                          </p>
                          <p className="text-xs md:text-sm text-gray-500">
                            {invoice.payment_method}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 md:h-8 md:w-8 rounded-full"
                        >
                          {expandedInvoices[invoice.invoice_id] ? (
                            <ChevronUp
                              size={16}
                              className="md:w-[18px] md:h-[18px]"
                            />
                          ) : (
                            <ChevronDown
                              size={16}
                              className="md:w-[18px] md:h-[18px]"
                            />
                          )}
                        </Button>
                      </div>
                    </div>

                    {expandedInvoices[invoice.invoice_id] && (
                      <div className="p-3 md:p-4 bg-gray-50 space-y-3 md:space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                          <div className="bg-white p-2 md:p-3 rounded-md border">
                            <h4 className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                              {t.customerInfo}
                            </h4>
                            <p className="font-medium text-sm md:text-base">
                              {invoice.patient_name}
                            </p>
                            <p className="text-xs md:text-sm">
                              {invoice.patient_phone}
                            </p>
                            {invoice.patient_id && (
                              <p className="text-xs text-gray-500">
                                {t.fileNumber}: {invoice.patient_id}
                              </p>
                            )}
                          </div>

                          <div className="bg-white p-2 md:p-3 rounded-md border">
                            <h4 className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                              {t.paymentInfo}
                            </h4>
                            <div className="flex justify-between items-center mt-1">
                              <span className="font-medium text-sm md:text-base">
                                {t.total}:
                              </span>
                              <span className="font-bold text-base md:text-lg">
                                {invoice.total.toFixed(2)} {t.currency}
                              </span>
                            </div>
                            <div className="flex justify-between items-center mt-1 md:mt-2">
                              <span className="text-blue-600 font-medium text-sm">
                                {t.paid}:
                              </span>
                              <span className="font-medium text-blue-600 text-sm">
                                {invoice.deposit.toFixed(2)} {t.currency}
                              </span>
                            </div>
                            {invoice.remaining > 0 && (
                              <div className="flex justify-between items-center mt-1 bg-amber-50 p-1 md:p-1.5 rounded">
                                <span className="text-amber-700 font-medium text-sm">
                                  {t.remaining}:
                                </span>
                                <span className="font-medium text-amber-700 text-sm">
                                  {invoice.remaining.toFixed(2)} {t.currency}
                                </span>
                              </div>
                            )}
                            {invoice.discount > 0 && (
                              <div className="flex justify-between text-green-600 mt-1 md:mt-2 bg-green-50 p-1 md:p-1.5 rounded">
                                <span className="flex items-center gap-1 font-medium text-sm">
                                  <Tag
                                    size={12}
                                    className="md:w-[14px] md:h-[14px]"
                                  />
                                  {t.discount}:
                                </span>
                                <span className="font-medium text-sm">
                                  {invoice.discount.toFixed(2)} {t.currency}
                                </span>
                              </div>
                            )}
                            <div className="mt-2 md:mt-3 pt-1 md:pt-2 border-t">
                              <span className="text-xs md:text-sm font-medium text-gray-600">
                                {t.paymentMethod}:
                              </span>
                              <div className="flex items-center gap-1 mt-0.5 md:mt-1">
                                {invoice.payment_method === "نقداً" ||
                                invoice.payment_method === "Cash" ? (
                                  <Wallet className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
                                ) : invoice.payment_method === "كي نت" ||
                                  invoice.payment_method === "KNET" ? (
                                  <CreditCard className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
                                ) : invoice.payment_method === "Visa" ? (
                                  <CreditCard className="h-3 w-3 md:h-4 md:w-4 text-indigo-500" />
                                ) : invoice.payment_method === "MasterCard" ? (
                                  <CreditCard className="h-3 w-3 md:h-4 md:w-4 text-orange-500" />
                                ) : (
                                  <Receipt className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
                                )}
                                <span className="text-xs md:text-sm">
                                  {invoice.payment_method}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white p-2 md:p-3 rounded-md border">
                            <h4 className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                              {t.invoiceStatus}
                            </h4>
                            <div
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                invoice.is_paid
                                  ? "bg-green-100 text-green-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {invoice.is_paid ? t.fullyPaid : t.partiallyPaid}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {t.creationDate}:{" "}
                              {new Date(
                                invoice.created_at
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                          <div className="bg-blue-50 p-2 md:p-3 rounded-md border border-blue-100">
                            <h4 className="text-xs md:text-sm font-medium text-blue-700 mb-1">
                              {t.lenses}
                            </h4>
                            <p className="font-medium text-sm md:text-base">
                              {invoice.lens_type}
                            </p>
                            <div className="flex justify-between mt-1">
                              <span className="text-xs md:text-sm text-blue-600">
                                {t.price}:
                              </span>
                              <span className="font-medium text-sm md:text-base">
                                {invoice.lens_price?.toFixed(2)} {t.currency}
                              </span>
                            </div>
                          </div>

                          <div className="bg-purple-50 p-2 md:p-3 rounded-md border border-purple-100">
                            <h4 className="text-xs md:text-sm font-medium text-purple-700 mb-1">
                              {t.frame}
                            </h4>
                            <p className="font-medium text-sm md:text-base">
                              {invoice.frame_brand} {invoice.frame_model}
                            </p>
                            <p className="text-xs md:text-sm text-purple-600">
                              {t.color}: {invoice.frame_color}
                            </p>
                            <div className="flex justify-between mt-1">
                              <span className="text-xs md:text-sm text-purple-600">
                                {t.price}:
                              </span>
                              <span className="font-medium text-sm md:text-base">
                                {invoice.frame_price?.toFixed(2)} {t.currency}
                              </span>
                            </div>
                          </div>

                          <div className="bg-green-50 p-2 md:p-3 rounded-md border border-green-100">
                            <h4 className="text-xs md:text-sm font-medium text-green-700 mb-1">
                              {t.coating}
                            </h4>
                            <p className="font-medium text-sm md:text-base">
                              {invoice.coating}
                            </p>
                            <div className="flex justify-between mt-1">
                              <span className="text-xs md:text-sm text-green-600">
                                {t.price}:
                              </span>
                              <span className="font-medium text-sm md:text-base">
                                {invoice.coating_price?.toFixed(2)} {t.currency}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 md:py-12 bg-gray-50 rounded-lg">
              <Receipt className="h-8 w-8 md:h-12 md:w-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-base md:text-lg font-medium text-gray-700 mb-1">
                {t.noInvoices}
              </h3>
              <p className="text-xs md:text-sm text-gray-500">
                {t.noInvoicesToday}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refund sections - moved to bottom and collapsed by default */}
      {todayRefunds.length > 0 && (
        <>
          <CollapsibleCard
            title={t.refundMethods}
            className="border-red-200"
            headerClassName="bg-gradient-to-r from-red-50 to-red-100"
            titleClassName="text-red-700"
            defaultOpen={false}
          >
            <div className="flex flex-col space-y-3 md:space-y-4 p-3 md:p-4">
              {refundBreakdown.map((refund, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 md:p-3 rounded-md bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2">
                    {refund.method === "نقداً" || refund.method === "Cash" ? (
                      <Wallet className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
                    ) : refund.method === "كي نت" ||
                      refund.method === "KNET" ? (
                      <CreditCard className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
                    ) : refund.method === "Visa" ? (
                      <CreditCard className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
                    ) : refund.method === "MasterCard" ? (
                      <CreditCard className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
                    ) : (
                      <RefreshCcw className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
                    )}
                    <span className="font-medium text-sm md:text-base">
                      {refund.method}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 md:gap-4">
                    <span className="text-xs md:text-sm text-gray-600 bg-gray-100 px-1.5 py-0.5 md:px-2 md:py-1 rounded-full">
                      {refund.count} {t.transactions}
                    </span>
                    <span className="font-medium text-sm md:text-base text-red-600">
                      {refund.amount?.toFixed(2)} {t.currency}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleCard>

          <CollapsibleCard
            title={t.refundedItems}
            className="border-red-200"
            headerClassName="bg-gradient-to-r from-red-50 to-red-100"
            titleClassName="text-red-700"
            defaultOpen={false}
          >
            <div className="divide-y border border-red-200 rounded-lg overflow-hidden bg-gradient-to-r from-red-50/30 to-pink-50/30 m-4">
              {todayRefunds.map((refund) => {
                // Find the associated invoice
                const relatedInvoice = todaySales.find(
                  (inv) => inv.invoice_id === refund.refund_id
                );

                return (
                  <div
                    key={refund.refund_id}
                    className="p-4 hover:bg-red-50/40 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-1.5">
                          <RefreshCcw className="h-5 w-5 text-red-600" />
                          <span className="font-semibold text-red-800 text-lg">
                            {refund.refund_id}
                          </span>
                          <span className="text-sm text-gray-500">
                            ({t.invoiceStatus}:{" "}
                            {relatedInvoice?.invoice_id || "N/A"})
                          </span>
                        </div>

                        <div className="text-xs text-red-600 flex items-center gap-1 mt-0.5">
                          <CalendarIcon className="h-3 w-3" />
                          {language === "ar"
                            ? "تاريخ الاسترداد:"
                            : "Refund date:"}{" "}
                          {formatDate(refund.refund_date)}
                        </div>

                        <div className="text-xs mt-1.5 text-red-600 bg-red-50 rounded-md inline-block px-2 py-0.5">
                          {t.reason}: {refund.refund_reason}
                        </div>

                        {relatedInvoice && (
                          <div className="text-sm mt-1 font-medium text-gray-700">
                            {language === "ar"
                              ? "اسم العميل:"
                              : "Customer name:"}{" "}
                            {relatedInvoice.patient_name}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="font-semibold text-red-800 text-xl">
                          {refund.refund_amount?.toFixed(3)} KWD
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {t.paymentMethod}: {refund.refund_method}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleCard>
        </>
      )}

      {/* Show refunded invoices in a separate section */}
      {todaySales.filter((invoice) => invoice.is_refunded).length > 0 && (
        <CollapsibleCard
          title={t.refundedInvoices}
          className="border-red-200"
          headerClassName="bg-gradient-to-r from-red-50 to-red-100"
          titleClassName="text-red-700"
          defaultOpen={false}
        >
          <div className="space-y-3 md:space-y-4 p-3 md:p-4">
            {todaySales
              .filter((invoice) => invoice.is_refunded)
              .map((invoice) => (
                <div
                  key={invoice.invoice_id}
                  className="border border-red-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div
                    className={`flex flex-wrap md:flex-nowrap justify-between items-start md:items-center p-3 md:p-4 cursor-pointer gap-2 ${
                      expandedInvoices[invoice.invoice_id]
                        ? "bg-red-50/20 border-b"
                        : "bg-red-50/20"
                    }`}
                    onClick={() => toggleInvoiceExpansion(invoice.invoice_id)}
                  >
                    <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
                      <div className="p-1.5 md:p-2 rounded-full bg-red-100 text-red-600">
                        <RefreshCcw
                          size={16}
                          className="md:w-[18px] md:h-[18px]"
                        />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm md:text-base">
                          {invoice.patient_name}
                        </h3>
                        <p className="text-xs md:text-sm text-gray-500">
                          {invoice.invoice_id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full md:w-auto gap-2 md:gap-6">
                      <div className="text-right">
                        <p className="font-medium text-sm md:text-base">
                          {invoice.total.toFixed(2)} {t.currency}
                          {invoice.is_refunded && invoice.refund_amount && (
                            <span className="text-red-600 block">
                              ({language === "ar" ? "مسترد:" : "Refunded:"}{" "}
                              {invoice.refund_amount.toFixed(2)} {t.currency})
                            </span>
                          )}
                        </p>
                        <p className="text-xs md:text-sm text-gray-500">
                          {invoice.payment_method}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 md:h-8 md:w-8 rounded-full"
                      >
                        {expandedInvoices[invoice.invoice_id] ? (
                          <ChevronUp
                            size={16}
                            className="md:w-[18px] md:h-[18px]"
                          />
                        ) : (
                          <ChevronDown
                            size={16}
                            className="md:w-[18px] md:h-[18px]"
                          />
                        )}
                      </Button>
                    </div>
                  </div>

                  {expandedInvoices[invoice.invoice_id] && (
                    <div className="p-3 md:p-4 bg-gray-50 space-y-3 md:space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                        <div className="bg-white p-2 md:p-3 rounded-md border">
                          <h4 className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                            {t.customerInfo}
                          </h4>
                          <p className="font-medium text-sm md:text-base">
                            {invoice.patient_name}
                          </p>
                          <p className="text-xs md:text-sm">
                            {invoice.patient_phone}
                          </p>
                          {invoice.patient_id && (
                            <p className="text-xs text-gray-500">
                              {t.fileNumber}: {invoice.patient_id}
                            </p>
                          )}
                        </div>

                        <div className="bg-white p-2 md:p-3 rounded-md border">
                          <h4 className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                            {t.paymentInfo}
                          </h4>
                          <div className="flex justify-between items-center mt-1">
                            <span className="font-medium text-sm md:text-base">
                              {t.total}:
                            </span>
                            <span className="font-bold text-base md:text-lg">
                              {invoice.total.toFixed(2)} {t.currency}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-1 md:mt-2">
                            <span className="text-blue-600 font-medium text-sm">
                              {t.paid}:
                            </span>
                            <span className="font-medium text-blue-600 text-sm">
                              {invoice.deposit.toFixed(2)} {t.currency}
                            </span>
                          </div>
                          {invoice.remaining > 0 && (
                            <div className="flex justify-between items-center mt-1 bg-amber-50 p-1 md:p-1.5 rounded">
                              <span className="text-amber-700 font-medium text-sm">
                                {t.remaining}:
                              </span>
                              <span className="font-medium text-amber-700 text-sm">
                                {invoice.remaining.toFixed(2)} {t.currency}
                              </span>
                            </div>
                          )}
                          {invoice.discount > 0 && (
                            <div className="flex justify-between text-green-600 mt-1 md:mt-2 bg-green-50 p-1 md:p-1.5 rounded">
                              <span className="flex items-center gap-1 font-medium text-sm">
                                <Tag
                                  size={12}
                                  className="md:w-[14px] md:h-[14px]"
                                />
                                {t.discount}:
                              </span>
                              <span className="font-medium text-sm">
                                {invoice.discount.toFixed(2)} {t.currency}
                              </span>
                            </div>
                          )}
                          <div className="mt-2 md:mt-3 pt-1 md:pt-2 border-t">
                            <span className="text-xs md:text-sm font-medium text-gray-600">
                              {t.paymentMethod}:
                            </span>
                            <div className="flex items-center gap-1 mt-0.5 md:mt-1">
                              {invoice.payment_method === "نقداً" ||
                              invoice.payment_method === "Cash" ? (
                                <Wallet className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
                              ) : invoice.payment_method === "كي نت" ||
                                invoice.payment_method === "KNET" ? (
                                <CreditCard className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
                              ) : invoice.payment_method === "Visa" ? (
                                <CreditCard className="h-3 w-3 md:h-4 md:w-4 text-indigo-500" />
                              ) : invoice.payment_method === "MasterCard" ? (
                                <CreditCard className="h-3 w-3 md:h-4 md:w-4 text-orange-500" />
                              ) : (
                                <Receipt className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
                              )}
                              <span className="text-xs md:text-sm">
                                {invoice.payment_method}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-2 md:p-3 rounded-md border">
                          <h4 className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                            {t.invoiceStatus}
                          </h4>
                          <div
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800`}
                          >
                            {language === "ar" ? "مسترد" : "Refunded"}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {t.creationDate}:{" "}
                            {new Date(invoice.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                        <div className="bg-blue-50 p-2 md:p-3 rounded-md border border-blue-100">
                          <h4 className="text-xs md:text-sm font-medium text-blue-700 mb-1">
                            {t.lenses}
                          </h4>
                          <p className="font-medium text-sm md:text-base">
                            {invoice.lens_type}
                          </p>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs md:text-sm text-blue-600">
                              {t.price}:
                            </span>
                            <span className="font-medium text-sm md:text-base">
                              {invoice.lens_price?.toFixed(2)} {t.currency}
                            </span>
                          </div>
                        </div>

                        <div className="bg-purple-50 p-2 md:p-3 rounded-md border border-purple-100">
                          <h4 className="text-xs md:text-sm font-medium text-purple-700 mb-1">
                            {t.frame}
                          </h4>
                          <p className="font-medium text-sm md:text-base">
                            {invoice.frame_brand} {invoice.frame_model}
                          </p>
                          <p className="text-xs md:text-sm text-purple-600">
                            {t.color}: {invoice.frame_color}
                          </p>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs md:text-sm text-purple-600">
                              {t.price}:
                            </span>
                            <span className="font-medium text-sm md:text-base">
                              {invoice.frame_price?.toFixed(2)} {t.currency}
                            </span>
                          </div>
                        </div>

                        <div className="bg-green-50 p-2 md:p-3 rounded-md border border-green-100">
                          <h4 className="text-xs md:text-sm font-medium text-green-700 mb-1">
                            {t.coating}
                          </h4>
                          <p className="font-medium text-sm md:text-base">
                            {invoice.coating}
                          </p>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs md:text-sm text-green-600">
                              {t.price}:
                            </span>
                            <span className="font-medium text-sm md:text-base">
                              {invoice.coating_price?.toFixed(2)} {t.currency}
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
