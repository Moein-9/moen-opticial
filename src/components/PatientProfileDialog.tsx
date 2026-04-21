import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguageStore } from "@/store/languageStore";
import { supabase } from "@/integrations/supabase/client";
import { getPatientById } from "@/services/patientService";
import { PatientProfileInfo } from "@/components/PatientProfileInfo";
import { PatientPrescriptionDisplay } from "@/components/PatientPrescriptionDisplay";
import { PatientTransactions } from "@/components/PatientTransactions";

// Error boundary wraps the profile subtree so any render throw in
// PatientProfileInfo / PatientPrescriptionDisplay / PatientTransactions
// renders a friendly message instead of killing the whole app (the app
// has no top-level ErrorBoundary).
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

export interface PatientProfileDialogHandle {
  openProfile: (patientId: string) => void;
}

export const PatientProfileDialog = React.forwardRef<
  PatientProfileDialogHandle,
  {}
>((_props, ref) => {
  const { language } = useLanguageStore();

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
      // Supabase `.single()` can return the row as a 1-element array in
      // some supabase-js versions — arrays have no `.id`, which would
      // keep the gate stuck on the spinner. Unwrap defensively.
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

  React.useImperativeHandle(ref, () => ({ openProfile }));

  return (
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
              console.error("[PatientProfileDialog] render error:", err);
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
                  patient={
                    {
                      patientId: profilePatient.id,
                      name: profilePatient.full_name || "—",
                      phone: profilePatient.phone_number || "",
                      dob: profilePatient.date_of_birth
                        ? new Date(profilePatient.date_of_birth).toISOString()
                        : "",
                      notes: "",
                      rx:
                        profileDetails.glassesPrescriptions.length > 0
                          ? {
                              sphereOD:
                                profileDetails.glassesPrescriptions[0].od_sph ||
                                "",
                              cylOD:
                                profileDetails.glassesPrescriptions[0].od_cyl ||
                                "",
                              axisOD:
                                profileDetails.glassesPrescriptions[0]
                                  .od_axis || "",
                              addOD:
                                profileDetails.glassesPrescriptions[0].od_add ||
                                "",
                              pdRight:
                                profileDetails.glassesPrescriptions[0].od_pd ||
                                "",
                              sphereOS:
                                profileDetails.glassesPrescriptions[0].os_sph ||
                                "",
                              cylOS:
                                profileDetails.glassesPrescriptions[0].os_cyl ||
                                "",
                              axisOS:
                                profileDetails.glassesPrescriptions[0]
                                  .os_axis || "",
                              addOS:
                                profileDetails.glassesPrescriptions[0].os_add ||
                                "",
                              pdLeft:
                                profileDetails.glassesPrescriptions[0].os_pd ||
                                "",
                            }
                          : undefined,
                      createdAt: profilePatient.created_at,
                    } as any
                  }
                  invoices={profileInvoices as any}
                  onPrintPrescription={() => {
                    /* printing available from row-level Print dialogs */
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
                  onPrintPrescription={() => {}}
                  onPrintContactLensPrescription={() => {}}
                />

                <PatientTransactions
                  key={`profile-tx-${profilePatient.id}`}
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
                      createdAt: profilePatient.created_at,
                    } as any
                  }
                />
              </div>
            </div>
          </ProfileErrorBoundary>
        )}
      </DialogContent>
    </Dialog>
  );
});

PatientProfileDialog.displayName = "PatientProfileDialog";
