// @ts-nocheck - TypeScript definitions for Supabase results are incomplete

import React, { useState, useEffect } from "react";
import { Payment } from "@/store/invoiceStore";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Receipt,
  Wallet,
  CreditCard,
  CheckCircle2,
  User,
  Phone,
  Calendar,
  Eye,
  Frame,
  Droplets,
  Tag,
  Search,
  Plus,
  Trash2,
  Eye as EyeIcon,
  UserCircle,
  Loader2,
  Banknote,
  ChevronDown,
  Clock,
  AlertTriangle,
  Wallet2,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  PatientProfileDialog,
  PatientProfileDialogHandle,
} from "@/components/PatientProfileDialog";

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

/** Returns the age of an invoice in whole days. */
const getInvoiceAgeInDays = (createdAt: string): number => {
  try {
    const created = new Date(createdAt).getTime();
    if (isNaN(created)) return 0;
    const diff = Date.now() - created;
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
};

/** Small pill icon picker for each payment method. */
const PaymentMethodIcon: React.FC<{ method: string }> = ({ method }) => {
  const m = (method || "").toLowerCase();
  if (m.includes("cash") || method === "نقداً") {
    return <Banknote className="h-3.5 w-3.5 text-emerald-600" />;
  }
  if (m.includes("knet") || method === "كي نت") {
    return <Wallet2 className="h-3.5 w-3.5 text-sky-600" />;
  }
  return <CreditCard className="h-3.5 w-3.5 text-indigo-600" />;
};

export const RemainingPayments: React.FC = () => {
  const { language, t } = useLanguageStore();
  const isRtl = language === "ar";
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

  // Delete dialog state — lets the manager either refund the whole invoice
  // (reverses the deposit out of revenue) or write off just the remaining
  // balance (keeps the deposit as income, marks invoice as fully paid).
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleteMode, setDeleteMode] = useState<"full" | "remaining" | null>(
    null
  );
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit dialog state — admin-password gated; lets staff correct the
  // Total / Paid (deposit) on an invoice. Remaining and is_paid are
  // recomputed automatically. All downstream consumers (Reports, profile,
  // transactions list) read these fields directly from Supabase, so the
  // change propagates everywhere as soon as we re-fetch.
  const [editTarget, setEditTarget] = useState<Invoice | null>(null);
  const [editTotal, setEditTotal] = useState("");
  const [editDeposit, setEditDeposit] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const resetEditDialog = () => {
    setEditTarget(null);
    setEditTotal("");
    setEditDeposit("");
    setEditPassword("");
    setEditError("");
    setIsSavingEdit(false);
  };

  const handleConfirmEdit = async () => {
    if (!editTarget) return;
    const expected = import.meta.env.VITE_ADMIN_PASSWORD || "";
    if (!expected || editPassword !== expected) {
      setEditError(
        language === "ar"
          ? "كلمة مرور المدير غير صحيحة. يُرجى طلبها من المدير."
          : "Incorrect admin password. Ask your manager."
      );
      return;
    }
    const newTotal = Number(editTotal);
    const newDeposit = Number(editDeposit);
    if (
      !Number.isFinite(newTotal) ||
      !Number.isFinite(newDeposit) ||
      newTotal < 0 ||
      newDeposit < 0
    ) {
      setEditError(
        language === "ar"
          ? "الرجاء إدخال أرقام صحيحة."
          : "Please enter valid numbers."
      );
      return;
    }
    if (newDeposit > newTotal) {
      setEditError(
        language === "ar"
          ? "المدفوع لا يمكن أن يكون أكبر من الإجمالي."
          : "Paid amount cannot exceed total."
      );
      return;
    }
    const newRemaining = Math.max(0, newTotal - newDeposit);
    const isPaid = newRemaining === 0;
    setIsSavingEdit(true);
    try {
      // @ts-ignore — invoices table not in generated types
      const { error } = await supabase
        .from("invoices")
        .update({
          total: newTotal,
          deposit: newDeposit,
          remaining: newRemaining,
          is_paid: isPaid,
        })
        .eq("invoice_id", editTarget.invoice_id);
      if (error) throw error;
      toast.success(
        language === "ar"
          ? "تم تحديث الفاتورة"
          : "Invoice updated"
      );
      resetEditDialog();
      await loadUnpaidInvoices();
    } catch (e) {
      console.error("Edit invoice failed:", e);
      toast.error(
        language === "ar"
          ? "حدث خطأ أثناء تحديث الفاتورة"
          : "Error updating invoice"
      );
      setIsSavingEdit(false);
    }
  };

  const resetDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteMode(null);
    setDeletePassword("");
    setDeleteError("");
    setIsDeleting(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !deleteMode) return;
    const expected = import.meta.env.VITE_ADMIN_PASSWORD || "";
    if (!expected || deletePassword !== expected) {
      setDeleteError(
        language === "ar"
          ? "كلمة مرور المدير غير صحيحة. يُرجى طلبها من المدير."
          : "Incorrect admin password. Ask your manager."
      );
      return;
    }
    setIsDeleting(true);
    try {
      if (deleteMode === "full") {
        // Archive the invoice. If there was a real deposit collected, also
        // stamp it as a refund so reports subtract it from today's revenue.
        // If deposit is 0 (invoice created but never paid), skip the refund
        // flags entirely — nothing to refund, no need to pollute the refund
        // list with a 0.00 KWD ghost record.
        const depositAmount = Number(deleteTarget.deposit) || 0;
        const isRealRefund = depositAmount > 0;
        // @ts-ignore
        const { error } = await supabase
          .from("invoices")
          .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
            is_paid: true,
            remaining: 0,
            ...(isRealRefund
              ? {
                  is_refunded: true,
                  refund_amount: depositAmount,
                  refund_date: new Date().toISOString(),
                  refund_method: deleteTarget.payment_method || "Cash",
                  refund_id: `RF${Date.now()}`,
                }
              : {}),
          })
          .eq("invoice_id", deleteTarget.invoice_id);
        if (error) throw error;
        toast.success(
          language === "ar"
            ? isRealRefund
              ? "تم حذف الفاتورة وإرجاع الدفعة"
              : "تم حذف الفاتورة"
            : isRealRefund
            ? "Invoice deleted, deposit refunded"
            : "Invoice deleted"
        );
      } else {
        // Write-off: keep deposit as collected revenue, force remaining to
        // zero, flip to paid. Original `total` is preserved for audit, but
        // since `remaining = 0` the invoice no longer shows up on this
        // Remaining Payments page.
        // @ts-ignore
        const { error } = await supabase
          .from("invoices")
          .update({
            remaining: 0,
            is_paid: true,
          })
          .eq("invoice_id", deleteTarget.invoice_id);
        if (error) throw error;
        toast.success(
          language === "ar"
            ? "تم إعفاء المتبقي. تم الاحتفاظ بالدفعة."
            : "Remaining balance written off. Deposit kept."
        );
      }
      resetDeleteDialog();
      await loadUnpaidInvoices();
    } catch (e) {
      console.error("Delete invoice failed:", e);
      toast.error(
        language === "ar" ? "حدث خطأ أثناء الحذف" : "Error while deleting"
      );
      setIsDeleting(false);
    }
  };

  // Imperative handle to the shared profile dialog — clicking "Client File"
  // now opens the same in-place profile dialog we use on the Reports page,
  // instead of navigating to the Patient Search section.
  const profileDialogRef = React.useRef<PatientProfileDialogHandle>(null);

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

  /** Total across all outstanding invoices — shown in the header summary chip. */
  const totalOutstanding = invoices.reduce(
    (sum, inv) => sum + (inv.remaining || 0),
    0
  );

  const goToPatientProfile = (
    patientId?: string,
    patientName?: string,
    patientPhone?: string
  ) => {
    // Open the same in-place profile dialog the Reports page uses.
    if (patientId) {
      profileDialogRef.current?.openProfile(patientId);
      return;
    }
    // No patient_id on the invoice — fall back to the old navigation
    // behavior so staff can still find the customer via search.
    if (patientName || patientPhone) {
      toast.info(
        language === "ar"
          ? "لا يوجد رقم عميل مرتبط بهذه الفاتورة — سيتم فتح البحث"
          : "No customer ID linked to this invoice — opening search"
      );
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

    // If we have a specific remainingAfterPayment value, use it instead
    const finalRemaining =
      remainingAfterPayment !== null ? remainingAfterPayment : actualRemaining;

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
      remaining: finalRemaining, // Use remainingAfterPayment if available

      paymentMethod: invoice.payment_method,
      authNumber: invoice.auth_number,
      isPaid: finalRemaining <= 0, // Update isPaid based on final remaining amount
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

  const invoiceCount = filteredInvoices.length;
  const hasAny = invoiceCount > 0;

  return (
    <div className={`min-h-full bg-stone-50 ${dirClass}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className={textAlignClass}>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <Wallet className="h-4 w-4 text-amber-600" />
              <span className="font-medium">{t("remainingPayments")}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
              {t("duePayments")}
            </h2>
            {/* Summary chip — total owed across all invoices */}
            {!isLoading && invoices.length > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5">
                <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                  {t("totalOwed")}
                </span>
                <span className="text-sm font-bold text-amber-900 tabular-nums">
                  {totalOutstanding.toFixed(2)} {t("kwd")}
                </span>
                <span className="text-xs text-amber-700">
                  ·{" "}
                  {invoices.length}{" "}
                  {invoices.length === 1
                    ? t("invoiceOutstanding")
                    : t("invoicesOutstanding")}
                </span>
              </div>
            )}
          </div>

          {/* Search and sort controls */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-80">
              <Search
                className={`absolute ${
                  language === "ar" ? "right-4" : "left-4"
                } top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none`}
              />
              <Input
                placeholder={t("searchClientOrInvoice")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`h-12 w-full bg-white border-slate-200 rounded-xl text-base shadow-sm focus-visible:ring-slate-300 focus-visible:border-slate-300 ${
                  language === "ar" ? "pe-12 ps-4" : "ps-12 pe-4"
                }`}
              />
            </div>

            <Select
              value={sortOrder}
              onValueChange={(value) => setSortOrder(value as "asc" | "desc")}
            >
              <SelectTrigger className="h-12 w-full sm:w-44 bg-white border-slate-200 rounded-xl text-base shadow-sm">
                <SelectValue placeholder={t("sortBy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">{t("newestFirst")}</SelectItem>
                <SelectItem value="asc">{t("oldestFirst")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content area */}
        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            <span className="ms-3 text-lg text-slate-500">
              {t("loading")}...
            </span>
          </div>
        ) : !hasAny && !lastPaidInvoice ? (
          /* Empty state — warm, friendly */
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <h3 className="text-xl md:text-2xl font-semibold text-slate-900 mb-2">
              {t("allPaymentsCollected")}
            </h3>
            <p className="text-slate-500 max-w-md leading-relaxed">
              {t("noOutstandingBalances")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            {filteredInvoices.map((invoice) => {
              const ageDays = getInvoiceAgeInDays(invoice.created_at);
              const isOverdue = ageDays >= 14;
              const paidPct =
                invoice.total > 0
                  ? Math.min(
                      100,
                      Math.max(0, (invoice.deposit / invoice.total) * 100)
                    )
                  : 0;

              return (
                <div
                  key={invoice.invoice_id}
                  className={`group bg-white rounded-2xl shadow-sm border transition-all duration-200 hover:shadow-md flex flex-col ${
                    isOverdue
                      ? "border-amber-300 ring-1 ring-amber-100"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Card header — name + hero remaining amount */}
                  <div className="p-5 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-slate-900 leading-tight truncate">
                          {invoice.patient_name}
                        </h3>
                        <p className="text-sm text-slate-500 tabular-nums mt-0.5">
                          {invoice.invoice_id}
                        </p>
                      </div>

                      <div className="flex flex-col items-end shrink-0 text-end">
                        <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                          {t("remainingAmount")}
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-2xl font-bold text-amber-700 tabular-nums">
                            {invoice.remaining.toFixed(2)}
                          </span>
                          <span className="text-sm font-medium text-amber-600">
                            {t("kwd")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Meta row: phone, date, overdue flag */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                      {invoice.patient_phone && (
                        <div className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <span className="tabular-nums" dir="ltr">
                            {invoice.patient_phone}
                          </span>
                        </div>
                      )}
                      <div className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>
                          {new Date(invoice.created_at).toLocaleDateString(
                            language === "ar" ? "ar-EG" : "en-US"
                          )}
                        </span>
                      </div>
                      {isOverdue && (
                        <div className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-semibold">
                          <AlertTriangle className="h-3 w-3" />
                          <span>
                            {ageDays} {t("daysOld")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Body divider */}
                  <div className="border-t border-slate-100" />

                  {/* Totals breakdown + progress bar */}
                  <div className="px-5 py-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">
                          {t("invoiceTotal")}
                        </p>
                        <p className="text-base font-semibold text-slate-900 tabular-nums mt-0.5">
                          {invoice.total.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wide">
                          {t("paidSoFar")}
                        </p>
                        <p className="text-base font-semibold text-emerald-700 tabular-nums mt-0.5">
                          {invoice.deposit.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-amber-700 font-semibold uppercase tracking-wide">
                          {t("remainingAmount")}
                        </p>
                        <p className="text-base font-semibold text-amber-700 tabular-nums mt-0.5">
                          {invoice.remaining.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar: % paid */}
                    <div
                      className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={Math.round(paidPct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      {Math.round(paidPct)}% {t("paidSoFar").toLowerCase()}
                    </p>
                  </div>

                  {/* Collapsible: glasses details */}
                  <Collapsible className="border-t border-slate-100">
                    <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition group/collapse">
                      <div className="flex items-center gap-2">
                        <EyeIcon className="h-4 w-4 text-sky-600" />
                        <span>{t("glassesDetails")}</span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-data-[state=open]/collapse:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-5 pb-4 pt-1">
                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2 text-sm">
                        {invoice.lens_type && (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                              <EyeIcon className="h-3.5 w-3.5 text-sky-700" />
                            </div>
                            <span className="text-slate-500">
                              {t("lensTypeLabel")}:
                            </span>
                            <span className="font-medium text-slate-900 truncate">
                              {invoice.lens_type}
                            </span>
                          </div>
                        )}
                        {invoice.frame_brand && (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                              <Frame className="h-3.5 w-3.5 text-slate-600" />
                            </div>
                            <span className="text-slate-500">
                              {t("frameLabel")}:
                            </span>
                            <span className="font-medium text-slate-900 truncate">
                              {invoice.frame_brand}
                              {invoice.frame_model
                                ? ` / ${invoice.frame_model}`
                                : ""}
                            </span>
                          </div>
                        )}
                        {invoice.coating && (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-cyan-100 flex items-center justify-center shrink-0">
                              <Droplets className="h-3.5 w-3.5 text-cyan-700" />
                            </div>
                            <span className="text-slate-500">
                              {t("coatingLabel")}:
                            </span>
                            <span className="font-medium text-slate-900 truncate">
                              {invoice.coating}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-200 mt-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                            <Tag className="h-3.5 w-3.5 text-emerald-700" />
                          </div>
                          <span className="text-slate-500">
                            {t("invoiceTotal")}:
                          </span>
                          <span className="font-semibold text-emerald-700 tabular-nums">
                            {invoice.total.toFixed(2)} {t("kwd")}
                          </span>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Payment history — compact timeline */}
                  {invoice.payments && invoice.payments.length > 0 && (
                    <div className="border-t border-slate-100 px-5 py-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          {t("paymentHistory")}
                        </p>
                        <span className="ms-auto text-[11px] text-slate-400 tabular-nums">
                          {invoice.payments.length}
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {invoice.payments.map((payment, idx) => (
                          <li
                            key={idx}
                            className="flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                                <PaymentMethodIcon method={payment.method} />
                              </div>
                              <span className="text-slate-500 tabular-nums shrink-0">
                                {new Date(payment.date).toLocaleDateString(
                                  language === "ar" ? "ar-EG" : "en-US"
                                )}
                              </span>
                              <span className="text-slate-400 truncate">
                                · {payment.method}
                              </span>
                            </div>
                            <span className="font-semibold text-slate-900 tabular-nums shrink-0 ms-2">
                              {payment.amount !== undefined &&
                              payment.amount !== null
                                ? payment.amount.toFixed(2)
                                : "0.00"}{" "}
                              {t("kwd")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Spacer to push actions to the bottom */}
                  <div className="flex-1" />

                  {/* Action buttons */}
                  <div className="border-t border-slate-100 p-4">
                    {/* Primary CTA — Make Payment, full width */}
                    <Dialog
                      open={selectedInvoice === invoice.invoice_id}
                      onOpenChange={(open) =>
                        !open && setSelectedInvoice(null)
                      }
                    >
                      <DialogTrigger asChild>
                        <Button
                          className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl gap-2 shadow-sm"
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
                          <Wallet className="h-4 w-4" />
                          {t("makePayment")}
                        </Button>
                      </DialogTrigger>

                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>{t("recordNewPayment")}</DialogTitle>
                          <DialogDescription>
                            {t("recordPaymentFor")} {invoice.invoice_id}
                          </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-slate-500">
                                {t("totalAmount")}:
                              </span>
                              <span className="font-medium tabular-nums">
                                {invoice.total.toFixed(2)} {t("kwd")}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-slate-500">
                                {t("previouslyPaid")}:
                              </span>
                              <span className="font-medium text-emerald-700 tabular-nums">
                                {invoice.deposit.toFixed(2)} {t("kwd")}
                              </span>
                            </div>
                            <div className="flex justify-between font-bold border-t border-slate-200 pt-2 mt-2">
                              <span>{t("amountDue")}:</span>
                              <span className="text-amber-700 text-lg tabular-nums">
                                {invoice.remaining.toFixed(2)} {t("kwd")}
                              </span>
                            </div>

                            {remainingAfterPayment !== null && (
                              <div className="flex justify-between font-bold mt-3 bg-sky-50 border border-sky-100 p-2 rounded-lg">
                                <span className="text-sky-800">
                                  {t("remainingAfterPayment")}:
                                </span>
                                <span className="text-sky-800 text-lg tabular-nums">
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
                                {t("paymentMethods")}
                              </h4>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={addPaymentEntry}
                                className="h-8"
                              >
                                <Plus className="h-3.5 w-3.5 me-1" />{" "}
                                {t("addPaymentMethod")}
                              </Button>
                            </div>

                            {paymentEntries.map((entry, index) => (
                              <div
                                key={index}
                                className="space-y-3 bg-slate-50 border border-slate-200 p-3 rounded-xl"
                              >
                                <div className="flex justify-between items-center">
                                  <Label className="font-medium">
                                    {t("paymentMethod")} #{index + 1}
                                  </Label>
                                  {paymentEntries.length > 1 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                      onClick={() => removePaymentEntry(index)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <Label htmlFor={`payment-method-${index}`}>
                                      {t("paymentMethod")}
                                    </Label>
                                    <Select
                                      value={entry.method}
                                      onValueChange={(value) =>
                                        updatePaymentEntry(
                                          index,
                                          "method",
                                          value
                                        )
                                      }
                                    >
                                      <SelectTrigger
                                        id={`payment-method-${index}`}
                                      >
                                        <SelectValue
                                          placeholder={t("selectPaymentMethod")}
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
                                        <SelectItem value="Visa">
                                          Visa
                                        </SelectItem>
                                        <SelectItem value="MasterCard">
                                          MasterCard
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-1.5">
                                    <Label htmlFor={`payment-amount-${index}`}>
                                      {t("amount")} ({t("kwd")})
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
                                      {t("authorizationNumber")}
                                    </Label>
                                    <Input
                                      id={`auth-number-${index}`}
                                      placeholder={t("authorizationNumber")}
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

                            <div className="flex justify-between font-medium p-2 border-t border-slate-200">
                              <span>{t("totalPayment")}:</span>
                              <span className="tabular-nums">
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
                            {t("cancelAction")}
                          </Button>
                          <Button
                            onClick={() =>
                              handleSubmitPayment(invoice.invoice_id)
                            }
                            className="bg-slate-900 hover:bg-slate-800 text-white"
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                                {t("updating")}
                              </>
                            ) : (
                              t("confirmPayment")
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Secondary actions — View invoice / Client file / Edit / Delete */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                      <Dialog
                        open={showReceipt === invoice.invoice_id}
                        onOpenChange={(open) => !open && setShowReceipt(null)}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-10 text-xs border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg gap-1.5"
                            onClick={() => setShowReceipt(invoice.invoice_id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {t("viewInvoice")}
                          </Button>
                        </DialogTrigger>

                        <DialogContent className="max-w-sm">
                          <DialogHeader>
                            <DialogTitle>
                              {showReceipt && selectedInvoice !== showReceipt ? (
                                <div className="flex flex-col items-center text-emerald-600 mb-2">
                                  <CheckCircle2 className="h-6 w-6 mb-1" />
                                  {t("paymentSuccess")}
                                </div>
                              ) : null}
                              {t("invoice")} {invoice.invoice_id}
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
                              {t("close")}
                            </Button>
                            <PrintReportButton
                              onPrint={() => {
                                setShowReceipt(null);
                                handlePrintReceipt(invoice.invoice_id);
                              }}
                              label={t("printInvoice")}
                            />
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="outline"
                        className="h-10 text-xs border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg gap-1.5"
                        onClick={() =>
                          goToPatientProfile(
                            invoice.patient_id,
                            invoice.patient_name,
                            invoice.patient_phone
                          )
                        }
                      >
                        <UserCircle className="h-3.5 w-3.5" />
                        {t("clientFile")}
                      </Button>

                      <Button
                        variant="outline"
                        className="h-10 text-xs border-sky-200 bg-white hover:bg-sky-50 text-sky-700 font-medium rounded-lg gap-1.5"
                        onClick={() => {
                          setEditTarget(invoice);
                          setEditTotal(String(invoice.total ?? ""));
                          setEditDeposit(String(invoice.deposit ?? ""));
                          setEditPassword("");
                          setEditError("");
                        }}
                      >
                        <Tag className="h-3.5 w-3.5" />
                        {language === "ar" ? "تعديل" : "Edit"}
                      </Button>

                      <Button
                        variant="outline"
                        className="h-10 text-xs border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-medium rounded-lg gap-1.5"
                        onClick={() => {
                          setDeleteTarget(invoice);
                          setDeleteMode(null);
                          setDeletePassword("");
                          setDeleteError("");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {language === "ar" ? "حذف" : "Delete"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Show the last paid invoice dialog if available and not in the filtered list */}
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
                        <div className="flex flex-col items-center text-emerald-600 mb-2">
                          <CheckCircle2 className="h-6 w-6 mb-1" />
                          {t("paymentSuccess")}
                        </div>
                        {t("invoice")} {lastPaidInvoice.invoice_id}
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
                        {t("close")}
                      </Button>
                      <PrintReportButton
                        onPrint={() => {
                          setShowReceipt(null);
                          handlePrintReceipt(lastPaidInvoice.invoice_id);
                          // Only clear lastPaidInvoice after successful printing
                        }}
                        label={t("printInvoice")}
                      />
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
          </div>
        )}
      </div>

      {/* Delete invoice dialog — two-step: choose scope, then enter admin password.
          Scope #1: "Delete entire invoice" → archive + mark as refund so reports
          reverse the deposit. Scope #2: "Delete remaining only" → write-off,
          deposit stays as collected revenue, remaining flipped to 0/paid. */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) resetDeleteDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <Trash2 className="h-5 w-5" />
              {language === "ar" ? "حذف الفاتورة" : "Delete Invoice"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "هذه العملية لا يمكن التراجع عنها. اختر نوع الحذف، ثم أدخل كلمة مرور المدير."
                : "This action cannot be undone. Pick how to delete, then enter the admin password."}
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm space-y-1">
              <div className="font-semibold text-slate-900">
                {deleteTarget.patient_name}{" "}
                <span className="text-slate-500 font-mono text-xs">
                  #{deleteTarget.invoice_id}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 tabular-nums">
                <span>{language === "ar" ? "الإجمالي" : "Total"}</span>
                <span>{Number(deleteTarget.total).toFixed(2)} KWD</span>
              </div>
              <div className="flex justify-between text-xs text-emerald-700 tabular-nums">
                <span>{language === "ar" ? "المدفوع" : "Paid"}</span>
                <span>{Number(deleteTarget.deposit).toFixed(2)} KWD</span>
              </div>
              <div className="flex justify-between text-xs text-amber-700 tabular-nums font-semibold">
                <span>{language === "ar" ? "المتبقي" : "Remaining"}</span>
                <span>{Number(deleteTarget.remaining).toFixed(2)} KWD</span>
              </div>
            </div>
          )}

          {/* Step 1: pick scope */}
          {deleteMode === null && deleteTarget && (
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteMode("full")}
                className="w-full text-start border-2 border-slate-200 rounded-xl p-4 hover:border-rose-400 hover:bg-rose-50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:bg-rose-200">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900">
                      {language === "ar"
                        ? "حذف الفاتورة بالكامل"
                        : "Delete entire invoice"}
                    </div>
                    <div className="text-sm text-slate-500 mt-0.5">
                      {language === "ar"
                        ? `يُرجع ${Number(deleteTarget.deposit).toFixed(
                            2
                          )} د.ك كمسترد ويقلل إجمالي المبيعات`
                        : `Refunds ${Number(deleteTarget.deposit).toFixed(
                            2
                          )} KWD and reduces total sales`}
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDeleteMode("remaining")}
                className="w-full text-start border-2 border-slate-200 rounded-xl p-4 hover:border-amber-400 hover:bg-amber-50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:bg-amber-200">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900">
                      {language === "ar"
                        ? "حذف المتبقي فقط"
                        : "Delete remaining only"}
                    </div>
                    <div className="text-sm text-slate-500 mt-0.5">
                      {language === "ar"
                        ? `يحتفظ بـ ${Number(deleteTarget.deposit).toFixed(
                            2
                          )} د.ك المدفوعة ويُعفي ${Number(
                            deleteTarget.remaining
                          ).toFixed(2)} د.ك المتبقية`
                        : `Keeps ${Number(deleteTarget.deposit).toFixed(
                            2
                          )} KWD already paid, writes off ${Number(
                            deleteTarget.remaining
                          ).toFixed(2)} KWD remaining`}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Step 2: password */}
          {deleteMode !== null && (
            <div className="space-y-3 pt-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">
                  {language === "ar" ? "الإجراء المختار" : "Selected action"}
                </div>
                <div className="font-semibold text-slate-900">
                  {deleteMode === "full"
                    ? language === "ar"
                      ? "حذف الفاتورة بالكامل"
                      : "Delete entire invoice"
                    : language === "ar"
                    ? "حذف المتبقي فقط"
                    : "Delete remaining only"}
                </div>
                <button
                  type="button"
                  className="text-xs text-sky-700 hover:underline mt-1"
                  onClick={() => {
                    setDeleteMode(null);
                    setDeleteError("");
                  }}
                >
                  {language === "ar" ? "تغيير" : "Change"}
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-pw">
                  {language === "ar" ? "كلمة مرور المدير" : "Admin password"}
                </Label>
                <Input
                  id="delete-pw"
                  type="password"
                  autoFocus
                  autoComplete="off"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    if (deleteError) setDeleteError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isDeleting) handleConfirmDelete();
                  }}
                  placeholder={
                    language === "ar"
                      ? "اطلب كلمة المرور من المدير"
                      : "Ask your manager for the password"
                  }
                />
                {deleteError && (
                  <p className="text-sm text-rose-600 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {deleteError}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={resetDeleteDialog}
              disabled={isDeleting}
            >
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            {deleteMode !== null && (
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting || !deletePassword}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 me-1 animate-spin" />
                    {language === "ar" ? "جارٍ الحذف..." : "Deleting..."}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 me-1" />
                    {language === "ar" ? "حذف" : "Delete"}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* In-place customer profile dialog — same one used by the Reports
          page. Triggered imperatively from "Client File" button. */}
      <PatientProfileDialog ref={profileDialogRef} />

      {/* Edit invoice dialog — admin password gated. Lets staff correct
          Total / Paid on an invoice; Remaining and is_paid recompute.
          Updates Supabase directly so reports, profile, and transaction
          views all see the change on next read. */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) resetEditDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sky-700">
              <Tag className="h-5 w-5" />
              {language === "ar" ? "تعديل الفاتورة" : "Edit Invoice"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "صحّح إجمالي الفاتورة أو المبلغ المدفوع. سيتم إعادة حساب المتبقي تلقائياً، وسيتم تحديث التقارير وملف العميل تلقائياً."
                : "Correct the invoice total or paid amount. Remaining is recalculated automatically and reports / profile update on next read."}
            </DialogDescription>
          </DialogHeader>

          {editTarget && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-900">
                {editTarget.patient_name}{" "}
                <span className="text-slate-500 font-mono text-xs">
                  #{editTarget.invoice_id}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {language === "ar" ? "الحالي" : "Currently"}:{" "}
                {Number(editTarget.total).toFixed(2)} /{" "}
                {Number(editTarget.deposit).toFixed(2)} (
                {Number(editTarget.remaining).toFixed(2)}{" "}
                {language === "ar" ? "متبقي" : "remaining"})
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-total">
                  {language === "ar" ? "الإجمالي" : "Total"}
                </Label>
                <Input
                  id="edit-total"
                  type="number"
                  step="0.001"
                  min="0"
                  inputMode="decimal"
                  value={editTotal}
                  onChange={(e) => {
                    setEditTotal(e.target.value);
                    if (editError) setEditError("");
                  }}
                  className="h-11 text-base tabular-nums"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-deposit">
                  {language === "ar" ? "المدفوع" : "Paid"}
                </Label>
                <Input
                  id="edit-deposit"
                  type="number"
                  step="0.001"
                  min="0"
                  inputMode="decimal"
                  value={editDeposit}
                  onChange={(e) => {
                    setEditDeposit(e.target.value);
                    if (editError) setEditError("");
                  }}
                  className="h-11 text-base tabular-nums"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Live preview of new remaining */}
            {(() => {
              const t = Number(editTotal);
              const d = Number(editDeposit);
              if (!Number.isFinite(t) || !Number.isFinite(d)) return null;
              const newRemaining = Math.max(0, t - d);
              const willBePaid = newRemaining === 0 && t > 0;
              return (
                <div
                  className={`rounded-lg p-3 border tabular-nums ${
                    willBePaid
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-amber-50 border-amber-200"
                  }`}
                  dir="ltr"
                >
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs uppercase tracking-wide font-semibold text-slate-600">
                      {language === "ar"
                        ? "المتبقي بعد التعديل"
                        : "New remaining"}
                    </span>
                    <span
                      className={`text-xl font-bold ${
                        willBePaid ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {newRemaining.toFixed(2)} KWD
                    </span>
                  </div>
                  {willBePaid && (
                    <div className="text-xs text-emerald-700 font-medium mt-1">
                      {language === "ar"
                        ? "سيتم تحديد الفاتورة كمدفوعة بالكامل"
                        : "Invoice will be marked Fully paid"}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="space-y-1.5 pt-2 border-t border-dashed">
              <Label htmlFor="edit-pw">
                {language === "ar" ? "كلمة مرور المدير" : "Admin password"}
              </Label>
              <Input
                id="edit-pw"
                type="password"
                autoComplete="off"
                value={editPassword}
                onChange={(e) => {
                  setEditPassword(e.target.value);
                  if (editError) setEditError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSavingEdit) handleConfirmEdit();
                }}
                placeholder={
                  language === "ar"
                    ? "اطلب كلمة المرور من المدير"
                    : "Ask your manager for the password"
                }
                className="h-11"
              />
              {editError && (
                <p className="text-sm text-rose-600 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {editError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={resetEditDialog}
              disabled={isSavingEdit}
            >
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleConfirmEdit}
              disabled={isSavingEdit || !editPassword || !editTotal}
              className="bg-sky-700 hover:bg-sky-800 text-white"
            >
              {isSavingEdit ? (
                <>
                  <Loader2 className="w-4 h-4 me-1 animate-spin" />
                  {language === "ar" ? "جارٍ الحفظ..." : "Saving..."}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 me-1" />
                  {language === "ar" ? "حفظ التعديل" : "Save changes"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
