import React, { useState, useEffect, useCallback } from "react";
import {
  useInvoiceStore,
  Invoice,
  WorkOrder as InvoiceWorkOrder,
} from "@/store/invoiceStore";
import { useLanguageStore } from "@/store/languageStore";
import { printRxReceipt } from "./RxReceiptPrint";
import { PatientNotes } from "./PatientNotes";
import { PatientSearchForm } from "./PatientSearchForm";
import { PatientSearchResults } from "./PatientSearchResults";
import { PatientProfileInfo } from "./PatientProfileInfo";
import { PatientPrescriptionDisplay } from "./PatientPrescriptionDisplay";
import { PatientTransactions } from "./PatientTransactions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PlusCircle, Eye, Loader2, Receipt } from "lucide-react";
import { AddRxDialog } from "./AddRxDialog";
import { AddContactLensRxDialog } from "./AddContactLensRxDialog";
import {
  Patient,
  ContactLensPrescription,
  GlassesPrescription,
} from "@/integrations/supabase/schema";
import * as patientService from "@/services/patientService";
import { supabase } from "@/integrations/supabase/client";

// Module-level set to track deep-link patient IDs we've already opened.
// Prevents React 18 StrictMode (dev) from double-processing the same request
// and, more importantly, prevents the cleanup/cancelled flag from silently
// discarding the open-profile action.
const openedDeepLinkIds = new Set<string>();

// Interface for patient data shown in search results
interface PatientWithMeta extends Patient {
  lastVisit?: string;
  avatar?: string;
}

interface PatientSearchProps {
  /**
   * When set, the search form is hidden and the profile dialog auto-opens
   * for this patient. Lets callers (e.g. the Reports page) reuse this
   * component as a pure profile viewer without a nav.
   */
  embeddedProfilePatientId?: string | null;
  /** Fired when the dialog is closed in embedded mode. */
  onEmbeddedProfileClose?: () => void;
}

