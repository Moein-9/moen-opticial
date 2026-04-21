/*
 * Refund Manager Component
 *
 * This component handles the refund and exchange management process,
 * storing data directly in Supabase.
 *
 * Required Supabase Schema:
 * If these columns are missing in the 'invoices' table, run the following SQL in Supabase:
 *
 * ALTER TABLE invoices
 * ADD COLUMN IF NOT EXISTS is_refunded BOOLEAN DEFAULT false,
 * ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,3) DEFAULT 0,
 * ADD COLUMN IF NOT EXISTS refund_date TIMESTAMP WITH TIME ZONE,
 * ADD COLUMN IF NOT EXISTS refund_method TEXT,
 * ADD COLUMN IF NOT EXISTS refund_reason TEXT,
 * ADD COLUMN IF NOT EXISTS refund_id TEXT,
 * ADD COLUMN IF NOT EXISTS staff_notes TEXT,
 * ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '[]'::jsonb;
 */

import React, { useState, useEffect } from "react";
import { usePatientStore } from "@/store/patientStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useLanguageStore } from "@/store/languageStore";
import {
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  RefreshCcw,
  Phone,
  Calendar,
  AlertCircle,
  User,
  Check,
  Sparkles,
  Pencil,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { RefundReceiptTemplate } from "./RefundReceiptTemplate";
import { PrintService } from "@/utils/PrintService";
import * as ReactDOMServer from "react-dom/server";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format, isValid } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

// Define Invoice interface based on the Supabase structure
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

