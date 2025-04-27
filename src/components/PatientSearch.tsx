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
import { PlusCircle, Eye, Loader2 } from "lucide-react";
import { AddRxDialog } from "./AddRxDialog";
import { AddContactLensRxDialog } from "./AddContactLensRxDialog";
import {
  Patient,
  ContactLensPrescription,
  GlassesPrescription,
} from "@/integrations/supabase/schema";
import * as patientService from "@/services/patientService";

// Interface for patient data shown in search results
interface PatientWithMeta extends Patient {
  lastVisit?: string;
  avatar?: string;
}

export const PatientSearch: React.FC = () => {
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

      // Map patients properly to match the PatientWithMeta interface
      const results = patients.map((patient) => {
        return {
          ...patient,
          id: patient.id,
          full_name: patient.full_name,
          phone_number: patient.phone_number,
          date_of_birth: patient.date_of_birth,
          // Add any derived fields needed for display
          lastVisit: undefined, // We'll get this from invoices if needed
        };
      });

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

      // Get invoice data (still using the local store for now)
      refreshPatientData(patient.id);
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

  return (
    <div className="space-y-6">
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

      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-[90vw] max-h-[90vh] overflow-y-auto p-4 lg:p-6">
          {selectedPatient && patientDetails && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {language === "ar" ? "ملف العميل" : "Client Profile"}
                </DialogTitle>
                <DialogDescription>
                  {language === "ar"
                    ? "تفاصيل بيانات العميل وسجل المعاملات"
                    : "Client details and transaction history"}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 py-4">
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

                <div className="md:col-span-2">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-base font-medium text-indigo-700">
                      {language === "ar" ? "الوصفة الطبية" : "Prescription"}
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setIsAddRxDialogOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        size="sm"
                      >
                        <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                        {language === "ar"
                          ? "إضافة وصفة نظارات"
                          : "Add Glasses RX"}
                      </Button>
                      <Button
                        onClick={() => setIsAddContactLensRxDialogOpen(true)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
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

          {isLoading && (
            <div className="flex justify-center p-12">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
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