export const PatientSearch: React.FC<PatientSearchProps> = ({
  embeddedProfilePatientId = null,
  onEmbeddedProfileClose,
} = {}) => {
  // Embedded mode is determined by the presence of the close callback —
  // a stable signal. We don't want it flipping based on whether a patient
  // is currently loaded, or the search form would flash back on close.
  const embedded = !!onEmbeddedProfileClose;
  const {
    invoices,
    workOrders,
    getInvoicesByPatientId,
    getWorkOrdersByPatientId,
    getArchivedInvoicesByPatientId,
    getArchivedWorkOrdersByPatientId,
  } = useInvoiceStore();
  const { language } = useLanguageStore();

  const [searchResults, setSearchResults] = useState<PatientWithMeta[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedPatient, setSelectedPatient] =
    useState<PatientWithMeta | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [patientInvoices, setPatientInvoices] = useState<Invoice[]>([]);
  const [patientWorkOrders, setPatientWorkOrders] = useState<
    InvoiceWorkOrder[]
  >([]);
  const [archivedInvoices, setArchivedInvoices] = useState<Invoice[]>([]);
  const [archivedWorkOrders, setArchivedWorkOrders] = useState<
    InvoiceWorkOrder[]
  >([]);

  const [isLanguageDialogOpen, setIsLanguageDialogOpen] = useState(false);
  const [isAddRxDialogOpen, setIsAddRxDialogOpen] = useState(false);
  const [isAddContactLensRxDialogOpen, setIsAddContactLensRxDialogOpen] =
    useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Patient data from Supabase
  const [patientDetails, setPatientDetails] = useState<{
    notes: any[];
    glassesPrescriptions: GlassesPrescription[];
    contactLensPrescriptions: ContactLensPrescription[];
  } | null>(null);

  const filterByVisitDate = (
    patients: PatientWithMeta[],
    dateFilter: string
  ) => {
    if (dateFilter === "all_visits") return patients;

    // Apply any filtering logic based on dateFilter
    // Convert to the expected type with required properties
    return patients.map((patient) => ({
      ...patient,
      lastVisit: patient.lastVisit || null,
      skip_dob: patient.skip_dob || false,
      created_at: patient.created_at || "",
      updated_at: patient.updated_at || "",
    }));
  };

  const handleSearch = async (searchTerm: string, visitDateFilter: string) => {
    if (!searchTerm.trim()) {
      toast.error(
        language === "ar"
          ? "الرجاء إدخال مصطلح البحث"
          : "Please enter a search term"
      );
      return;
    }

    setIsLoading(true);

    try {
      const patients = await patientService.searchPatients(searchTerm);

      // Fetch most recent invoice date per patient in a single query
      const patientIds = patients.map((p) => p.id).filter(Boolean);
      const lastVisitMap: Record<string, string> = {};
      if (patientIds.length > 0) {
        // @ts-ignore — invoices table not in generated types
        const { data: invRows, error: invErr } = await supabase
          .from("invoices")
          .select("patient_id, created_at")
          .in("patient_id", patientIds)
          .order("created_at", { ascending: false });
        if (!invErr && invRows) {
          for (const row of invRows as any[]) {
            if (row.patient_id && !lastVisitMap[row.patient_id]) {
              lastVisitMap[row.patient_id] = row.created_at;
            }
          }
        }
      }

      const results = patients.map((patient) => ({
        ...patient,
        id: patient.id,
        full_name: patient.full_name,
        phone_number: patient.phone_number,
        date_of_birth: patient.date_of_birth,
        lastVisit: lastVisitMap[patient.id],
      }));

      let filteredResults = results;
      // Use type assertion to resolve the type compatibility issue
      const processedResults = filterByVisitDate(
        filteredResults,
        visitDateFilter
      ) as PatientWithMeta[];
      setSearchResults(processedResults);
      setShowResults(true);

      if (processedResults.length === 0) {
        toast.info(
          language === "ar"
            ? "لم يتم العثور على نتائج مطابقة"
            : "No matching results found"
        );
      }
    } catch (error) {
      console.error("Error searching patients:", error);
      toast.error(
        language === "ar"
          ? "حدث خطأ أثناء البحث"
          : "An error occurred while searching"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchResults([]);
    setShowResults(false);
  };

  const refreshPatientData = useCallback(
    (patientId: string) => {
      console.log("[PatientSearch] Refreshing patient data for ID:", patientId);
      const patientInvoices = getInvoicesByPatientId(patientId);
      const invoiceWorkOrders = getWorkOrdersByPatientId(patientId);
      const archivedInvs = getArchivedInvoicesByPatientId(patientId);
      const archivedWOs = getArchivedWorkOrdersByPatientId(patientId);

      console.log("[PatientSearch] Updated invoices:", patientInvoices.length);
      console.log(
        "[PatientSearch] Updated work orders:",
        invoiceWorkOrders.length
      );
      console.log("[PatientSearch] Archived invoices:", archivedInvs.length);
      console.log("[PatientSearch] Archived work orders:", archivedWOs.length);

      setPatientInvoices(patientInvoices);
      setPatientWorkOrders(invoiceWorkOrders);
      setArchivedInvoices(archivedInvs);
      setArchivedWorkOrders(archivedWOs);
    },
    [
      getInvoicesByPatientId,
      getWorkOrdersByPatientId,
      getArchivedInvoicesByPatientId,
      getArchivedWorkOrdersByPatientId,
    ]
  );

  const handlePatientSelect = async (patient: PatientWithMeta) => {
    setSelectedPatient(patient);
    setIsLoading(true);

    try {
      // Fetch complete patient data including prescriptions and notes
      const patientData = await patientService.getPatientById(patient.id);

      if (patientData) {
        setPatientDetails({
          notes: patientData.notes,
          glassesPrescriptions: patientData.glassesPrescriptions,
          contactLensPrescriptions: patientData.contactLensPrescriptions,
        });
      }

      // Get invoice data from the local store first...
      refreshPatientData(patient.id);

      // ...then reconcile with Supabase so the profile stats (total spent,
      // purchase count, last visit) always reflect what's actually in the DB,
      // even if the local store hasn't loaded this patient's invoices yet.
      try {
        // @ts-ignore — invoices table not in generated types
        const { data: invRows, error: invErr } = await supabase
          .from("invoices")
          .select("*")
          .eq("patient_id", patient.id)
          .order("created_at", { ascending: false });
        if (!invErr && invRows) {
          const mapped = (invRows as any[]).map((r) => ({
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
            // frame/lens display fields used by transactions list
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
          })) as any[];
          const active = mapped.filter((i) => !i.isArchived);
          const archived = mapped.filter((i) => i.isArchived);
          setPatientInvoices(active);
          setArchivedInvoices(archived);
        }
      } catch (e) {
        console.error("Failed to reconcile invoices from Supabase:", e);
      }

      setIsProfileOpen(true);
    } catch (error) {
      console.error("Error fetching patient details:", error);
      toast.error(
        language === "ar"
          ? "حدث خطأ أثناء تحميل بيانات العميل"
          : "Error loading patient details"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectPrint = (
    printLanguage?: "en" | "ar",
    historicalRx?: any
  ) => {
    if (!selectedPatient || !patientDetails) return;

    const langToPrint = printLanguage || useLanguageStore.getState().language;

    // If we have a specific historical prescription to print, use that
    if (historicalRx) {
      // Adapt the RxData format from PatientPrescriptionDisplay to the format expected by printRxReceipt
      const rxForPrinting = {
        sphereOD: historicalRx.sphereOD || "-",
        cylOD: historicalRx.cylOD || "-",
        axisOD: historicalRx.axisOD || "-",
        addOD: historicalRx.addOD || "-",
        pdRight: historicalRx.pdRight || "-",
        sphereOS: historicalRx.sphereOS || "-",
        cylOS: historicalRx.cylOS || "-",
        axisOS: historicalRx.axisOS || "-",
        addOS: historicalRx.addOS || "-",
        pdLeft: historicalRx.pdLeft || "-",
        createdAt: historicalRx.createdAt,
      };

      printRxReceipt({
        patientName: selectedPatient.full_name,
        patientPhone: selectedPatient.phone_number,
        rx: rxForPrinting,
        forcedLanguage: langToPrint,
      });
      return;
    }

    // Otherwise, use the latest prescription (original behavior)
    // Sort all glasses prescriptions by date (newest first)
    const sortedGlassesPrescriptions = [
      ...patientDetails.glassesPrescriptions,
    ].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA; // Sort descending (newest first)
    });

    // Get the most recent glasses prescription
    const latestGlassesPrescription = sortedGlassesPrescriptions[0];

    if (!latestGlassesPrescription) {
      toast.error(
        language === "ar"
          ? "لا توجد وصفة طبية متاحة للطباعة"
          : "No prescription available to print"
      );
      return;
    }

    // Adapt Supabase rx format to the format expected by printRxReceipt
    const rxForPrinting = {
      sphereOD: latestGlassesPrescription.od_sph || "-",
      cylOD: latestGlassesPrescription.od_cyl || "-",
      axisOD: latestGlassesPrescription.od_axis || "-",
      addOD: latestGlassesPrescription.od_add || "-",
      pdRight: latestGlassesPrescription.od_pd || "-",
      sphereOS: latestGlassesPrescription.os_sph || "-",
      cylOS: latestGlassesPrescription.os_cyl || "-",
      axisOS: latestGlassesPrescription.os_axis || "-",
      addOS: latestGlassesPrescription.os_add || "-",
      pdLeft: latestGlassesPrescription.os_pd || "-",
      createdAt: latestGlassesPrescription.created_at,
    };

    printRxReceipt({
      patientName: selectedPatient.full_name,
      patientPhone: selectedPatient.phone_number,
      rx: rxForPrinting,
      forcedLanguage: langToPrint,
    });
  };

  const handleContactLensPrint = (
    printLanguage?: "en" | "ar",
    historicalContactLensRx?: any
  ) => {
    if (!selectedPatient || !patientDetails) return;

    const langToPrint = printLanguage || useLanguageStore.getState().language;

    // If we have a specific historical contact lens prescription, use that
    if (historicalContactLensRx) {
      // Use the historical contact lens prescription directly (already in the right format)
      // Get the latest glasses prescription for the base rx
      const sortedGlassesPrescriptions = [
        ...patientDetails.glassesPrescriptions,
      ].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA; // Sort descending (newest first)
      });

      const latestGlassesPrescription = sortedGlassesPrescriptions[0];

      // Adapt Supabase rx format to the format expected by printRxReceipt
      const rxForPrinting = latestGlassesPrescription
        ? {
            sphereOD: latestGlassesPrescription.od_sph || "-",
            cylOD: latestGlassesPrescription.od_cyl || "-",
            axisOD: latestGlassesPrescription.od_axis || "-",
            addOD: latestGlassesPrescription.od_add || "-",
            pdRight: latestGlassesPrescription.od_pd || "-",
            sphereOS: latestGlassesPrescription.os_sph || "-",
            cylOS: latestGlassesPrescription.os_cyl || "-",
            axisOS: latestGlassesPrescription.os_axis || "-",
            addOS: latestGlassesPrescription.os_add || "-",
            pdLeft: latestGlassesPrescription.os_pd || "-",
            createdAt: latestGlassesPrescription.created_at,
          }
        : undefined;

      printRxReceipt({
        patientName: selectedPatient.full_name,
        patientPhone: selectedPatient.phone_number,
        rx: rxForPrinting,
        contactLensRx: historicalContactLensRx,
        printContactLens: true,
        forcedLanguage: langToPrint,
      });
      return;
    }

    // Otherwise, use the latest contact lens prescription (original behavior)
    // Sort all contact lens prescriptions by date (newest first)
    const sortedContactLensPrescriptions = [
      ...patientDetails.contactLensPrescriptions,
    ].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA; // Sort descending (newest first)
    });

    // Get the most recent contact lens prescription
    const latestContactLensPrescription = sortedContactLensPrescriptions[0];

    if (!latestContactLensPrescription) {
      toast.error(
        language === "ar"
          ? "لا توجد وصفة عدسات لاصقة متاحة للطباعة"
          : "No contact lens prescription available to print"
      );
      return;
    }

    // Sort glasses prescriptions for base rx
    const sortedGlassesPrescriptions = [
      ...patientDetails.glassesPrescriptions,
    ].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA; // Sort descending (newest first)
    });

    const latestGlassesPrescription = sortedGlassesPrescriptions[0];

    // Adapt Supabase rx format to the format expected by printRxReceipt
    const rxForPrinting = latestGlassesPrescription
      ? {
          sphereOD: latestGlassesPrescription.od_sph || "-",
          cylOD: latestGlassesPrescription.od_cyl || "-",
          axisOD: latestGlassesPrescription.od_axis || "-",
          addOD: latestGlassesPrescription.od_add || "-",
          pdRight: latestGlassesPrescription.od_pd || "-",
          sphereOS: latestGlassesPrescription.os_sph || "-",
          cylOS: latestGlassesPrescription.os_cyl || "-",
          axisOS: latestGlassesPrescription.os_axis || "-",
          addOS: latestGlassesPrescription.os_add || "-",
          pdLeft: latestGlassesPrescription.os_pd || "-",
          createdAt: latestGlassesPrescription.created_at,
        }
      : undefined;

    // Adapt contact lens data
    const contactLensRxForPrinting = {
      rightEye: {
        sphere: latestContactLensPrescription.od_sphere || "-",
        cylinder: latestContactLensPrescription.od_cylinder || "-",
        axis: latestContactLensPrescription.od_axis || "-",
        bc: latestContactLensPrescription.od_base_curve || "-",
        dia: latestContactLensPrescription.od_diameter || "14.2",
      },
      leftEye: {
        sphere: latestContactLensPrescription.os_sphere || "-",
        cylinder: latestContactLensPrescription.os_cylinder || "-",
        axis: latestContactLensPrescription.os_axis || "-",
        bc: latestContactLensPrescription.os_base_curve || "-",
        dia: latestContactLensPrescription.os_diameter || "14.2",
      },
      createdAt: latestContactLensPrescription.created_at,
    };

    printRxReceipt({
      patientName: selectedPatient.full_name,
      patientPhone: selectedPatient.phone_number,
      rx: rxForPrinting,
      contactLensRx: contactLensRxForPrinting,
      printContactLens: true,
      forcedLanguage: langToPrint,
    });
  };

  const handleLanguageSelection = (selectedLanguage: "en" | "ar") => {
    setIsLanguageDialogOpen(false);
    handleDirectPrint(selectedLanguage);
  };

  const handleSaveRx = async (rxData: any) => {
    if (!selectedPatient) return;

    setIsLoading(true);

    try {
      // Convert to the format expected by Supabase
      const prescriptionData = {
        patient_id: selectedPatient.id,
        prescription_date: new Date().toISOString().split("T")[0],
        od_sph: rxData.sphereOD,
        od_cyl: rxData.cylOD,
        od_axis: rxData.axisOD,
        od_add: rxData.addOD,
        od_pd: rxData.pdRight,
        os_sph: rxData.sphereOS,
        os_cyl: rxData.cylOS,
        os_axis: rxData.axisOS,
        os_add: rxData.addOS,
        os_pd: rxData.pdLeft,
      };

      const result = await patientService.addGlassesPrescription(
        prescriptionData
      );

      // Reload patient data to show the new prescription
      const patientData = await patientService.getPatientById(
        selectedPatient.id
      );

      if (patientData) {
        setPatientDetails({
          notes: patientData.notes,
          glassesPrescriptions: patientData.glassesPrescriptions,
          contactLensPrescriptions: patientData.contactLensPrescriptions,
        });
      }

      toast.success(
        language === "ar"
          ? "تم إضافة الوصفة الطبية بنجاح"
          : "Prescription added successfully"
      );
    } catch (error) {
      console.error("Error saving prescription:", error);
      toast.error(
        language === "ar"
          ? "حدث خطأ أثناء حفظ الوصفة الطبية"
          : "Error saving prescription"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveContactLensRx = async (rxData: any) => {
    if (!selectedPatient) return;

    setIsLoading(true);

    try {
      // Convert to the format expected by Supabase
      const prescriptionData = {
        patient_id: selectedPatient.id,
        prescription_date: new Date().toISOString().split("T")[0],
        od_sphere:
          rxData.rightEye.sphere !== "-" ? rxData.rightEye.sphere : null,
        od_cylinder:
          rxData.rightEye.cylinder !== "-" ? rxData.rightEye.cylinder : null,
        od_axis: rxData.rightEye.axis !== "-" ? rxData.rightEye.axis : null,
        od_base_curve: rxData.rightEye.bc !== "-" ? rxData.rightEye.bc : null,
        od_diameter: rxData.rightEye.dia !== "-" ? rxData.rightEye.dia : null,
        os_sphere: rxData.leftEye.sphere !== "-" ? rxData.leftEye.sphere : null,
        os_cylinder:
          rxData.leftEye.cylinder !== "-" ? rxData.leftEye.cylinder : null,
        os_axis: rxData.leftEye.axis !== "-" ? rxData.leftEye.axis : null,
        os_base_curve: rxData.leftEye.bc !== "-" ? rxData.leftEye.bc : null,
        os_diameter: rxData.leftEye.dia !== "-" ? rxData.leftEye.dia : null,
      };

      const result = await patientService.addContactLensPrescription(
        prescriptionData
      );

      // Reload patient data to show the new prescription
      const patientData = await patientService.getPatientById(
        selectedPatient.id
      );

      if (patientData) {
        setPatientDetails({
          notes: patientData.notes,
          glassesPrescriptions: patientData.glassesPrescriptions,
          contactLensPrescriptions: patientData.contactLensPrescriptions,
        });
      }

      toast.success(
        language === "ar"
          ? "تم إضافة وصفة العدسات اللاصقة بنجاح"
          : "Contact lens prescription added successfully"
      );
    } catch (error) {
      console.error("Error saving contact lens prescription:", error);
      toast.error(
        language === "ar"
          ? "حدث خطأ أثناء حفظ وصفة العدسات اللاصقة"
          : "Error saving contact lens prescription"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrescriptionPrint = (historicalRx?: any) => {
    if (historicalRx) {
      // If a specific prescription was provided, print it
      handleDirectPrint(undefined, historicalRx);
    } else {
      // Otherwise, show language selection dialog
      setIsLanguageDialogOpen(true);
    }
  };

  const handleContactLensRxPrint = (historicalContactLensRx?: any) => {
    // Call the existing handler with no language override and the historical prescription
    handleContactLensPrint(undefined, historicalContactLensRx);
  };

  useEffect(() => {
    if (refreshTrigger > 0 && selectedPatient) {
      refreshPatientData(selectedPatient.id);
    }
  }, [refreshTrigger, selectedPatient, refreshPatientData]);

  // (embedded-profile support removed — use the deep-link flow instead)

  // Deep-link from other pages (e.g. Reports → "View profile" button):
  // set localStorage.openPatientId and navigate here; we fetch and open
  // the profile dialog automatically on mount.
  //
  // We deliberately do NOT use a `cancelled` cleanup flag here: in React 18
  // StrictMode the effect runs twice in dev (mount → cleanup → re-mount),
  // and a cancel flag would silently discard the in-flight open-profile
  // request. Instead we dedupe via a module-level Set.
  useEffect(() => {
    const openPendingProfile = async () => {
      try {
        const pendingId = localStorage.getItem("openPatientId");
        if (!pendingId) return;
        if (openedDeepLinkIds.has(pendingId)) return;
        openedDeepLinkIds.add(pendingId);
        localStorage.removeItem("openPatientId");
        const result = await patientService.getPatientById(pendingId);
        const patient = (result as any)?.patient;
        if (!patient) {
          console.warn(
            "Deep-link: patient not found for id",
            pendingId,
            result
          );
          return;
        }
        // Spread the entire patient row so PatientWithMeta carries every
        // field the normal search flow would populate (full_name,
        // phone_number, date_of_birth, created_at, updated_at, skip_dob...).
        // Fetch last-visit from invoices so the profile stats match what
        // the "View Profile" button from the normal search page produces.
        let lastVisit: string | undefined = undefined;
        try {
          // @ts-ignore — invoices table not in generated types
          const { data: lvRows } = await supabase
            .from("invoices")
            .select("created_at")
            .eq("patient_id", patient.id)
            .order("created_at", { ascending: false })
            .limit(1);
          lastVisit = (lvRows as any[])?.[0]?.created_at;
        } catch (lvErr) {
          console.warn("Deep-link: last-visit lookup failed:", lvErr);
        }
        await handlePatientSelect({
          ...patient,
          lastVisit,
        } as PatientWithMeta);
      } catch (e) {
        console.error("Failed to open pending patient profile:", e);
      }
    };
    openPendingProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={embedded ? "" : "space-y-6"}>
      {!embedded && (
        <>
          <PatientSearchForm onSearch={handleSearch} onClear={clearSearch} />

          {isLoading && (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {showResults && !isLoading && (
            <PatientSearchResults
              searchResults={searchResults}
              onSelectPatient={handlePatientSelect}
            />
          )}
        </>
      )}

      <Dialog
        open={isProfileOpen}
        onOpenChange={(open) => {
          setIsProfileOpen(open);
          if (!open) {
            // Reset so reopening for a different patient doesn't flash
            // the previous customer's data before the new fetch resolves.
            setSelectedPatient(null);
            setPatientDetails(null);
            setPatientInvoices([]);
            setPatientWorkOrders([]);
            setArchivedInvoices([]);
            setArchivedWorkOrders([]);
            if (embedded && onEmbeddedProfileClose) {
              onEmbeddedProfileClose();
            }
          }
        }}
      >
        <DialogContent className="max-w-[95vw] lg:max-w-[90vw] max-h-[92vh] overflow-y-auto p-0 bg-stone-50">
          {selectedPatient && patientDetails && (
            <>
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
                      patientId: selectedPatient.id,
                      name: selectedPatient.full_name,
                      phone: selectedPatient.phone_number,
                      dob: selectedPatient.date_of_birth
                        ? new Date(selectedPatient.date_of_birth).toISOString()
                        : "",
                      notes: "",
                      patientNotes: patientDetails.notes.map((note) => ({
                        id: note.id,
                        text: note.note_text,
                        createdAt: note.created_at,
                      })),
                      rx:
                        patientDetails.glassesPrescriptions.length > 0
                          ? {
                              sphereOD:
                                patientDetails.glassesPrescriptions[0].od_sph ||
                                "",
                              cylOD:
                                patientDetails.glassesPrescriptions[0].od_cyl ||
                                "",
                              axisOD:
                                patientDetails.glassesPrescriptions[0]
                                  .od_axis || "",
                              addOD:
                                patientDetails.glassesPrescriptions[0].od_add ||
                                "",
                              pdRight:
                                patientDetails.glassesPrescriptions[0].od_pd ||
                                "",
                              sphereOS:
                                patientDetails.glassesPrescriptions[0].os_sph ||
                                "",
                              cylOS:
                                patientDetails.glassesPrescriptions[0].os_cyl ||
                                "",
                              axisOS:
                                patientDetails.glassesPrescriptions[0]
                                  .os_axis || "",
                              addOS:
                                patientDetails.glassesPrescriptions[0].os_add ||
                                "",
                              pdLeft:
                                patientDetails.glassesPrescriptions[0].os_pd ||
                                "",
                              createdAt:
                                patientDetails.glassesPrescriptions[0]
                                  .created_at,
                            }
                          : {
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
                      rxHistory: patientDetails.glassesPrescriptions.map(
                        (rx) => ({
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
                      ),
                      contactLensRx:
                        patientDetails.contactLensPrescriptions.length > 0
                          ? {
                              rightEye: {
                                sphere:
                                  patientDetails.contactLensPrescriptions[0]
                                    .od_sphere || "",
                                cylinder:
                                  patientDetails.contactLensPrescriptions[0]
                                    .od_cylinder || "",
                                axis:
                                  patientDetails.contactLensPrescriptions[0]
                                    .od_axis || "",
                                bc:
                                  patientDetails.contactLensPrescriptions[0]
                                    .od_base_curve || "",
                                dia:
                                  patientDetails.contactLensPrescriptions[0]
                                    .od_diameter || "",
                              },
                              leftEye: {
                                sphere:
                                  patientDetails.contactLensPrescriptions[0]
                                    .os_sphere || "",
                                cylinder:
                                  patientDetails.contactLensPrescriptions[0]
                                    .os_cylinder || "",
                                axis:
                                  patientDetails.contactLensPrescriptions[0]
                                    .os_axis || "",
                                bc:
                                  patientDetails.contactLensPrescriptions[0]
                                    .os_base_curve || "",
                                dia:
                                  patientDetails.contactLensPrescriptions[0]
                                    .os_diameter || "",
                              },
                              createdAt:
                                patientDetails.contactLensPrescriptions[0]
                                  .created_at,
                            }
                          : undefined,
                      contactLensRxHistory:
                        patientDetails.contactLensPrescriptions.map((rx) => ({
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
                        })),
                      createdAt: selectedPatient.created_at,
                    }}
                    invoices={patientInvoices}
                    onPrintPrescription={handlePrescriptionPrint}
                  />
                </div>

                <div className="md:col-span-2 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
                        <Receipt className="h-5 w-5 text-amber-700" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">
                          {language === "ar" ? "الوصفة الطبية" : "Prescription"}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {language === "ar"
                            ? "أضف أو اعرض وصفات النظارات والعدسات"
                            : "Add or view glasses and lens prescriptions"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={() => setIsAddRxDialogOpen(true)}
                        className="h-11 px-4 text-base font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                      >
                        <PlusCircle className="h-5 w-5 me-2" />
                        {language === "ar"
                          ? "إضافة وصفة نظارات"
                          : "Add Glasses RX"}
                      </Button>
                      <Button
                        onClick={() => setIsAddContactLensRxDialogOpen(true)}
                        className="h-11 px-4 text-base font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
                      >
                        <Eye className="h-5 w-5 me-2" />
                        {language === "ar"
                          ? "إضافة وصفة عدسات"
                          : "Add Contact Lens RX"}
                      </Button>
                    </div>
                  </div>

                  <PatientPrescriptionDisplay
                    rx={{
                      sphereOD:
                        patientDetails.glassesPrescriptions[0]?.od_sph || "",
                      cylOD:
                        patientDetails.glassesPrescriptions[0]?.od_cyl || "",
                      axisOD:
                        patientDetails.glassesPrescriptions[0]?.od_axis || "",
                      addOD:
                        patientDetails.glassesPrescriptions[0]?.od_add || "",
                      pdRight:
                        patientDetails.glassesPrescriptions[0]?.od_pd || "",
                      sphereOS:
                        patientDetails.glassesPrescriptions[0]?.os_sph || "",
                      cylOS:
                        patientDetails.glassesPrescriptions[0]?.os_cyl || "",
                      axisOS:
                        patientDetails.glassesPrescriptions[0]?.os_axis || "",
                      addOS:
                        patientDetails.glassesPrescriptions[0]?.os_add || "",
                      pdLeft:
                        patientDetails.glassesPrescriptions[0]?.os_pd || "",
                    }}
                    rxHistory={patientDetails.glassesPrescriptions.map(
                      (rx) => ({
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
                      patientDetails.contactLensPrescriptions[0]
                        ? {
                            rightEye: {
                              sphere:
                                patientDetails.contactLensPrescriptions[0]
                                  .od_sphere || "",
                              cylinder:
                                patientDetails.contactLensPrescriptions[0]
                                  .od_cylinder || "",
                              axis:
                                patientDetails.contactLensPrescriptions[0]
                                  .od_axis || "",
                              bc:
                                patientDetails.contactLensPrescriptions[0]
                                  .od_base_curve || "",
                              dia:
                                patientDetails.contactLensPrescriptions[0]
                                  .od_diameter || "",
                            },
                            leftEye: {
                              sphere:
                                patientDetails.contactLensPrescriptions[0]
                                  .os_sphere || "",
                              cylinder:
                                patientDetails.contactLensPrescriptions[0]
                                  .os_cylinder || "",
                              axis:
                                patientDetails.contactLensPrescriptions[0]
                                  .os_axis || "",
                              bc:
                                patientDetails.contactLensPrescriptions[0]
                                  .os_base_curve || "",
                              dia:
                                patientDetails.contactLensPrescriptions[0]
                                  .os_diameter || "",
                            },
                            createdAt:
                              patientDetails.contactLensPrescriptions[0]
                                .created_at,
                          }
                        : undefined
                    }
                    contactLensRxHistory={patientDetails.contactLensPrescriptions.map(
                      (rx) => ({
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
                      })
                    )}
                    onPrintPrescription={handlePrescriptionPrint}
                    onPrintContactLensPrescription={handleContactLensRxPrint}
                  />

                  <PatientTransactions
                    key={`transactions-${refreshTrigger}`}
                    workOrders={patientWorkOrders}
                    invoices={patientInvoices}
                    patient={{
                      patientId: selectedPatient.id,
                      name: selectedPatient.full_name,
                      phone: selectedPatient.phone_number,
                      dob: selectedPatient.date_of_birth
                        ? new Date(selectedPatient.date_of_birth).toISOString()
                        : "",
                      notes: "",
                      rx:
                        patientDetails.glassesPrescriptions.length > 0
                          ? {
                              sphereOD:
                                patientDetails.glassesPrescriptions[0].od_sph ||
                                "",
                              cylOD:
                                patientDetails.glassesPrescriptions[0].od_cyl ||
                                "",
                              axisOD:
                                patientDetails.glassesPrescriptions[0]
                                  .od_axis || "",
                              addOD:
                                patientDetails.glassesPrescriptions[0].od_add ||
                                "",
                              pdRight:
                                patientDetails.glassesPrescriptions[0].od_pd ||
                                "",
                              sphereOS:
                                patientDetails.glassesPrescriptions[0].os_sph ||
                                "",
                              cylOS:
                                patientDetails.glassesPrescriptions[0].os_cyl ||
                                "",
                              axisOS:
                                patientDetails.glassesPrescriptions[0]
                                  .os_axis || "",
                              addOS:
                                patientDetails.glassesPrescriptions[0].os_add ||
                                "",
                              pdLeft:
                                patientDetails.glassesPrescriptions[0].os_pd ||
                                "",
                            }
                          : undefined,
                      createdAt: selectedPatient.created_at,
                    }}
                  />
                </div>
              </div>

              <div className="mt-6">
                <PatientNotes patientId={selectedPatient.id} />
              </div>
            </>
          )}

          {/* Show a spinner whenever the dialog is open but the patient data
              hasn't arrived yet — avoids an empty dialog flash while the
              Supabase fetches resolve. */}
          {(isLoading || !selectedPatient || !patientDetails) && (
            <div className="flex flex-col items-center justify-center gap-3 p-16">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-sm text-slate-500">
                {language === "ar"
                  ? "جارٍ تحميل ملف العميل..."
                  : "Loading customer profile..."}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isLanguageDialogOpen}
        onOpenChange={setIsLanguageDialogOpen}
      >
        <DialogContent className="max-w-md z-[100]">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "اختر لغة الطباعة" : "Select Print Language"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "الرجاء اختيار لغة طباعة الوصفة الطبية"
                : "Please select the language for printing the prescription"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              onClick={() => handleLanguageSelection("en")}
            >
              <img src="/placeholdr.svg" alt="" className="w-5 h-5 mr-2" />
              English
            </Button>
            <Button
              variant="outline"
              onClick={() => handleLanguageSelection("ar")}
            >
              <img src="/placeholdr.svg" alt="" className="w-5 h-5 ml-2" />
              العربية
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedPatient && patientDetails && (
        <>
          <AddRxDialog
            isOpen={isAddRxDialogOpen}
            onClose={() => setIsAddRxDialogOpen(false)}
            onSave={handleSaveRx}
            patientId={selectedPatient.id}
            initialRx={
              patientDetails.glassesPrescriptions.length > 0
                ? {
                    sphereOD:
                      patientDetails.glassesPrescriptions[0].od_sph || "",
                    cylOD: patientDetails.glassesPrescriptions[0].od_cyl || "",
                    axisOD:
                      patientDetails.glassesPrescriptions[0].od_axis || "",
                    addOD: patientDetails.glassesPrescriptions[0].od_add || "",
                    pdRight: patientDetails.glassesPrescriptions[0].od_pd || "",
                    sphereOS:
                      patientDetails.glassesPrescriptions[0].os_sph || "",
                    cylOS: patientDetails.glassesPrescriptions[0].os_cyl || "",
                    axisOS:
                      patientDetails.glassesPrescriptions[0].os_axis || "",
                    addOS: patientDetails.glassesPrescriptions[0].os_add || "",
                    pdLeft: patientDetails.glassesPrescriptions[0].os_pd || "",
                  }
                : undefined
            }
          />

          <AddContactLensRxDialog
            isOpen={isAddContactLensRxDialogOpen}
            onClose={() => setIsAddContactLensRxDialogOpen(false)}
            onSave={handleSaveContactLensRx}
            patientId={selectedPatient.id}
            initialRx={
              patientDetails.contactLensPrescriptions.length > 0
                ? {
                    rightEye: {
                      sphere:
                        patientDetails.contactLensPrescriptions[0].od_sphere ||
                        "",
                      cylinder:
                        patientDetails.contactLensPrescriptions[0]
                          .od_cylinder || "",
                      axis:
                        patientDetails.contactLensPrescriptions[0].od_axis ||
                        "",
                      bc:
                        patientDetails.contactLensPrescriptions[0]
                          .od_base_curve || "",
                      dia:
                        patientDetails.contactLensPrescriptions[0]
                          .od_diameter || "",
                    },
                    leftEye: {
                      sphere:
                        patientDetails.contactLensPrescriptions[0].os_sphere ||
                        "",
                      cylinder:
                        patientDetails.contactLensPrescriptions[0]
                          .os_cylinder || "",
                      axis:
                        patientDetails.contactLensPrescriptions[0].os_axis ||
                        "",
                      bc:
                        patientDetails.contactLensPrescriptions[0]
                          .os_base_curve || "",
                      dia:
                        patientDetails.contactLensPrescriptions[0]
                          .od_diameter || "",
                    },
                  }
                : undefined
            }
          />
        </>
      )}
    </div>
  );
};