export const RefundManager: React.FC = () => {
  const { language, t } = useLanguageStore();
  const { getPatientById } = usePatientStore();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundMethod, setRefundMethod] = useState<string>("");
  const [refundReason, setRefundReason] = useState<string>("");
  const [staffNotes, setStaffNotes] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  // UI-only: otherReason text, confirm dialog, notes expand
  const [otherReason, setOtherReason] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [notesExpanded, setNotesExpanded] = useState<boolean>(false);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return isValid(date) ? format(date, "dd/MM/yyyy") : "Invalid Date";
    } catch (error) {
      return "Invalid Date";
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error(
        language === "ar"
          ? "يرجى إدخال رقم الفاتورة أو اسم العميل أو رقم الهاتف"
          : "Please enter an invoice number, customer name, or phone number"
      );
      return;
    }

    setIsSearching(true);
    setErrorMessage("");

    try {
      // Search in Supabase using ilike for case-insensitive partial matching
      // @ts-ignore: We know invoices exists in Supabase but TypeScript doesn't
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .or(
          `invoice_id.ilike.%${searchTerm}%,patient_name.ilike.%${searchTerm}%,patient_phone.ilike.%${searchTerm}%`
        )
        .eq("is_refunded", false);

      if (error) {
        throw error;
      }

      // Map the data to our Invoice interface format
      const parsedResults = data.map((invoice: any) => ({
        id: invoice.id,
        invoice_id: invoice.invoice_id,
        work_order_id: invoice.work_order_id,
        patient_id: invoice.patient_id,
        patient_name: invoice.patient_name || "",
        patient_phone: invoice.patient_phone || "",

        invoice_type: invoice.invoice_type,

        lens_type: invoice.lens_type,
        lens_price: Number(invoice.lens_price) || 0,
        coating: invoice.coating,
        coating_price: Number(invoice.coating_price) || 0,
        coating_color: invoice.coating_color,
        thickness: invoice.thickness,
        thickness_price: Number(invoice.thickness_price) || 0,

        frame_brand: invoice.frame_brand,
        frame_model: invoice.frame_model,
        frame_color: invoice.frame_color,
        frame_size: invoice.frame_size,
        frame_price: Number(invoice.frame_price) || 0,

        contact_lens_items:
          typeof invoice.contact_lens_items === "string"
            ? JSON.parse(invoice.contact_lens_items)
            : invoice.contact_lens_items,
        contact_lens_rx:
          typeof invoice.contact_lens_rx === "string"
            ? JSON.parse(invoice.contact_lens_rx)
            : invoice.contact_lens_rx,

        service_name: invoice.service_name,
        service_price: Number(invoice.service_price) || 0,

        discount: Number(invoice.discount) || 0,
        deposit: Number(invoice.deposit) || 0,
        total: Number(invoice.total) || 0,
        remaining: Number(invoice.remaining) || 0,

        payment_method: invoice.payment_method || "",
        auth_number: invoice.auth_number,
        is_paid: Boolean(invoice.is_paid),
        is_refunded: Boolean(invoice.is_refunded),
        refund_amount: Number(invoice.refund_amount) || 0,
        refund_date: invoice.refund_date,
        refund_method: invoice.refund_method,
        refund_reason: invoice.refund_reason,
        refund_id: invoice.refund_id,
        staff_notes: invoice.staff_notes,

        created_at: invoice.created_at,
        payments:
          typeof invoice.payments === "string"
            ? JSON.parse(invoice.payments)
            : invoice.payments || [],
      }));

      setSearchResults(parsedResults);

      if (parsedResults.length === 0) {
        toast.error(
          language === "ar" ? "لم يتم العثور على فواتير" : "No invoices found"
        );
      }
    } catch (error: any) {
      console.error("Error searching invoices:", error);
      toast.error(
        language === "ar"
          ? "حدث خطأ أثناء البحث عن الفواتير"
          : "An error occurred while searching for invoices"
      );
      setErrorMessage(error.message || "Error searching invoices");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    // Set refund amount to the deposit (amount actually paid) instead of total
    setRefundAmount(invoice.deposit);
    setSuccess("");
    setErrorMessage("");
    // Reset UI-only state for a clean flow each time
    setRefundMethod("");
    setRefundReason("");
    setOtherReason("");
    setStaffNotes("");
    setNotesExpanded(false);
    setConfirmOpen(false);
  };

  const handleRefundAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (isNaN(value)) {
      setRefundAmount(0);
    } else {
      setRefundAmount(value);

      if (selectedInvoice && value > selectedInvoice.deposit) {
        toast.warning(
          language === "ar"
            ? "مبلغ الاسترداد لا يمكن أن يتجاوز المبلغ المدفوع"
            : "Refund amount cannot exceed the amount paid"
        );
      }
    }
  };

  const validateRefund = () => {
    if (!selectedInvoice) {
      toast.error(
        language === "ar"
          ? "يرجى اختيار فاتورة أولاً"
          : "Please select an invoice first"
      );
      return false;
    }

    if (refundAmount <= 0) {
      toast.error(
        language === "ar"
          ? "يجب أن يكون مبلغ الاسترداد أكبر من 0"
          : "Refund amount must be greater than 0"
      );
      return false;
    }

    // Validate against deposit (amount paid) instead of total
    if (refundAmount > selectedInvoice.deposit) {
      toast.error(
        language === "ar"
          ? "مبلغ الاسترداد لا يمكن أن يتجاوز المبلغ المدفوع"
          : "Refund amount cannot exceed the amount paid"
      );
      return false;
    }

    if (!refundMethod) {
      toast.error(
        language === "ar"
          ? "يرجى اختيار طريقة الاسترداد"
          : "Please select a refund method"
      );
      return false;
    }

    if (!refundReason.trim()) {
      toast.error(
        language === "ar"
          ? "يرجى إدخال سبب الاسترداد"
          : "Please enter a reason for the refund"
      );
      return false;
    }

    return true;
  };

  const handleProcessRefund = async () => {
    if (!validateRefund() || !selectedInvoice) return;

    try {
      const refundId = `RF${Date.now()}`;
      const refundDate = new Date().toISOString();

      console.log("Processing refund:", {
        invoiceId: selectedInvoice.invoice_id,
        refundAmount,
        refundMethod,
        refundReason,
        staffNotes,
      });

      // Update the invoice in Supabase
      // @ts-ignore: We know invoices exists in Supabase but TypeScript doesn't
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          is_refunded: true,
          refund_amount: refundAmount,
          refund_method: refundMethod,
          refund_reason: refundReason,
          refund_date: refundDate,
          refund_id: refundId,
          staff_notes: staffNotes,
        })
        .eq("invoice_id", selectedInvoice.invoice_id);

      if (updateError) {
        console.error("Error updating invoice:", updateError);
        throw new Error(updateError.message);
      }

      // If there's an associated work order, update its status
      if (selectedInvoice.work_order_id) {
        // @ts-ignore: We know work_orders exists in Supabase but TypeScript doesn't
        const { error: workOrderError } = await supabase
          .from("work_orders")
          .update({
            status: "refunded",
          })
          .eq("work_order_id", selectedInvoice.work_order_id);

        if (workOrderError) {
          console.error(
            "Warning: Could not update work order status:",
            workOrderError
          );
          // We don't want to fail the whole process if just the work order update fails
          toast.warning(
            language === "ar"
              ? "تم معالجة الاسترداد ولكن لم يتم تحديث حالة طلب العمل"
              : "Refund processed but work order status could not be updated"
          );
        }
      }

      setSuccess(
        language === "ar"
          ? "تم معالجة استرداد الأموال بنجاح"
          : "Refund processed successfully"
      );
      toast.success(
        language === "ar"
          ? "تمت معالجة استرداد الأموال بنجاح"
          : "The refund has been processed successfully"
      );

      const contactLensItemsFormatted = selectedInvoice.contact_lens_items
        ? selectedInvoice.contact_lens_items.map((item: any) => ({
            name: `${item.brand} ${item.type} ${item.color || ""}`.trim(),
            price: item.price,
            quantity: item.qty || 1,
          }))
        : [];

      const refundInfo = {
        refundId,
        invoiceId: selectedInvoice.invoice_id,
        patientName: selectedInvoice.patient_name,
        patientPhone: selectedInvoice.patient_phone,
        patientId: selectedInvoice.patient_id,
        refundAmount,
        refundMethod,
        refundReason,
        refundDate,
        originalTotal: selectedInvoice.total,
        frameBrand: selectedInvoice.frame_brand,
        frameModel: selectedInvoice.frame_model,
        frameColor: selectedInvoice.frame_color,
        lensType: selectedInvoice.lens_type,
        invoiceItems: [
          ...(selectedInvoice.frame_brand
            ? [
                {
                  name:
                    selectedInvoice.frame_brand +
                    " " +
                    selectedInvoice.frame_model,
                  price: selectedInvoice.frame_price,
                  quantity: 1,
                },
              ]
            : []),
          ...(selectedInvoice.lens_type
            ? [
                {
                  name: selectedInvoice.lens_type,
                  price: selectedInvoice.lens_price,
                  quantity: 1,
                },
              ]
            : []),
          ...(selectedInvoice.coating
            ? [
                {
                  name: selectedInvoice.coating,
                  price: selectedInvoice.coating_price,
                  quantity: 1,
                },
              ]
            : []),
          ...contactLensItemsFormatted,
        ],
        staffNotes,
      };

      setTimeout(() => {
        const receiptElement = (
          <RefundReceiptTemplate refund={refundInfo} language={language} />
        );

        const receiptHtml = ReactDOMServer.renderToString(receiptElement);

        PrintService.printHtml(
          PrintService.prepareReceiptDocument(
            receiptHtml,
            language === "ar"
              ? `إيصال استرداد - ${refundId}`
              : `Refund Receipt - ${refundId}`
          ),
          "receipt",
          () => {
            toast.success(
              language === "ar"
                ? "تتم معالجة طباعة الإيصال"
                : "Processing print request"
            );
          }
        );
      }, 300);

      setTimeout(() => {
        setSelectedInvoice(null);
        setRefundAmount(0);
        setRefundMethod("");
        setRefundReason("");
        setStaffNotes("");
        setSearchResults([]);
        setSearchTerm("");
      }, 2000);
    } catch (error: any) {
      setErrorMessage(
        error.message ||
          (language === "ar"
            ? "حدث خطأ أثناء معالجة الاسترداد"
            : "An error occurred while processing the refund")
      );
      toast.error(
        error.message ||
          (language === "ar"
            ? "حدث خطأ أثناء معالجة الاسترداد"
            : "An error occurred while processing the refund")
      );
    }
  };

  const goToPatientProfile = () => {
    if (selectedInvoice && selectedInvoice.patient_id) {
      navigate(`/patient/${selectedInvoice.patient_id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-full">
            <RefreshCcw className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-blue-700">
              {language === "ar"
                ? "إدارة استرداد الأموال والاستبدال"
                : "Refund & Exchange Management"}
            </h1>
            <p className="text-blue-600 font-medium">
              {language === "ar"
                ? "معالجة استرداد الأموال واستبدال المنتجات للعملاء"
                : "Process refunds and product exchanges for customers"}
            </p>
          </div>
        </div>
      </div>

      <Card className="border-blue-200 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-100 to-blue-50 pb-4">
          <CardTitle className="flex items-center text-blue-700 gap-2">
            <Search className="h-5 w-5" />
            {language === "ar" ? "البحث عن فاتورة" : "Search for Invoice"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "ابحث عن الفاتورة بواسطة رقم الفاتورة، اسم العميل، أو رقم الهاتف"
              : "Search for an invoice by invoice number, customer name, or phone number"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={
                    language === "ar"
                      ? "ابحث بواسطة رقم الفاتورة، اسم العميل، أو رقم الهاتف"
                      : "Search by invoice number, customer name, or phone number"
                  }
                  className="pl-10 border-blue-200 focus:border-blue-400"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={isSearching}
                className="gap-2 bg-blue-600 hover:bg-blue-700 md:w-auto w-full"
              >
                {isSearching ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {language === "ar" ? "بحث" : "Search"}
              </Button>
            </div>

            {success && (
              <Alert
                variant="default"
                className="bg-green-50 text-green-800 border-green-200"
              >
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="font-medium">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            {errorMessage && (
              <Alert variant="destructive" className="border-red-300 bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="font-medium">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            {searchResults.length > 0 && (
              <div className="rounded-lg overflow-hidden border border-blue-200 shadow-sm">
                <div className="bg-blue-50 p-3 text-blue-700 font-medium border-b border-blue-200">
                  {language === "ar" ? "نتائج البحث" : "Search Results"} (
                  {searchResults.length})
                </div>
                <Table>
                  <TableHeader className="bg-blue-50/70">
                    <TableRow>
                      <TableHead className="text-blue-700 font-semibold">
                        {language === "ar" ? "رقم الفاتورة" : "Invoice ID"}
                      </TableHead>
                      <TableHead className="text-blue-700 font-semibold">
                        {language === "ar" ? "العميل" : "Customer"}
                      </TableHead>
                      <TableHead className="text-blue-700 font-semibold">
                        {language === "ar" ? "رقم الهاتف" : "Phone"}
                      </TableHead>
                      <TableHead className="text-blue-700 font-semibold">
                        {language === "ar" ? "التاريخ" : "Date"}
                      </TableHead>
                      <TableHead className="text-blue-700 font-semibold">
                        {language === "ar" ? "المبلغ الإجمالي" : "Total Amount"}
                      </TableHead>
                      <TableHead className="text-blue-700 font-semibold">
                        {language === "ar" ? "المبلغ المدفوع" : "Amount Paid"}
                      </TableHead>
                      <TableHead className="text-blue-700 font-semibold">
                        {language === "ar" ? "الحالة" : "Status"}
                      </TableHead>
                      <TableHead className="text-right text-blue-700 font-semibold">
                        {language === "ar" ? "الإجراءات" : "Actions"}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((invoice) => (
                      <TableRow
                        key={invoice.invoice_id}
                        className={`hover:bg-blue-50/30 transition-colors 
                          ${
                            selectedInvoice?.invoice_id === invoice.invoice_id
                              ? "bg-blue-100/30"
                              : ""
                          }`}
                      >
                        <TableCell className="font-medium">
                          {invoice.invoice_id}
                        </TableCell>
                        <TableCell>{invoice.patient_name}</TableCell>
                        <TableCell>{invoice.patient_phone}</TableCell>
                        <TableCell>{formatDate(invoice.created_at)}</TableCell>
                        <TableCell className="font-medium text-blue-700">
                          {invoice.total.toFixed(3)} KWD
                        </TableCell>
                        <TableCell className="font-semibold text-green-700">
                          {invoice.deposit.toFixed(3)} KWD
                        </TableCell>
                        <TableCell>
                          {invoice.is_paid ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                              {language === "ar" ? "مدفوع" : "Paid"}
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">
                              {language === "ar" ? "غير مدفوع" : "Unpaid"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSelectInvoice(invoice)}
                            className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800 hover:border-blue-400"
                          >
                            {language === "ar" ? "اختيار" : "Select"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedInvoice}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedInvoice(null);
            setOtherReason("");
            setConfirmOpen(false);
            setNotesExpanded(false);
          }
        }}
      >
        <DialogContent
          className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0 bg-white"
          dir={language === "ar" ? "rtl" : "ltr"}
        >
          {selectedInvoice && (() => {
            // Derived UI state
            const isOtherReason = refundReason === "Other";
            const methodReady = Boolean(refundMethod);
            const reasonReady = Boolean(refundReason) && (!isOtherReason || otherReason.trim().length > 0);
            const amountReady = refundAmount > 0 && refundAmount <= selectedInvoice.deposit;
            const readyToSubmit = amountReady && methodReady && reasonReady;

            const reasons: { value: string; en: string; ar: string }[] = [
              { value: "Customer Dissatisfied", en: "Customer dissatisfied", ar: "العميل غير راضٍ" },
              { value: "Product Defect", en: "Product defect", ar: "عيب في المنتج" },
              { value: "Incorrect Prescription", en: "Incorrect prescription", ar: "وصفة طبية غير صحيحة" },
              { value: "Billing Error", en: "Billing error", ar: "خطأ في الفواتير" },
              { value: "Other", en: "Other", ar: "آخر" },
            ];

            const reasonLabelFor = (val: string) => {
              const r = reasons.find((x) => x.value === val);
              if (!r) return val;
              return language === "ar" ? r.ar : r.en;
            };

            // Each method gets its own accent color + brand logo
            const methods = [
              {
                value: "Cash",
                img: "https://cdn-icons-png.flaticon.com/512/7083/7083125.png",
                en: "Cash",
                ar: "نقداً",
                // emerald
                activeBg: "bg-emerald-500",
                activeRing: "ring-emerald-500",
                activeText: "text-white",
                idleBg: "bg-emerald-50",
                idleBorder: "border-emerald-200",
                idleText: "text-emerald-700",
              },
              {
                value: "KNET",
                img: "https://kabkg.com/staticsite/images/knet.png",
                en: "KNET",
                ar: "كي نت",
                // blue
                activeBg: "bg-blue-500",
                activeRing: "ring-blue-500",
                activeText: "text-white",
                idleBg: "bg-blue-50",
                idleBorder: "border-blue-200",
                idleText: "text-blue-700",
              },
              {
                value: "Visa",
                img: "https://cdn-icons-png.flaticon.com/512/196/196578.png",
                en: "Visa",
                ar: "فيزا",
                // violet
                activeBg: "bg-violet-500",
                activeRing: "ring-violet-500",
                activeText: "text-white",
                idleBg: "bg-violet-50",
                idleBorder: "border-violet-200",
                idleText: "text-violet-700",
              },
              {
                value: "MasterCard",
                img: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg",
                en: "MasterCard",
                ar: "ماستر كارد",
                // amber
                activeBg: "bg-amber-500",
                activeRing: "ring-amber-500",
                activeText: "text-white",
                idleBg: "bg-amber-50",
                idleBorder: "border-amber-200",
                idleText: "text-amber-800",
              },
            ];

            const methodLabelFor = (val: string) => {
              const m = methods.find((x) => x.value === val);
              if (!m) return val;
              return language === "ar" ? m.ar : m.en;
            };

            return (
              <>
                {/* ---------- Colorful header: indigo→purple gradient ---------- */}
                <DialogHeader className="px-6 py-5 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white space-y-0">
                  <div className="flex items-center justify-between gap-3">
                    <DialogTitle className="text-[15px] font-semibold text-white flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                        <Receipt className="h-4 w-4 text-white" />
                      </div>
                      {language === "ar" ? "استرداد" : "Refund"}
                    </DialogTitle>
                    <span className="text-xs font-mono text-white/75 tracking-tight bg-white/10 px-2 py-1 rounded-md">
                      #{selectedInvoice.invoice_id}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <div className="flex items-center gap-1.5 text-white">
                      <User className="h-3.5 w-3.5 text-white/70" />
                      <span className="font-semibold">{selectedInvoice.patient_name}</span>
                      {selectedInvoice.patient_id && (
                        <button
                          type="button"
                          onClick={goToPatientProfile}
                          className="ms-1 text-xs text-white/75 hover:text-white underline-offset-2 hover:underline"
                        >
                          {language === "ar" ? "الملف" : "profile"}
                        </button>
                      )}
                    </div>
                    {selectedInvoice.patient_phone && (
                      <div className="flex items-center gap-1.5 text-white/80">
                        <Phone className="h-3.5 w-3.5" />
                        <span className="tabular-nums">{selectedInvoice.patient_phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-white/80">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{formatDate(selectedInvoice.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 ms-auto">
                      <span className="text-[11px] uppercase tracking-wider text-white/70 font-medium">
                        {language === "ar" ? "المدفوع" : "Paid"}
                      </span>
                      <span className="text-base font-bold tabular-nums text-white bg-white/15 backdrop-blur-sm px-3 py-1 rounded-lg ring-1 ring-white/20">
                        {selectedInvoice.deposit.toFixed(3)} KWD
                      </span>
                    </div>
                  </div>
                </DialogHeader>

                {/* ---------- Body: single view, no gating ---------- */}
                <div className="px-6 py-5 space-y-5">

                  {/* Amount */}
                  <section className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-neutral-800">
                        {language === "ar" ? "كم المبلغ؟" : "How much?"}
                      </h3>
                    </div>

                    <div className="rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white px-5 py-8">
                      {/* HERO amount input — dashed underline + pencil hint signal editability */}
                      <label htmlFor="refundAmount" className="group block cursor-text">
                        <div className="flex flex-nowrap items-baseline justify-center gap-4">
                          <div className="relative inline-block">
                            <Input
                              id="refundAmount"
                              type="number"
                              inputMode="decimal"
                              step="0.001"
                              min="0"
                              max={selectedInvoice.deposit}
                              value={refundAmount || ""}
                              onChange={handleRefundAmountChange}
                              onFocus={(e) => e.target.select()}
                              placeholder="0"
                              style={{ width: "4.5ch" }}
                              className="!w-auto h-auto border-0 border-b-[3px] border-dashed border-indigo-300 rounded-none bg-transparent p-0 pb-1 text-center !text-[100px] md:!text-[100px] font-black tabular-nums leading-none tracking-tight text-indigo-900 placeholder:text-indigo-200 shadow-none hover:border-indigo-400 focus:border-solid focus:border-indigo-500 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                            />
                            <span className="pointer-events-none absolute -top-1 -end-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm shadow-indigo-500/30 opacity-90 group-hover:scale-110 group-focus-within:scale-0 transition-transform">
                              <Pencil className="h-3 w-3" strokeWidth={2.5} />
                            </span>
                          </div>
                          <span className="shrink-0 text-[100px] font-black leading-none tracking-tight text-indigo-500">
                            {language === "ar" ? "د.ك" : "KWD"}
                          </span>
                        </div>
                        <div className="mt-1 text-center text-[11px] text-indigo-500/80 font-medium group-focus-within:opacity-0 transition-opacity">
                          {language === "ar" ? "اضغط على الرقم لتعديل المبلغ" : "Tap the number to edit"}
                        </div>
                      </label>

                      {/* One-tap Full refund */}
                      <div className="mt-5 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => setRefundAmount(selectedInvoice.deposit)}
                          className={[
                            "inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all",
                            refundAmount === selectedInvoice.deposit
                              ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                              : "bg-emerald-50 text-emerald-700 border-2 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300",
                          ].join(" ")}
                        >
                          {refundAmount === selectedInvoice.deposit && (
                            <Check className="h-4 w-4" strokeWidth={3} />
                          )}
                          {language === "ar"
                            ? `استرداد كامل · ${selectedInvoice.deposit.toFixed(3)} د.ك`
                            : `Full refund · ${selectedInvoice.deposit.toFixed(3)} KWD`}
                        </button>
                      </div>

                      {/* Simple instruction */}
                      <div className="mt-3 text-center text-[13px] text-indigo-600/80">
                        {language === "ar"
                          ? "اضغط كامل أو اكتب المبلغ اللي تبي ترجعه"
                          : "Tap Full, or type how much you want to refund"}
                      </div>

                      {refundAmount > selectedInvoice.deposit && (
                        <div className="mt-3 flex items-center justify-center">
                          <span className="inline-flex items-center gap-1 text-[12px] text-rose-600 font-semibold bg-rose-50 px-2.5 py-1 rounded-full">
                            <AlertCircle className="h-3 w-3" />
                            {language === "ar" ? "يتجاوز المدفوع" : "Exceeds amount paid"}
                          </span>
                        </div>
                      )}
                    </div>

                    {!selectedInvoice.is_paid && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">
                        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <span>
                          {language === "ar"
                            ? `هذه الفاتورة غير مدفوعة بالكامل. المتبقي: ${selectedInvoice.remaining.toFixed(3)} د.ك`
                            : `This invoice isn't fully paid. Still owed: ${selectedInvoice.remaining.toFixed(3)} KWD`}
                        </span>
                      </div>
                    )}
                  </section>

                  {/* Method — 4 colorful tiles */}
                  <section className="space-y-2.5">
                    <h3 className="text-sm font-semibold text-neutral-800">
                      {language === "ar" ? "كيف تُرجع المبلغ؟" : "How are you paying it back?"}
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {methods.map((m) => {
                        const active = refundMethod === m.value;
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setRefundMethod(m.value)}
                            className={[
                              "relative rounded-2xl border-2 p-3 text-center transition-all",
                              active
                                ? `${m.activeBg} ${m.activeText} ring-2 ${m.activeRing} ring-offset-2 border-transparent shadow-md`
                                : `${m.idleBg} ${m.idleBorder} ${m.idleText} hover:scale-[1.02] hover:shadow-sm`,
                            ].join(" ")}
                          >
                            {active && (
                              <span className="absolute top-2 end-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm">
                                <Check className="h-3 w-3 text-white" strokeWidth={3} />
                              </span>
                            )}
                            <div className="flex h-10 items-center justify-center rounded-lg bg-white/90 px-2">
                              <img
                                src={m.img}
                                alt={m.en}
                                className="h-7 max-w-full object-contain"
                                loading="lazy"
                              />
                            </div>
                            <div
                              className={[
                                "mt-2 text-sm font-bold",
                                active ? "text-white" : m.idleText,
                              ].join(" ")}
                            >
                              {language === "ar" ? m.ar : m.en}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Reason — rose pill accents */}
                  <section className="space-y-2.5">
                    <h3 className="text-sm font-semibold text-neutral-800">
                      {language === "ar" ? "ما السبب؟" : "What's the reason?"}
                    </h3>

                    <div className="flex flex-wrap gap-2">
                      {reasons.map((r) => {
                        const active = refundReason === r.value;
                        return (
                          <button
                            key={r.value}
                            type="button"
                            onClick={() => {
                              setRefundReason(r.value);
                              if (r.value !== "Other") setOtherReason("");
                            }}
                            className={[
                              "px-4 py-2 rounded-full text-[13px] font-semibold transition-all",
                              active
                                ? "bg-rose-500 text-white border-2 border-rose-500 shadow-sm shadow-rose-500/20"
                                : "bg-rose-50 text-rose-700 border-2 border-rose-200 hover:bg-rose-100 hover:border-rose-300",
                            ].join(" ")}
                          >
                            {language === "ar" ? r.ar : r.en}
                          </button>
                        );
                      })}
                    </div>

                    {isOtherReason && (
                      <Input
                        value={otherReason}
                        onChange={(e) => setOtherReason(e.target.value)}
                        placeholder={
                          language === "ar"
                            ? "اكتب السبب…"
                            : "Type the reason…"
                        }
                        className="border-rose-200 focus-visible:ring-rose-400 focus-visible:border-rose-400"
                      />
                    )}
                  </section>

                  {/* Notes — collapsible, quiet */}
                  <section className="pt-1">
                    {!notesExpanded ? (
                      <button
                        type="button"
                        onClick={() => setNotesExpanded(true)}
                        className="text-[13px] text-neutral-500 hover:text-indigo-600 font-medium underline-offset-4 hover:underline transition-colors"
                      >
                        {language === "ar"
                          ? "+ إضافة ملاحظات (اختياري)"
                          : "+ Add notes (optional)"}
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="staffNotes" className="text-[13px] text-neutral-700 font-semibold">
                            {language === "ar" ? "ملاحظات" : "Notes"}
                          </Label>
                          <button
                            type="button"
                            onClick={() => {
                              setNotesExpanded(false);
                              setStaffNotes("");
                            }}
                            className="text-[12px] text-neutral-400 hover:text-neutral-700"
                          >
                            {language === "ar" ? "إخفاء" : "hide"}
                          </button>
                        </div>
                        <Textarea
                          id="staffNotes"
                          value={staffNotes}
                          onChange={(e) => setStaffNotes(e.target.value)}
                          placeholder={
                            language === "ar"
                              ? "سياق إضافي للسجل…"
                              : "Extra context for the record…"
                          }
                          className="min-h-[72px] text-[13px] border-neutral-200 focus-visible:ring-indigo-400 focus-visible:border-indigo-400 resize-none"
                        />
                      </div>
                    )}
                  </section>
                </div>

                {/* ---------- Footer: friendly recap + big colorful Refund button ---------- */}
                <DialogFooter className="flex flex-col items-stretch gap-3 px-6 py-4 border-t border-neutral-200 bg-gradient-to-b from-white to-neutral-50 sm:flex-col sm:gap-3">
                  {/* Friendly recap */}
                  <div className="text-[12px] leading-relaxed text-neutral-500">
                    {language === "ar" ? (
                      <>
                        إرجاع{" "}
                        <span className="font-bold tabular-nums text-neutral-900">
                          {refundAmount > 0 ? `${refundAmount.toFixed(3)} د.ك` : <span className="text-neutral-400 font-normal">— حدد المبلغ</span>}
                        </span>
                        {" "}إلى{" "}
                        <span className="font-semibold text-neutral-800">{selectedInvoice.patient_name}</span>
                        {" "}عبر{" "}
                        <span className="font-semibold text-neutral-800">
                          {refundMethod ? methodLabelFor(refundMethod) : <span className="text-neutral-400 font-normal">— حدد الطريقة</span>}
                        </span>
                        {" · "}
                        <span className="text-neutral-600">
                          {refundReason
                            ? isOtherReason
                              ? otherReason.trim() || <span className="text-neutral-400">— اكتب السبب</span>
                              : reasonLabelFor(refundReason)
                            : <span className="text-neutral-400">— حدد السبب</span>}
                        </span>
                      </>
                    ) : (
                      <>
                        Refunding{" "}
                        <span className="font-bold tabular-nums text-neutral-900">
                          {refundAmount > 0 ? `${refundAmount.toFixed(3)} KWD` : <span className="text-neutral-400 font-normal">— set amount</span>}
                        </span>
                        {" "}to{" "}
                        <span className="font-semibold text-neutral-800">{selectedInvoice.patient_name}</span>
                        {" "}via{" "}
                        <span className="font-semibold text-neutral-800">
                          {refundMethod ? methodLabelFor(refundMethod) : <span className="text-neutral-400 font-normal">— pick method</span>}
                        </span>
                        {" · "}
                        <span className="text-neutral-600">
                          {refundReason
                            ? isOtherReason
                              ? otherReason.trim() || <span className="text-neutral-400">— type reason</span>
                              : reasonLabelFor(refundReason)
                            : <span className="text-neutral-400">— pick reason</span>}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Action row */}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => setSelectedInvoice(null)}
                      className="text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 h-12 px-4"
                    >
                      {language === "ar" ? "إلغاء" : "Cancel"}
                    </Button>
                    <Button
                      onClick={() => {
                        // stash "Other" free text into staffNotes for audit
                        if (isOtherReason && otherReason.trim()) {
                          setStaffNotes((prev) => {
                            const tag = language === "ar"
                              ? `السبب: ${otherReason.trim()}`
                              : `Reason: ${otherReason.trim()}`;
                            return prev.trim() ? `${tag}\n${prev}` : tag;
                          });
                        }
                        setConfirmOpen(true);
                      }}
                      disabled={!readyToSubmit}
                      className={[
                        "flex-1 h-12 px-5 gap-2 text-[15px] font-bold transition-all rounded-xl",
                        readyToSubmit
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md shadow-emerald-500/25"
                          : "bg-neutral-200 text-neutral-400 cursor-not-allowed hover:bg-neutral-200",
                      ].join(" ")}
                    >
                      {readyToSubmit && <Sparkles className="h-4 w-4" />}
                      {language === "ar"
                        ? `إرجاع ${refundAmount > 0 ? `${refundAmount.toFixed(3)} د.ك` : ""}`
                        : `Refund ${refundAmount > 0 ? `${refundAmount.toFixed(3)} KWD` : ""}`}
                    </Button>
                  </div>
                </DialogFooter>

                {/* ---------- Confirm dialog (guardrail) ---------- */}
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogContent dir={language === "ar" ? "rtl" : "ltr"}>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-neutral-900">
                        {language === "ar" ? "تأكيد الاسترداد" : "Confirm refund"}
                      </AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="pt-2">
                          <p className="text-neutral-700 text-[14px] leading-relaxed">
                            {language === "ar" ? (
                              <>
                                إرجاع{" "}
                                <span className="font-bold text-neutral-900 tabular-nums">
                                  {refundAmount.toFixed(3)} د.ك
                                </span>
                                {" "}إلى{" "}
                                <span className="font-semibold text-neutral-900">
                                  {selectedInvoice.patient_name}
                                </span>
                                {" "}عبر{" "}
                                <span className="font-semibold text-neutral-900">
                                  {methodLabelFor(refundMethod)}
                                </span>
                                ؟
                              </>
                            ) : (
                              <>
                                Refund{" "}
                                <span className="font-bold text-neutral-900 tabular-nums">
                                  {refundAmount.toFixed(3)} KWD
                                </span>
                                {" "}to{" "}
                                <span className="font-semibold text-neutral-900">
                                  {selectedInvoice.patient_name}
                                </span>
                                {" "}via{" "}
                                <span className="font-semibold text-neutral-900">
                                  {methodLabelFor(refundMethod)}
                                </span>
                                ?
                              </>
                            )}
                          </p>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-neutral-200">
                        {language === "ar" ? "رجوع" : "Cancel"}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          setConfirmOpen(false);
                          handleProcessRefund();
                        }}
                        className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold shadow-sm shadow-emerald-500/25"
                      >
                        {language === "ar" ? "تأكيد" : "Confirm"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
