// @ts-nocheck - TypeScript definitions for Supabase results are incomplete

import React, { useState, useEffect } from "react";
import { Payment } from "@/store/invoiceStore";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Receipt,
  Wallet,
  CreditCard,
  Printer,
  CheckCircle2,
  User,
  Phone,
  Calendar,
  Eye,
  Frame,
  Droplets,
  ArrowRight,
  Tag,
  Search,
  Filter,
  Plus,
  Trash2,
  Eye as EyeIcon,
  FileText,
  UserCircle,
  History,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";
import { ReceiptInvoice } from "./ReceiptInvoice";
import { useLanguageStore } from "@/store/languageStore";
import { CustomPrintService } from "@/utils/CustomPrintService";
import { PrintReportButton } from "./reports/PrintReportButton";
import {
  getUnpaidInvoices,
  getInvoiceById,
  addPaymentToInvoice,
  addMultiplePaymentsToInvoice,
} from "@/services/invoiceService";
import { supabase } from "@/integrations/supabase/client";

// Define Invoice interface locally to avoid store dependency
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

  created_at: string;
  payments?: Payment[];
}

export const RemainingPayments: React.FC = () => {
  const { language, t } = useLanguageStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [invoiceDataForPrint, setInvoiceDataForPrint] =
    useState<Invoice | null>(null);
  const [showReceipt, setShowReceipt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastPaidInvoice, setLastPaidInvoice] = useState<Invoice | null>(null);
  const navigate = useNavigate();

  const [paymentEntries, setPaymentEntries] = useState<
    { method: string; amount: number; authNumber?: string }[]
  >([{ method: language === "ar" ? "نقداً" : "Cash", amount: 0 }]);

  useEffect(() => {
    loadUnpaidInvoices();
  }, []);

  const loadUnpaidInvoices = async () => {
    setIsLoading(true);
    try {
      console.log("-----------------------------");
      console.log("LOADING UNPAID INVOICES FROM DATABASE");
      const rawData = await getUnpaidInvoices();
      console.log("Raw unpaid invoices from Supabase:", rawData);

      // Convert the data to our local Invoice interface
      // @ts-ignore: Supabase TypeScript definitions are incomplete, we know the actual structure
      const convertedInvoices = rawData
        .map((item) => {
          // Ensure numeric values are properly converted
          const total = Number(item.total) || 0;
          const deposit = Number(item.deposit) || 0;
          const remaining = Number(item.remaining) || 0;

          // Double-check that remaining value makes sense
          // This helps prevent incorrect data from being displayed
          const calculatedRemaining = Math.max(0, total - deposit);

          // If there's a discrepancy, use the calculated value
          const finalRemaining =
            Math.abs(remaining - calculatedRemaining) < 0.01
              ? remaining
              : calculatedRemaining;

          // Determine if the invoice is actually paid
          const isPaid = finalRemaining === 0 || Boolean(item.is_paid);

          return {
            id: item.id || "",
            invoice_id: item.invoice_id || "",
            work_order_id: item.work_order_id,
            patient_id: item.patient_id,
            patient_name: item.patient_name || "",
            patient_phone: item.patient_phone,

            invoice_type: item.invoice_type || "glasses",

            lens_type: item.lens_type,
            lens_price: Number(item.lens_price) || 0,
            coating: item.coating,
            coating_price: Number(item.coating_price) || 0,
            coating_color: item.coating_color,
            thickness: item.thickness,
            thickness_price: Number(item.thickness_price) || 0,

            frame_brand: item.frame_brand,
            frame_model: item.frame_model,
            frame_color: item.frame_color,
            frame_size: item.frame_size,
            frame_price: Number(item.frame_price) || 0,

            contact_lens_items: item.contact_lens_items,
            contact_lens_rx: item.contact_lens_rx,

            service_name: item.service_name,
            service_price: Number(item.service_price) || 0,

            discount: Number(item.discount) || 0,
            deposit: deposit,
            total: total,
            remaining: finalRemaining,

            payment_method: item.payment_method || "",
            auth_number: item.auth_number,
            is_paid: isPaid,
            is_refunded: Boolean(item.is_refunded),
            refund_amount: Number(item.refund_amount) || 0,
            refund_date: item.refund_date,
            refund_method: item.refund_method,
            refund_reason: item.refund_reason,

            created_at: item.created_at || new Date().toISOString(),
            payments: item.payments || [],
          } as Invoice;
        })
        // Filter again to make sure only invoices with remaining > 0 and not marked as paid are shown
        .filter((inv) => inv.remaining > 0 && !inv.is_paid);

      console.log("Processed invoices after filtering:", convertedInvoices);
      console.log("-----------------------------");

      setInvoices(convertedInvoices);
    } catch (error) {
      console.error("Error loading unpaid invoices:", error);
      toast.error(t("errorLoadingInvoices"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPaymentEntries((entries) =>
      entries.map((entry) => ({
        ...entry,
        method: updatePaymentMethodByLanguage(entry.method),
      }))
    );
  }, [language]);

  const updatePaymentMethodByLanguage = (method: string): string => {
    if (language === "ar") {
      if (method === "Cash") return "نقداً";
      if (method === "KNET") return "كي نت";
      return method;
    } else {
      if (method === "نقداً") return "Cash";
      if (method === "كي نت") return "KNET";
      return method;
    }
  };

  const [remainingAfterPayment, setRemainingAfterPayment] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (selectedInvoice) {
      const invoice = invoices.find(
        (inv) => inv.invoice_id === selectedInvoice
      );
      if (invoice) {
        const totalPayment = calculateTotalPayment();
        const newRemaining = Math.max(0, invoice.remaining - totalPayment);
        setRemainingAfterPayment(newRemaining);
      }
    }
  }, [paymentEntries, selectedInvoice, invoices]);

  let filteredInvoices = [...invoices];

  if (searchTerm) {
    filteredInvoices = filteredInvoices.filter(
      (inv) =>
        inv.patient_name.includes(searchTerm) ||
        inv.patient_phone?.includes(searchTerm) ||
        inv.invoice_id.includes(searchTerm)
    );
  }

  filteredInvoices = filteredInvoices.sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
  });

  const goToPatientProfile = (
    patientId?: string,
    patientName?: string,
    patientPhone?: string
  ) => {
    if (patientId) {
      navigate("/", {
        state: {
          section: "patientSearch",
          patientId: patientId,
          searchMode: "id",
        },
      });
    } else if (patientName || patientPhone) {
      navigate("/", {
        state: {
          section: "patientSearch",
          searchTerm: patientName || patientPhone,
          searchMode: "name",
        },
      });
    }
  };

  const addPaymentEntry = () => {
    // Re-enable multiple payment entries
    setPaymentEntries([
      ...paymentEntries,
      { method: language === "ar" ? "نقداً" : "Cash", amount: 0 },
    ]);
  };

  const removePaymentEntry = (index: number) => {
    // Re-enable removing payment entries
    if (paymentEntries.length > 1) {
      const newEntries = [...paymentEntries];
      newEntries.splice(index, 1);
      setPaymentEntries(newEntries);
    }
  };

  const updatePaymentEntry = (
    index: number,
    field: string,
    value: string | number
  ) => {
    const newEntries = [...paymentEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setPaymentEntries(newEntries);
  };

  const calculateTotalPayment = () => {
    return paymentEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  };

  const handleSubmitPayment = async (invoiceId: string) => {
    const invoice = invoices.find((inv) => inv.invoice_id === invoiceId);
    if (!invoice) {
      toast.error(
        language === "ar" ? "لم يتم العثور على الفاتورة" : "Invoice not found"
      );
      return;
    }

    // Store the current invoice data before processing payment
    // This ensures we have the full data including patient name
    const originalInvoice = { ...invoice };

    const totalPayment = calculateTotalPayment();
    if (totalPayment <= 0) {
      toast.error(
        language === "ar"
          ? "يرجى إدخال مبلغ الدفع"
          : "Please enter a payment amount"
      );
      return;
    }

    if (totalPayment > invoice.remaining) {
      toast.error(
        language === "ar"
          ? "المبلغ المدخل أكبر من المبلغ المتبقي"
          : "The entered amount is larger than the remaining amount"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Get valid payment entries
      const validPaymentEntries = paymentEntries.filter(
        (entry) => entry.amount > 0
      );

      if (validPaymentEntries.length === 0) {
        toast.error(
          language === "ar"
            ? "يرجى إدخال مبلغ الدفع"
            : "Please enter a payment amount"
        );
        setIsSubmitting(false);
        return;
      }

      // Log invoice before payment
      console.log("BEFORE PAYMENT - Invoice state:", {
        invoiceId,
        total: invoice.total,
        deposit: invoice.deposit,
        remaining: invoice.remaining,
        is_paid: invoice.is_paid,
      });

      // Process each payment entry directly using the SQL function
      let allSuccessful = true;
      const results = [];

      // Instead of using API calls, use our SQL function directly
      for (const entry of validPaymentEntries) {
        console.log("Processing payment entry:", entry);

        try {
          // Call our dedicated SQL function to add the payment
          const { data, error } = await supabase.rpc("add_payment_to_invoice", {
            p_invoice_id: invoiceId,
            p_payment_amount: entry.amount,
            p_payment_method: entry.method,
            p_auth_number: entry.authNumber || null,
          });

          if (error) {
            console.error("Error processing payment via SQL function:", error);
            allSuccessful = false;
          } else {
            console.log("SQL payment processing result:", data);
            results.push(data);
          }
        } catch (err) {
          console.error("Exception processing payment:", err);
          allSuccessful = false;
        }
      }

      if (allSuccessful) {
        toast.success(
          language === "ar"
            ? "تم تسجيل الدفع بنجاح"
            : "Payment recorded successfully"
        );

        // Verify the update by fetching the invoice again
        const updatedInvoiceData = await getInvoiceById(invoiceId);
        if (updatedInvoiceData) {
          console.log("AFTER PAYMENT - Updated invoice:", {
            invoice_id: updatedInvoiceData.invoice_id,
            deposit: updatedInvoiceData.deposit,
            total: updatedInvoiceData.total,
            remaining: updatedInvoiceData.remaining,
            is_paid: updatedInvoiceData.is_paid,
          });

          // Ensure date fields are valid
          const safeCreatedAt = updatedInvoiceData.created_at
            ? new Date(updatedInvoiceData.created_at).toISOString()
            : new Date().toISOString();

          // Construct updated invoice with complete data
          // Merge the original invoice data with updated values
          const updatedInvoice = {
            ...originalInvoice, // Keep all the original data first
            ...updatedInvoiceData, // Then override with new data
            id: updatedInvoiceData.id || originalInvoice.id || "",
            invoice_id: updatedInvoiceData.invoice_id || invoiceId,
            patient_name:
              updatedInvoiceData.patient_name ||
              originalInvoice.patient_name ||
              "",
            patient_phone:
              updatedInvoiceData.patient_phone || originalInvoice.patient_phone,
            deposit:
              Number(updatedInvoiceData.deposit) ||
              Number(originalInvoice.deposit) ||
              0,
            total:
              Number(updatedInvoiceData.total) ||
              Number(originalInvoice.total) ||
              0,
            remaining: Number(updatedInvoiceData.remaining) || 0,
            is_paid: Boolean(updatedInvoiceData.is_paid),
            created_at: safeCreatedAt,
            // Preserve original invoice data that might not be in the updated data
            invoice_type:
              updatedInvoiceData.invoice_type ||
              originalInvoice.invoice_type ||
              "glasses",
            lens_type:
              updatedInvoiceData.lens_type || originalInvoice.lens_type,
            lens_price:
              Number(updatedInvoiceData.lens_price) ||
              Number(originalInvoice.lens_price) ||
              0,
            coating: updatedInvoiceData.coating || originalInvoice.coating,
            coating_price:
              Number(updatedInvoiceData.coating_price) ||
              Number(originalInvoice.coating_price) ||
              0,
            coating_color:
              updatedInvoiceData.coating_color || originalInvoice.coating_color,
            thickness:
              updatedInvoiceData.thickness || originalInvoice.thickness,
            thickness_price:
              Number(updatedInvoiceData.thickness_price) ||
              Number(originalInvoice.thickness_price) ||
              0,
            frame_brand:
              updatedInvoiceData.frame_brand || originalInvoice.frame_brand,
            frame_model:
              updatedInvoiceData.frame_model || originalInvoice.frame_model,
            frame_color:
              updatedInvoiceData.frame_color || originalInvoice.frame_color,
            frame_size:
              updatedInvoiceData.frame_size || originalInvoice.frame_size,
            frame_price:
              Number(updatedInvoiceData.frame_price) ||
              Number(originalInvoice.frame_price) ||
              0,
            // Ensure payments have valid dates and combine existing payments with new ones
            payments: [
              ...(originalInvoice.payments || []),
              // Add the new payment(s)
              ...paymentEntries
                .filter((entry) => entry.amount > 0)
                .map((entry) => ({
                  method: entry.method,
                  amount: entry.amount,
                  date: new Date().toISOString(),
                  auth_number: entry.authNumber,
                })),
            ],
          } as Invoice;

          console.log("Complete updated invoice for receipt:", updatedInvoice);

          // Save the updated invoice for printing, even if it's fully paid
          setInvoiceDataForPrint(updatedInvoice);
          setLastPaidInvoice(updatedInvoice);

          // Close the payment dialog and open the receipt view
          setSelectedInvoice(null);
          // Show the receipt modal after payment
          setShowReceipt(invoiceId);
        }

        // Reset payment entries
        setPaymentEntries([
          { method: language === "ar" ? "نقداً" : "Cash", amount: 0 },
        ]);

        // Refresh the list of unpaid invoices
        await loadUnpaidInvoices();
      } else {
        throw new Error("Failed to process one or more payments");
      }
    } catch (error) {
      console.error("Error submitting payment:", error);
      toast.error(
        language === "ar"
          ? "حدث خطأ أثناء تسجيل الدفع"
          : "Error occurred while recording payment"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = (invoiceId: string) => {
    // First check if we're trying to print the last paid invoice
    if (lastPaidInvoice && lastPaidInvoice.invoice_id === invoiceId) {
      // Use the lastPaidInvoice data directly
      console.log("Printing last paid invoice:", lastPaidInvoice);
      const adaptedInvoice = adaptInvoiceForPrint(lastPaidInvoice);
      CustomPrintService.printInvoice(adaptedInvoice);
      return;
    }

    // Otherwise, try to find in the regular invoices list
    const currentInvoice = invoices.find((inv) => inv.invoice_id === invoiceId);
    if (!currentInvoice) {
      console.error(`Invoice not found for printing: ${invoiceId}`);
      toast.error(
        language === "ar" ? "لم يتم العثور على الفاتورة" : "Invoice not found"
      );
      return;
    }

    // Convert our invoice to the format expected by CustomPrintService
    const adaptedInvoice = adaptInvoiceForPrint(currentInvoice);
    CustomPrintService.printInvoice(adaptedInvoice);
    setInvoiceDataForPrint(null);
  };

  const dirClass = language === "ar" ? "rtl" : "ltr";
  const textAlignClass = language === "ar" ? "text-right" : "text-left";

  /**
   * Convert our local Invoice interface to the format expected by ReceiptInvoice component
   */
  const adaptInvoiceForPrint = (invoice: Invoice): any => {
    // Ensure all dates are valid
    const ensureValidDate = (dateStr: string | undefined) => {
      if (!dateStr) return new Date().toISOString();
      try {
        // Test if the date is valid
        const testDate = new Date(dateStr);
        if (isNaN(testDate.getTime())) {
          return new Date().toISOString();
        }
        return dateStr;
      } catch (e) {
        return new Date().toISOString();
      }
    };

    // Calculate remaining amount based on total and all payments
    const totalPaid =
      invoice.payments?.reduce(
        (sum, payment) => sum + (payment.amount || 0),
        0
      ) ||
      invoice.deposit ||
      0;

    // Calculate if invoice is actually paid in full
    const actualRemaining = Math.max(0, invoice.total - totalPaid);
    const actualIsPaid = actualRemaining <= 0;

    return {
      // Map fields to expected format
      invoiceId: invoice.invoice_id,
      workOrderId: invoice.work_order_id,
      patientId: invoice.patient_id,
      patientName: invoice.patient_name,
      patientPhone: invoice.patient_phone,

      invoiceType: invoice.invoice_type,
      lensType: invoice.lens_type,
      lensPrice: invoice.lens_price,
      coating: invoice.coating,
      coatingPrice: invoice.coating_price,
      coatingColor: invoice.coating_color,
      thickness: invoice.thickness,
      thicknessPrice: invoice.thickness_price,

      frameBrand: invoice.frame_brand,
      frameModel: invoice.frame_model,
      frameColor: invoice.frame_color,
      frameSize: invoice.frame_size,
      framePrice: invoice.frame_price,

      contactLensItems: invoice.contact_lens_items,
      contactLensRx: invoice.contact_lens_rx,

      serviceName: invoice.service_name,
      servicePrice: invoice.service_price,

      discount: invoice.discount,
      deposit: totalPaid, // Use calculated total paid
      total: invoice.total,
      remaining: actualRemaining, // Use calculated remaining amount

      paymentMethod: invoice.payment_method,
      authNumber: invoice.auth_number,
      isPaid: actualIsPaid, // Use calculated paid status
      isRefunded: invoice.is_refunded,
      refundAmount: invoice.refund_amount,
      refundDate: ensureValidDate(invoice.refund_date),
      refundMethod: invoice.refund_method,
      refundReason: invoice.refund_reason,

      createdAt: ensureValidDate(invoice.created_at),
      payments:
        invoice.payments?.map((payment) => ({
          ...payment,
          date: ensureValidDate(payment.date),
        })) || [],
    };
  };

  return (
    <div className={`space-y-6 py-4 ${dirClass}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${textAlignClass}`}>
            {t("remainingPayments")}
          </h2>
          <p className={`text-muted-foreground ${textAlignClass}`}>
            {t("duePayments")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search
              className={`absolute ${
                language === "ar" ? "left-2.5" : "right-2.5"
              } top-2.5 h-4 w-4 text-muted-foreground`}
            />
            <Input
              placeholder={
                language === "ar"
                  ? "البحث عن عميل أو رقم فاتورة..."
                  : "Search for client or invoice number..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={language === "ar" ? "pl-8 w-full" : "pr-8 w-full"}
            />
          </div>

          <Select
            value={sortOrder}
            onValueChange={(value) => setSortOrder(value as "asc" | "desc")}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue
                placeholder={language === "ar" ? "ترتيب حسب" : "Sort by"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">
                {language === "ar" ? "الأحدث أولاً" : "Newest first"}
              </SelectItem>
              <SelectItem value="asc">
                {language === "ar" ? "الأقدم أولاً" : "Oldest first"}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">
            {language === "ar" ? "جارٍ التحميل..." : "Loading..."}
          </span>
        </div>
      ) : filteredInvoices.length === 0 && !lastPaidInvoice ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-muted mb-4" />
            <h3 className="text-xl font-medium mb-2">
              {language === "ar"
                ? "جميع الفواتير مدفوعة بالكامل"
                : "All invoices fully paid"}
            </h3>
            <p className="text-muted-foreground text-center max-w-md">
              {language === "ar"
                ? "لا توجد فواتير تحتاج إلى دفعات متبقية. جميع المعاملات مكتملة."
                : "No invoices require remaining payments. All transactions are complete."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInvoices.map((invoice) => (
            <Card
              key={invoice.invoice_id}
              className="overflow-hidden border border-amber-200 hover:border-amber-300 transition-all duration-200"
            >
              <CardHeader className="bg-gradient-to-r from-amber-50 to-amber-100 py-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-bold">
                      {invoice.patient_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {invoice.invoice_id}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-amber-100 text-amber-800 border-amber-300 text-xl font-bold px-4 py-1.5"
                  >
                    {language === "ar" ? "متبقي" : "Remaining"}{" "}
                    {invoice.remaining.toFixed(2)} {t("kwd")}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                <div className="flex justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{invoice.patient_phone}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {new Date(invoice.created_at).toLocaleDateString(
                        language === "ar" ? "ar-EG" : "en-US"
                      )}
                    </span>
                  </div>
                </div>

                <Accordion
                  type="single"
                  collapsible
                  className="w-full border rounded-md"
                >
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="px-3 text-sm font-medium">
                      {language === "ar" ? "تفاصيل النظارة" : "Glasses Details"}
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 text-sm">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <EyeIcon className="h-3.5 w-3.5 text-blue-500" />
                          <span>
                            {language === "ar" ? "نوع العدسة:" : "Lens Type:"}
                          </span>
                          <span className="font-medium">
                            {invoice.lens_type}
                          </span>
                        </div>

                        {invoice.frame_brand && (
                          <div className="flex items-center gap-1.5">
                            <Frame className="h-3.5 w-3.5 text-gray-500" />
                            <span>
                              {language === "ar" ? "الإطار:" : "Frame:"}
                            </span>
                            <span className="font-medium">
                              {invoice.frame_brand} / {invoice.frame_model}
                            </span>
                          </div>
                        )}

                        {invoice.coating && (
                          <div className="flex items-center gap-1.5">
                            <Droplets className="h-3.5 w-3.5 text-cyan-500" />
                            <span>
                              {language === "ar" ? "الطلاء:" : "Coating:"}
                            </span>
                            <span className="font-medium">
                              {invoice.coating}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-emerald-600">
                          <Tag className="h-3.5 w-3.5" />
                          <span>
                            {language === "ar"
                              ? "السعر الإجمالي:"
                              : "Total Price:"}
                          </span>
                          <span className="font-medium">
                            {invoice.total.toFixed(2)} {t("kwd")}
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="border-t border-dashed pt-3">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {language === "ar"
                          ? "إجمالي الفاتورة"
                          : "Invoice Total"}
                      </p>
                      <p className="font-bold text-lg">
                        {invoice.total.toFixed(2)} {t("kwd")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {language === "ar" ? "المدفوع" : "Paid"}
                      </p>
                      <p className="text-blue-600 font-medium">
                        {invoice.deposit.toFixed(2)} {t("kwd")}
                      </p>
                    </div>
                  </div>

                  {invoice.payments && invoice.payments.length > 0 && (
                    <div className="mt-2 bg-slate-50 p-2 rounded-md text-xs">
                      <p className="font-medium mb-1">
                        {language === "ar"
                          ? "سجل الدفعات:"
                          : "Payment History:"}
                      </p>
                      {invoice.payments.map((payment, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center"
                        >
                          <span>
                            {new Date(payment.date).toLocaleDateString(
                              language === "ar" ? "ar-EG" : "en-US"
                            )}
                          </span>
                          <span className="font-medium">
                            {payment.amount !== undefined &&
                            payment.amount !== null
                              ? payment.amount.toFixed(2)
                              : "0.00"}{" "}
                            {t("kwd")} ({payment.method})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Dialog
                    open={showReceipt === invoice.invoice_id}
                    onOpenChange={(open) => !open && setShowReceipt(null)}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 text-xs border-blue-200 hover:bg-blue-50 text-blue-700"
                        onClick={() => setShowReceipt(invoice.invoice_id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {language === "ar" ? "عرض الفاتورة" : "View Invoice"}
                      </Button>
                    </DialogTrigger>

                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>
                          {showReceipt && selectedInvoice !== showReceipt ? (
                            <div className="flex flex-col items-center text-green-600 mb-2">
                              <CheckCircle2 className="h-6 w-6 mb-1" />
                              {language === "ar"
                                ? "تم تسجيل الدفع بنجاح"
                                : "Payment Successfully Recorded"}
                            </div>
                          ) : null}
                          {language === "ar" ? "فاتورة" : "Invoice"}{" "}
                          {invoice.invoice_id}
                        </DialogTitle>
                      </DialogHeader>

                      <div
                        className="max-h-[70vh] overflow-y-auto py-4"
                        id={`print-receipt-${invoice.invoice_id}`}
                      >
                        <ReceiptInvoice
                          invoice={adaptInvoiceForPrint(invoice)}
                          isPrintable={false}
                        />
                      </div>

                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowReceipt(null)}
                        >
                          {language === "ar" ? "إغلاق" : "Close"}
                        </Button>
                        <PrintReportButton
                          onPrint={() => {
                            setShowReceipt(null);
                            handlePrintReceipt(invoice.invoice_id);
                          }}
                          label={
                            language === "ar"
                              ? "طباعة الفاتورة"
                              : "Print Invoice"
                          }
                        />
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="outline"
                    className="flex-1 text-xs border-purple-200 hover:bg-purple-50 text-purple-700"
                    onClick={() =>
                      goToPatientProfile(
                        invoice.patient_id,
                        invoice.patient_name,
                        invoice.patient_phone
                      )
                    }
                  >
                    <UserCircle className="h-4 w-4 mr-1" />
                    {language === "ar" ? "ملف العميل" : "Client File"}
                  </Button>

                  <Dialog
                    open={selectedInvoice === invoice.invoice_id}
                    onOpenChange={(open) => !open && setSelectedInvoice(null)}
                  >
                    <DialogTrigger asChild>
                      <Button
                        className="flex-1 text-xs bg-amber-500 hover:bg-amber-600"
                        onClick={() => {
                          setSelectedInvoice(invoice.invoice_id);
                          // Initialize with just one payment entry with the remaining amount
                          setPaymentEntries([
                            {
                              method: language === "ar" ? "نقداً" : "Cash",
                              amount: invoice.remaining,
                            },
                          ]);
                          setRemainingAfterPayment(0);
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {language === "ar" ? "تسديد الدفعة" : "Make Payment"}
                      </Button>
                    </DialogTrigger>

                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>
                          {language === "ar"
                            ? "تسجيل دفعة جديدة"
                            : "Record New Payment"}
                        </DialogTitle>
                        <DialogDescription>
                          {language === "ar"
                            ? "تسجيل دفعة للفاتورة"
                            : "Record payment for invoice."}{" "}
                          {invoice.invoice_id}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="py-4 space-y-4">
                        <div className="bg-muted p-4 rounded-md space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">
                              {language === "ar"
                                ? "المبلغ الإجمالي:"
                                : "Total Amount:"}
                            </span>
                            <span className="font-medium">
                              {invoice.total.toFixed(2)} {t("kwd")}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">
                              {language === "ar"
                                ? "المدفوع سابقاً:"
                                : "Previously Paid:"}
                            </span>
                            <span className="font-medium text-blue-600">
                              {invoice.deposit.toFixed(2)} {t("kwd")}
                            </span>
                          </div>
                          <div className="flex justify-between font-bold border-t pt-2 mt-2">
                            <span>
                              {language === "ar"
                                ? "المبلغ المتبقي:"
                                : "Remaining Amount:"}
                            </span>
                            <span className="text-amber-600 text-lg">
                              {invoice.remaining.toFixed(2)} {t("kwd")}
                            </span>
                          </div>

                          {remainingAfterPayment !== null && (
                            <div className="flex justify-between font-bold mt-3 bg-blue-50 p-2 rounded-md">
                              <span className="text-blue-700">
                                {language === "ar"
                                  ? "المتبقي بعد الدفع:"
                                  : "Remaining After Payment:"}
                              </span>
                              <span className="text-blue-700 text-lg">
                                {remainingAfterPayment !== null &&
                                remainingAfterPayment !== undefined
                                  ? remainingAfterPayment.toFixed(2)
                                  : "0.00"}{" "}
                                {t("kwd")}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium">
                              {language === "ar"
                                ? "طرق الدفع"
                                : "Payment Methods"}
                            </h4>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={addPaymentEntry}
                              className="h-8"
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />{" "}
                              {language === "ar"
                                ? "إضافة طريقة دفع"
                                : "Add Payment Method"}
                            </Button>
                          </div>

                          {paymentEntries.map((entry, index) => (
                            <div
                              key={index}
                              className="space-y-3 bg-slate-50 p-3 rounded-md"
                            >
                              <div className="flex justify-between items-center">
                                <Label className="font-medium">
                                  {language === "ar"
                                    ? "طريقة الدفع"
                                    : "Payment Method"}{" "}
                                  #{index + 1}
                                </Label>
                                {paymentEntries.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                    onClick={() => removePaymentEntry(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label htmlFor={`payment-method-${index}`}>
                                    {language === "ar"
                                      ? "طريقة الدفع"
                                      : "Payment Method"}
                                  </Label>
                                  <Select
                                    value={entry.method}
                                    onValueChange={(value) =>
                                      updatePaymentEntry(index, "method", value)
                                    }
                                  >
                                    <SelectTrigger
                                      id={`payment-method-${index}`}
                                    >
                                      <SelectValue
                                        placeholder={
                                          language === "ar"
                                            ? "اختر طريقة الدفع"
                                            : "Select payment method"
                                        }
                                      />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem
                                        value={
                                          language === "ar" ? "نقداً" : "Cash"
                                        }
                                      >
                                        {language === "ar" ? "نقداً" : "Cash"}
                                      </SelectItem>
                                      <SelectItem
                                        value={
                                          language === "ar" ? "كي نت" : "KNET"
                                        }
                                      >
                                        {language === "ar" ? "كي نت" : "KNET"}
                                      </SelectItem>
                                      <SelectItem value="Visa">Visa</SelectItem>
                                      <SelectItem value="MasterCard">
                                        MasterCard
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1.5">
                                  <Label htmlFor={`payment-amount-${index}`}>
                                    {language === "ar"
                                      ? "المبلغ (د.ك)"
                                      : "Amount (KWD)"}
                                  </Label>
                                  <Input
                                    id={`payment-amount-${index}`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={invoice.remaining}
                                    value={entry.amount || ""}
                                    onChange={(e) =>
                                      updatePaymentEntry(
                                        index,
                                        "amount",
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                  />
                                </div>
                              </div>

                              {(entry.method ===
                                (language === "ar" ? "كي نت" : "KNET") ||
                                entry.method === "Visa" ||
                                entry.method === "MasterCard") && (
                                <div className="space-y-1.5">
                                  <Label htmlFor={`auth-number-${index}`}>
                                    {language === "ar"
                                      ? "رقم التفويض"
                                      : "Authorization Number"}
                                  </Label>
                                  <Input
                                    id={`auth-number-${index}`}
                                    placeholder={
                                      language === "ar"
                                        ? "رقم التفويض"
                                        : "Authorization number"
                                    }
                                    value={entry.authNumber || ""}
                                    onChange={(e) =>
                                      updatePaymentEntry(
                                        index,
                                        "authNumber",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          ))}

                          <div className="flex justify-between font-medium p-2 border-t">
                            <span>
                              {language === "ar"
                                ? "إجمالي المدفوع:"
                                : "Total Payment :"}
                            </span>
                            <span>
                              {calculateTotalPayment().toFixed(2)} {t("kwd")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setSelectedInvoice(null)}
                        >
                          {language === "ar" ? "إلغاء" : "Cancel"}
                        </Button>
                        <Button
                          onClick={() =>
                            handleSubmitPayment(invoice.invoice_id)
                          }
                          className="bg-amber-500 hover:bg-amber-600"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {language === "ar"
                                ? "جاري التحديث..."
                                : "Updating..."}
                            </>
                          ) : language === "ar" ? (
                            "تأكيد الدفع"
                          ) : (
                            "Confirm Payment"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Show the last paid invoice if available and not in the filtered list */}
          {lastPaidInvoice &&
            !filteredInvoices.some(
              (inv) => inv.invoice_id === lastPaidInvoice.invoice_id
            ) && (
              <Dialog
                open={showReceipt === lastPaidInvoice.invoice_id}
                onOpenChange={(open) => {
                  if (!open) {
                    setShowReceipt(null);
                    // Don't clear lastPaidInvoice when closing dialog
                    // to allow printing afterward
                  }
                }}
              >
                {/* We need a hidden trigger to keep the dialog structure valid */}
                <DialogTrigger className="hidden" />
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>
                      <div className="flex flex-col items-center text-green-600 mb-2">
                        <CheckCircle2 className="h-6 w-6 mb-1" />
                        {language === "ar"
                          ? "تم تسجيل الدفع بنجاح"
                          : "Payment Successfully Recorded"}
                      </div>
                      {language === "ar" ? "فاتورة" : "Invoice"}{" "}
                      {lastPaidInvoice.invoice_id}
                    </DialogTitle>
                  </DialogHeader>

                  <div
                    className="max-h-[70vh] overflow-y-auto py-4"
                    id={`print-receipt-${lastPaidInvoice.invoice_id}`}
                  >
                    <ReceiptInvoice
                      invoice={adaptInvoiceForPrint(lastPaidInvoice)}
                      isPrintable={false}
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowReceipt(null);
                        // Don't clear lastPaidInvoice when closing dialog
                      }}
                    >
                      {language === "ar" ? "إغلاق" : "Close"}
                    </Button>
                    <PrintReportButton
                      onPrint={() => {
                        setShowReceipt(null);
                        handlePrintReceipt(lastPaidInvoice.invoice_id);
                        // Only clear lastPaidInvoice after successful printing
                      }}
                      label={
                        language === "ar" ? "طباعة الفاتورة" : "Print Invoice"
                      }
                    />
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
        </div>
      )}
    </div>
  );
};
