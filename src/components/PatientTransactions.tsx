import React, { useState, useEffect } from "react";
import { useLanguageStore } from "@/store/languageStore";
import {
  Invoice,
  WorkOrder as InvoiceWorkOrder,
  useInvoiceStore,
} from "@/store/invoiceStore";
import { TabbedTransactions } from "./TabbedTransactions";
import { Patient } from "@/store/patientStore";
import { PrintOptionsDialog } from "./PrintOptionsDialog";
import { Button } from "@/components/ui/button";
import { Printer, AlertCircle, Loader2 } from "lucide-react";
import { CustomPrintService } from "@/utils/CustomPrintService";
import { CustomPrintWorkOrderButton } from "./CustomPrintWorkOrderButton";
import { DeleteOrderConfirmDialog } from "./DeleteOrderConfirmDialog";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

interface PatientTransactionsProps {
  invoices: Invoice[];
  workOrders: InvoiceWorkOrder[];
  patient?: Patient;
}

export const PatientTransactions: React.FC<PatientTransactionsProps> = ({
  invoices: initialInvoices,
  workOrders: initialWorkOrders,
  patient,
}) => {
  const { t, language } = useLanguageStore();
  const {
    deleteWorkOrder,
    getArchivedInvoicesByPatientId,
    getArchivedWorkOrdersByPatientId,
  } = useInvoiceStore();
  const [lastEditTimestamp, setLastEditTimestamp] = useState<string | null>(
    null
  );
  const [localInvoices, setLocalInvoices] =
    useState<Invoice[]>(initialInvoices);
  const [localWorkOrders, setLocalWorkOrders] =
    useState<InvoiceWorkOrder[]>(initialWorkOrders);
  const [archivedInvoices, setArchivedInvoices] = useState<Invoice[]>([]);
  const [archivedWorkOrders, setArchivedWorkOrders] = useState<
    InvoiceWorkOrder[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  // State for delete confirmation dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [workOrderToDelete, setWorkOrderToDelete] =
    useState<InvoiceWorkOrder | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Effect to fetch data from Supabase
  useEffect(() => {
    const fetchPatientTransactions = async () => {
      if (!patient?.patientId) return;

      try {
        setIsLoading(true);

        // Fetch active invoices (not refunded and not archived)
        const { data: activeInvoiceData, error: activeInvoiceError } =
          await supabase
            .from("invoices")
            .select("*")
            .eq("patient_id", patient.patientId)
            .eq("is_refunded", false)
            .eq("is_archived", false);

        if (activeInvoiceError) {
          console.error("Error fetching active invoices:", activeInvoiceError);
          toast.error(
            language === "ar"
              ? "حدث خطأ أثناء جلب الفواتير النشطة"
              : "Error fetching active invoices"
          );
          return;
        }

        // Fetch refunded invoices (refunded but not archived)
        const { data: refundedInvoiceData, error: refundedInvoiceError } =
          await supabase
            .from("invoices")
            .select("*")
            .eq("patient_id", patient.patientId)
            .eq("is_refunded", true)
            .eq("is_archived", false);

        if (refundedInvoiceError) {
          console.error(
            "Error fetching refunded invoices:",
            refundedInvoiceError
          );
          toast.error(
            language === "ar"
              ? "حدث خطأ أثناء جلب الفواتير المستردة"
              : "Error fetching refunded invoices"
          );
          return;
        }

        // Fetch archived invoices
        const { data: archivedInvoiceData, error: archivedInvoiceError } =
          await supabase
            .from("invoices")
            .select("*")
            .eq("patient_id", patient.patientId)
            .eq("is_archived", true);

        if (archivedInvoiceError) {
          console.error(
            "Error fetching archived invoices:",
            archivedInvoiceError
          );
          toast.error(
            language === "ar"
              ? "حدث خطأ أثناء جلب الفواتير المؤرشفة"
              : "Error fetching archived invoices"
          );
          return;
        }

        // Fetch work orders (not archived)
        const { data: workOrderData, error: workOrderError } = await supabase
          .from("work_orders")
          .select("*")
          .eq("patient_id", patient.patientId)
          .eq("is_archived", false);

        if (workOrderError) {
          console.error("Error fetching work orders:", workOrderError);
          toast.error(
            language === "ar"
              ? "حدث خطأ أثناء جلب طلبات العمل"
              : "Error fetching work orders"
          );
          return;
        }

        // Fetch archived work orders
        const { data: archivedWorkOrderData, error: archivedWorkOrderError } =
          await supabase
            .from("work_orders")
            .select("*")
            .eq("patient_id", patient.patientId)
            .eq("is_archived", true);

        if (archivedWorkOrderError) {
          console.error(
            "Error fetching archived work orders:",
            archivedWorkOrderError
          );
          toast.error(
            language === "ar"
              ? "حدث خطأ أثناء جلب طلبات العمل المؤرشفة"
              : "Error fetching archived work orders"
          );
          return;
        }

        // Process data to match the expected structure
        const processInvoice = (invoice: any): Invoice => {
          let payments = [];
          try {
            payments =
              typeof invoice.payments === "string"
                ? JSON.parse(invoice.payments)
                : invoice.payments || [];
          } catch (e) {
            console.error("Error parsing payments:", e);
            payments = [];
          }

          return {
            id: invoice.id,
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

            discount: invoice.discount || 0,
            deposit: invoice.deposit || 0,
            total: invoice.total || 0,
            remaining: invoice.remaining || 0,

            paymentMethod: invoice.payment_method,
            authNumber: invoice.auth_number,
            isPaid: invoice.is_paid || false,

            isPickedUp: invoice.is_picked_up || false,
            pickedUpAt: invoice.picked_up_at,

            isRefunded: invoice.is_refunded || false,
            refundDate: invoice.refund_date,
            refundAmount: invoice.refund_amount,
            refundReason: invoice.refund_reason,
            refundMethod: invoice.refund_method,
            refundId: invoice.refund_id,
            staffNotes: invoice.staff_notes,

            isArchived: invoice.is_archived || false,
            archivedAt: invoice.archived_at,
            archiveReason: invoice.archive_reason,

            createdAt: invoice.created_at,
            lastEditedAt:
              invoice.updated_at !== invoice.created_at
                ? invoice.updated_at
                : undefined,
            payments,
          };
        };

        const processWorkOrder = (workOrder: any): InvoiceWorkOrder => {
          return {
            id: workOrder.id,
            workOrderId: workOrder.work_order_id,
            patientId: workOrder.patient_id,
            invoiceId: workOrder.invoice_id,

            isContactLens: workOrder.is_contact_lens || false,
            isPaid: workOrder.is_paid || false,

            lensType: workOrder.lens_type,
            contactLenses: workOrder.contact_lenses,
            contactLensRx: workOrder.contact_lens_rx,

            rx: workOrder.rx,

            coatingColor: workOrder.coating_color,
            discount: workOrder.discount,

            status: workOrder.status || "pending",
            isComplete: workOrder.is_complete || false,
            completedAt: workOrder.completed_at,

            isArchived: workOrder.is_archived || false,
            archivedAt: workOrder.archived_at,
            archiveReason: workOrder.archive_reason,

            createdAt: workOrder.created_at,
            updatedAt: workOrder.updated_at,
            lastEditedAt:
              workOrder.updated_at !== workOrder.created_at
                ? workOrder.updated_at
                : undefined,
          };
        };

        // Transform the data
        const transformedActiveInvoices =
          activeInvoiceData?.map(processInvoice) || [];
        const transformedRefundedInvoices =
          refundedInvoiceData?.map(processInvoice) || [];
        const transformedArchivedInvoices =
          archivedInvoiceData?.map(processInvoice) || [];
        const transformedWorkOrders =
          workOrderData?.map(processWorkOrder) || [];
        const transformedArchivedWorkOrders =
          archivedWorkOrderData?.map(processWorkOrder) || [];

        // Combine active and refunded invoices for the local invoices state
        const allActiveInvoices = [
          ...transformedActiveInvoices,
          ...transformedRefundedInvoices,
        ];

        // Update state
        setLocalInvoices(allActiveInvoices);
        setLocalWorkOrders(transformedWorkOrders);
        setArchivedInvoices(transformedArchivedInvoices);
        setArchivedWorkOrders(transformedArchivedWorkOrders);

        console.log(
          "Fetched invoices from Supabase:",
          allActiveInvoices.length
        );
        console.log(
          "Fetched work orders from Supabase:",
          transformedWorkOrders.length
        );
      } catch (error) {
        console.error("Error fetching transaction data:", error);
        toast.error(
          language === "ar"
            ? "حدث خطأ أثناء جلب البيانات"
            : "Error fetching transaction data"
        );
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch data from Supabase when patient changes or refresh is triggered
    fetchPatientTransactions();

    // Also update with the provided props for backward compatibility
    if (initialInvoices.length > 0 || initialWorkOrders.length > 0) {
      setLocalInvoices(initialInvoices);
      setLocalWorkOrders(initialWorkOrders);
    }

    // Load archived items if patient ID is available (using store for now)
    if (patient?.patientId) {
      setArchivedInvoices(getArchivedInvoicesByPatientId(patient.patientId));
      setArchivedWorkOrders(
        getArchivedWorkOrdersByPatientId(patient.patientId)
      );
    }
  }, [
    patient?.patientId,
    language,
    refreshTrigger,
    initialInvoices,
    initialWorkOrders,
    getArchivedInvoicesByPatientId,
    getArchivedWorkOrdersByPatientId,
  ]);

  // Effect to detect changes in work orders (especially edits)
  useEffect(() => {
    // Find the most recent edit timestamp across all work orders and invoices
    let latestEdit: string | null = null;

    // Check work orders
    localWorkOrders.forEach((workOrder) => {
      if (
        workOrder.lastEditedAt &&
        (!latestEdit || new Date(workOrder.lastEditedAt) > new Date(latestEdit))
      ) {
        latestEdit = workOrder.lastEditedAt;
      }
    });

    // Check invoices
    localInvoices.forEach((invoice) => {
      if (
        invoice.lastEditedAt &&
        (!latestEdit || new Date(invoice.lastEditedAt) > new Date(latestEdit))
      ) {
        latestEdit = invoice.lastEditedAt;
      }
    });

    setLastEditTimestamp(latestEdit);
  }, [localWorkOrders, localInvoices]);

  // Filter out active invoices (not refunded)
  const activeInvoices = localInvoices.filter(
    (invoice) => !invoice.isRefunded && !invoice.isArchived
  );

  // Filter out refunded invoices
  const refundedInvoices = localInvoices.filter(
    (invoice) => invoice.isRefunded && !invoice.isArchived
  );

  const handlePrintWorkOrder = (workOrder: InvoiceWorkOrder) => {
    // Find related invoice for this work order
    const relatedInvoice = localInvoices.find(
      (inv) => inv.workOrderId === workOrder.id
    );

    console.log("[PatientTransactions] Printing work order:", workOrder.id);
    console.log(
      "[PatientTransactions] Related invoice:",
      relatedInvoice?.invoiceId
    );

    // Call the CustomPrintService with the proper parameters
    CustomPrintService.printWorkOrder(workOrder, relatedInvoice, patient);
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    console.log("[PatientTransactions] Printing invoice:", invoice.invoiceId);

    // Call the CustomPrintService to handle invoice printing
    if (typeof CustomPrintService.printInvoice === "function") {
      CustomPrintService.printInvoice(invoice);
    } else {
      console.error("CustomPrintService.printInvoice is not implemented");
    }
  };

  const handleDeleteWorkOrder = (workOrder: InvoiceWorkOrder) => {
    setWorkOrderToDelete(workOrder);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteWorkOrder = async () => {
    if (!workOrderToDelete) return;

    try {
      // Find related invoice to check payment status
      const relatedInvoice = localInvoices.find(
        (inv) => inv.workOrderId === workOrderToDelete?.id
      );
      const reason =
        language === "ar"
          ? "تم حذف الطلب من قبل المستخدم"
          : "Order deleted by user";

      // Update Supabase directly - archive the work order
      const { error: updateWorkOrderError } = await supabase
        .from("work_orders")
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archive_reason: reason,
        })
        .eq("id", workOrderToDelete.id);

      if (updateWorkOrderError) {
        console.error(
          "Error archiving work order in Supabase:",
          updateWorkOrderError
        );
        throw new Error("Failed to archive work order");
      }

      // If there's a related invoice, archive it too
      if (relatedInvoice) {
        const { error: updateInvoiceError } = await supabase
          .from("invoices")
          .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
            archive_reason: reason,
          })
          .eq("invoice_id", relatedInvoice.invoiceId);

        if (updateInvoiceError) {
          console.error(
            "Error archiving invoice in Supabase:",
            updateInvoiceError
          );
          // Don't throw, continue with local updates
        }
      }

      // Call deleteWorkOrder function from the store for backward compatibility
      const refundId = deleteWorkOrder(workOrderToDelete.id, reason);

      // Immediately update local state with the deleted work order marked as archived
      setLocalWorkOrders((prev) =>
        prev.filter((wo) => wo.id !== workOrderToDelete.id)
      );

      // If there's a related invoice, update it too
      if (relatedInvoice) {
        setLocalInvoices((prev) =>
          prev.filter((inv) => inv.invoiceId !== relatedInvoice.invoiceId)
        );
      }

      // Update archived items by refreshing the data from Supabase
      setRefreshTrigger((prev) => prev + 1);

      if (refundId) {
        // A refund was processed
        toast.success(
          language === "ar"
            ? "تم حذف الطلب ومعالجة الاسترداد بنجاح"
            : "Order deleted and refund processed successfully"
        );
      } else {
        // No refund was needed
        toast.success(
          language === "ar"
            ? "تم حذف الطلب بنجاح"
            : "Order deleted successfully"
        );
      }

      // Close the dialog and reset the work order to delete
      setIsDeleteDialogOpen(false);
      setWorkOrderToDelete(null);

      // Trigger refresh to update UI
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error deleting work order:", error);
      toast.error(
        language === "ar"
          ? "حدث خطأ أثناء حذف الطلب"
          : "Error deleting the order"
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* Friendly info banner — explains what Archive does */}
      <div className="rounded-2xl bg-sky-50 border border-sky-200 p-5 flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-sky-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-slate-900">
            {language === "ar" ? "ميزة حذف الطلبات" : "Order Deletion"}
          </div>
          <div className="text-sm text-slate-600 mt-1 leading-relaxed">
            {language === "ar"
              ? "يمكنك الآن حذف الطلبات وسيتم نقلها تلقائيًا إلى تبويب الأرشيف. سيتم إرجاع أي مدفوعات سابقة."
              : "You can now delete orders. They will move to the Archive tab automatically, and any previous payments will be refunded."}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 rounded-2xl bg-white border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
          <span className="ms-2 text-slate-600 text-base">
            {language === "ar" ? "جاري التحميل..." : "Loading..."}
          </span>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            {localWorkOrders.length > 0 && localInvoices.length > 0 && (
              <PrintOptionsDialog
                workOrder={localWorkOrders[0]}
                invoice={localInvoices[0]}
                patient={patient}
                onPrintWorkOrder={() =>
                  handlePrintWorkOrder(localWorkOrders[0])
                }
                onPrintInvoice={() => handlePrintInvoice(localInvoices[0])}
              >
                <Button className="h-11 px-5 text-base font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm">
                  <Printer className="h-5 w-5 me-2" />
                  {t("print")}
                </Button>
              </PrintOptionsDialog>
            )}
          </div>

          <TabbedTransactions
            key={`transactions-${refreshTrigger}`}
            invoices={activeInvoices}
            workOrders={localWorkOrders.filter((wo) => !wo.isArchived)}
            refundedInvoices={refundedInvoices}
            archivedInvoices={archivedInvoices}
            archivedWorkOrders={archivedWorkOrders}
            patient={patient}
            onDeleteWorkOrder={handleDeleteWorkOrder}
            lastEditTimestamp={lastEditTimestamp}
          />

          {/* Delete Confirmation Dialog */}
          {workOrderToDelete && (
            <DeleteOrderConfirmDialog
              isOpen={isDeleteDialogOpen}
              onClose={() => setIsDeleteDialogOpen(false)}
              onConfirm={confirmDeleteWorkOrder}
              hasPaidAmount={
                !!(
                  localInvoices.find(
                    (inv) => inv.workOrderId === workOrderToDelete?.id
                  )?.deposit > 0
                )
              }
              amountPaid={
                localInvoices.find(
                  (inv) => inv.workOrderId === workOrderToDelete?.id
                )?.deposit
              }
            />
          )}
        </>
      )}
    </div>
  );
};
