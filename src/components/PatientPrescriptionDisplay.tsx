import React, { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import { useLanguageStore } from "@/store/languageStore";
import {
  RxData,
  RxHistoryItem,
  ContactLensRx,
  ContactLensRxHistoryItem,
} from "@/store/patientStore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Printer,
  FileText,
  Eye,
  Clock,
  History,
  Contact,
  Glasses,
} from "lucide-react";

interface PatientPrescriptionDisplayProps {
  rx: RxData;
  rxHistory?: RxHistoryItem[];
  contactLensRx?: ContactLensRx;
  contactLensRxHistory?: ContactLensRxHistoryItem[];
  onPrintPrescription: (historicalRx?: RxData | RxHistoryItem) => void;
  onPrintContactLensPrescription?: (
    historicalContactLensRx?: ContactLensRx | ContactLensRxHistoryItem
  ) => void;
}

// Shared RX table used for both glasses and contacts.
// Big cells, big fonts, clear Right/Left eye labels with colored dots.
const RxTable: React.FC<{
  columns: { key: string; label: string }[];
  odValues: (string | undefined)[];
  osValues: (string | undefined)[];
  isRtl: boolean;
  tone: "amber" | "sky";
}> = ({ columns, odValues, osValues, isRtl, tone }) => {
  const toneMap = {
    amber: {
      headBg: "bg-amber-600",
      headText: "text-white",
      odBg: "bg-amber-50/60",
      osBg: "bg-white",
      dotOD: "bg-amber-500",
      dotOS: "bg-slate-400",
      border: "border-amber-200",
    },
    sky: {
      headBg: "bg-sky-600",
      headText: "text-white",
      odBg: "bg-sky-50/60",
      osBg: "bg-white",
      dotOD: "bg-sky-500",
      dotOS: "bg-slate-400",
      border: "border-sky-200",
    },
  };
  const t = toneMap[tone];
  return (
    <div
      className={`rounded-xl overflow-hidden border ${t.border} bg-white shadow-sm`}
    >
      <table className="w-full border-collapse ltr" dir="ltr">
        <thead className={t.headBg}>
          <tr>
            <th
              className={`${t.headText} font-semibold text-sm uppercase tracking-wide p-3 text-start`}
            >
              {isRtl ? "العين" : "Eye"}
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`${t.headText} font-semibold text-sm uppercase tracking-wide p-3 text-center`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className={`${t.odBg} border-b ${t.border}`}>
            <td className="p-3 font-semibold text-slate-800 text-base">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${t.dotOD}`}
                  aria-hidden
                />
                {isRtl ? "اليمنى (OD)" : "Right (OD)"}
              </div>
            </td>
            {odValues.map((v, i) => (
              <td
                key={i}
                className="p-3 text-center font-mono font-semibold text-slate-900 text-lg"
              >
                {v || "—"}
              </td>
            ))}
          </tr>
          <tr className={t.osBg}>
            <td className="p-3 font-semibold text-slate-800 text-base">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${t.dotOS}`}
                  aria-hidden
                />
                {isRtl ? "اليسرى (OS)" : "Left (OS)"}
              </div>
            </td>
            {osValues.map((v, i) => (
              <td
                key={i}
                className="p-3 text-center font-mono font-semibold text-slate-900 text-lg"
              >
                {v || "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export const PatientPrescriptionDisplay: React.FC<
  PatientPrescriptionDisplayProps
> = ({
  rx,
  rxHistory,
  contactLensRx,
  contactLensRxHistory,
  onPrintPrescription,
  onPrintContactLensPrescription,
}) => {
  const { language } = useLanguageStore();
  const isRtl = language === "ar";

  const latestGlassesPrescription = useMemo(() => {
    if (!rxHistory || rxHistory.length === 0) return rx;
    const sortedHistory = [...rxHistory].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    const rxDate = rx.createdAt ? new Date(rx.createdAt).getTime() : 0;
    const latestHistoryDate = sortedHistory[0].createdAt
      ? new Date(sortedHistory[0].createdAt).getTime()
      : 0;
    return latestHistoryDate > rxDate ? sortedHistory[0] : rx;
  }, [rx, rxHistory]);

  const latestContactLensPrescription = useMemo(() => {
    if (!contactLensRx) return null;
    if (!contactLensRxHistory || contactLensRxHistory.length === 0)
      return contactLensRx;
    const sortedHistory = [...contactLensRxHistory].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    const contactRxDate = contactLensRx.createdAt
      ? new Date(contactLensRx.createdAt).getTime()
      : 0;
    const latestHistoryDate = sortedHistory[0].createdAt
      ? new Date(sortedHistory[0].createdAt).getTime()
      : 0;
    return latestHistoryDate > contactRxDate ? sortedHistory[0] : contactLensRx;
  }, [contactLensRx, contactLensRxHistory]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return isRtl ? "تاريخ غير متوفر" : "Date not available";
    try {
      return format(parseISO(dateString), "MM/dd/yyyy", { locale: enUS });
    } catch {
      return isRtl ? "تاريخ غير صالح" : "Invalid date";
    }
  };

  const glassesCols = [
    { key: "sph", label: "SPH" },
    { key: "cyl", label: "CYL" },
    { key: "axis", label: "AXIS" },
    { key: "add", label: "ADD" },
    { key: "pd", label: "PD" },
  ];
  const contactCols = [
    { key: "sph", label: "SPH" },
    { key: "cyl", label: "CYL" },
    { key: "axis", label: "AXIS" },
    { key: "bc", label: "BC" },
    { key: "dia", label: "DIA" },
  ];

  // Pill-style primary tabs (glasses vs contacts)
  const primaryTabClass =
    "flex-1 h-12 rounded-xl text-base font-semibold transition-all flex items-center justify-center gap-2 " +
    "data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-500 " +
    "data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm";

  const subTabClass =
    "flex-1 h-10 rounded-lg text-sm font-semibold transition-all " +
    "data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-500 " +
    "data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm";

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      {/* Primary tab group — glasses / contacts */}
      <Tabs defaultValue="glasses" className="w-full">
        <div className="p-2 bg-slate-100 border-b border-slate-200">
          <TabsList className="w-full bg-transparent p-0 h-auto gap-2">
            <TabsTrigger value="glasses" className={primaryTabClass}>
              <Glasses className="h-5 w-5" />
              {isRtl ? "وصفة النظارات" : "Glasses Prescription"}
            </TabsTrigger>
            <TabsTrigger value="contacts" className={primaryTabClass}>
              <Contact className="h-5 w-5" />
              {isRtl ? "وصفة العدسات اللاصقة" : "Contact Lens Prescription"}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ───── GLASSES ───── */}
        <TabsContent value="glasses" className="mt-0 p-5">
          <Tabs defaultValue="current" className="w-full">
            <div className="p-1 bg-slate-100 rounded-xl mb-4">
              <TabsList className="w-full bg-transparent p-0 h-auto gap-1">
                <TabsTrigger value="current" className={subTabClass}>
                  {isRtl ? "الوصفة الحالية" : "Current"}
                </TabsTrigger>
                <TabsTrigger value="history" className={subTabClass}>
                  {isRtl ? "سجل الوصفات" : "History"}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="current" className="mt-0 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Glasses className="h-5 w-5 text-amber-700" />
                  {isRtl
                    ? "وصفة النظارات الحالية"
                    : "Current Glasses Prescription"}
                </h4>
                <div className="flex items-center gap-1.5 text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                  <Clock className="h-4 w-4" />
                  {latestGlassesPrescription.createdAt
                    ? formatDate(latestGlassesPrescription.createdAt)
                    : isRtl
                    ? "تاريخ غير متوفر"
                    : "Date not available"}
                </div>
              </div>

              <RxTable
                columns={glassesCols}
                odValues={[
                  latestGlassesPrescription.sphereOD,
                  latestGlassesPrescription.cylOD,
                  latestGlassesPrescription.axisOD,
                  latestGlassesPrescription.addOD,
                  latestGlassesPrescription.pdRight,
                ]}
                osValues={[
                  latestGlassesPrescription.sphereOS,
                  latestGlassesPrescription.cylOS,
                  latestGlassesPrescription.axisOS,
                  latestGlassesPrescription.addOS,
                  latestGlassesPrescription.pdLeft,
                ]}
                isRtl={isRtl}
                tone="amber"
              />

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="h-11 px-5 text-base font-semibold border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
                  onClick={() =>
                    onPrintPrescription(latestGlassesPrescription)
                  }
                >
                  <Printer className="h-5 w-5 me-2" />
                  {isRtl ? "طباعة وصفة النظارات" : "Print Glasses RX"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              {rxHistory && rxHistory.length > 0 ? (
                <div className="space-y-4">
                  {rxHistory
                    .slice()
                    .sort((a, b) => {
                      const dateA = a.createdAt
                        ? new Date(a.createdAt).getTime()
                        : 0;
                      const dateB = b.createdAt
                        ? new Date(b.createdAt).getTime()
                        : 0;
                      return dateB - dateA;
                    })
                    .map((historyItem, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                      >
                        <div className="px-4 py-3 flex justify-between items-center bg-slate-50 border-b border-slate-200">
                          <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <History className="h-4 w-4 text-amber-700" />
                            {formatDate(historyItem.createdAt)}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-amber-800 hover:bg-amber-100"
                            onClick={() => onPrintPrescription(historyItem)}
                            aria-label={isRtl ? "طباعة" : "Print"}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="p-4">
                          <RxTable
                            columns={glassesCols}
                            odValues={[
                              historyItem.sphereOD,
                              historyItem.cylOD,
                              historyItem.axisOD,
                              historyItem.addOD,
                              historyItem.pdRight,
                            ]}
                            osValues={[
                              historyItem.sphereOS,
                              historyItem.cylOS,
                              historyItem.axisOS,
                              historyItem.addOS,
                              historyItem.pdLeft,
                            ]}
                            isRtl={isRtl}
                            tone="amber"
                          />
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-10 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  <FileText className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                  <h3 className="text-lg font-semibold mb-1 text-slate-900">
                    {isRtl
                      ? "لا يوجد سجل وصفات نظارات"
                      : "No Glasses Prescription History"}
                  </h3>
                  <p className="text-slate-500 text-sm max-w-md mx-auto">
                    {isRtl
                      ? "لا يوجد سجل وصفات نظارات طبية سابقة لهذا العميل."
                      : "There is no glasses prescription history for this client."}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ───── CONTACTS ───── */}
        <TabsContent value="contacts" className="mt-0 p-5">
          <Tabs defaultValue="current" className="w-full">
            <div className="p-1 bg-slate-100 rounded-xl mb-4">
              <TabsList className="w-full bg-transparent p-0 h-auto gap-1">
                <TabsTrigger value="current" className={subTabClass}>
                  {isRtl ? "الوصفة الحالية" : "Current"}
                </TabsTrigger>
                <TabsTrigger value="history" className={subTabClass}>
                  {isRtl ? "سجل الوصفات" : "History"}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="current" className="mt-0 space-y-4">
              {latestContactLensPrescription ? (
                <>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Eye className="h-5 w-5 text-sky-700" />
                      {isRtl
                        ? "وصفة العدسات اللاصقة الحالية"
                        : "Current Contact Lens Prescription"}
                    </h4>
                    <div className="flex items-center gap-1.5 text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                      <Clock className="h-4 w-4" />
                      {latestContactLensPrescription.createdAt
                        ? formatDate(latestContactLensPrescription.createdAt)
                        : isRtl
                        ? "تاريخ غير متوفر"
                        : "Date not available"}
                    </div>
                  </div>

                  <RxTable
                    columns={contactCols}
                    odValues={[
                      latestContactLensPrescription.rightEye.sphere,
                      latestContactLensPrescription.rightEye.cylinder,
                      latestContactLensPrescription.rightEye.axis,
                      latestContactLensPrescription.rightEye.bc,
                      latestContactLensPrescription.rightEye.dia,
                    ]}
                    osValues={[
                      latestContactLensPrescription.leftEye.sphere,
                      latestContactLensPrescription.leftEye.cylinder,
                      latestContactLensPrescription.leftEye.axis,
                      latestContactLensPrescription.leftEye.bc,
                      latestContactLensPrescription.leftEye.dia,
                    ]}
                    isRtl={isRtl}
                    tone="sky"
                  />

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      className="h-11 px-5 text-base font-semibold border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-900"
                      onClick={() =>
                        onPrintContactLensPrescription?.(
                          latestContactLensPrescription
                        )
                      }
                    >
                      <Printer className="h-5 w-5 me-2" />
                      {isRtl ? "طباعة وصفة العدسات" : "Print Contact Lens RX"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  <Eye className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                  <h3 className="text-lg font-semibold mb-1 text-slate-900">
                    {isRtl
                      ? "لا توجد وصفة عدسات لاصقة"
                      : "No Contact Lens Prescription"}
                  </h3>
                  <p className="text-slate-500 text-sm max-w-md mx-auto">
                    {isRtl
                      ? "لم يتم إضافة وصفة عدسات لاصقة لهذا العميل بعد."
                      : "No contact lens prescription has been added for this client yet."}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              {contactLensRxHistory && contactLensRxHistory.length > 0 ? (
                <div className="space-y-4">
                  {contactLensRxHistory
                    .slice()
                    .sort((a, b) => {
                      const dateA = a.createdAt
                        ? new Date(a.createdAt).getTime()
                        : 0;
                      const dateB = b.createdAt
                        ? new Date(b.createdAt).getTime()
                        : 0;
                      return dateB - dateA;
                    })
                    .map((historyItem, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                      >
                        <div className="px-4 py-3 flex justify-between items-center bg-slate-50 border-b border-slate-200">
                          <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <History className="h-4 w-4 text-sky-700" />
                            {formatDate(historyItem.createdAt)}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-sky-800 hover:bg-sky-100"
                            onClick={() =>
                              onPrintContactLensPrescription?.(historyItem)
                            }
                            aria-label={isRtl ? "طباعة" : "Print"}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="p-4">
                          <RxTable
                            columns={contactCols}
                            odValues={[
                              historyItem.rightEye.sphere,
                              historyItem.rightEye.cylinder,
                              historyItem.rightEye.axis,
                              historyItem.rightEye.bc,
                              historyItem.rightEye.dia,
                            ]}
                            osValues={[
                              historyItem.leftEye.sphere,
                              historyItem.leftEye.cylinder,
                              historyItem.leftEye.axis,
                              historyItem.leftEye.bc,
                              historyItem.leftEye.dia,
                            ]}
                            isRtl={isRtl}
                            tone="sky"
                          />
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-10 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  <FileText className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                  <h3 className="text-lg font-semibold mb-1 text-slate-900">
                    {isRtl
                      ? "لا يوجد سجل وصفات عدسات لاصقة"
                      : "No Contact Lens Prescription History"}
                  </h3>
                  <p className="text-slate-500 text-sm max-w-md mx-auto">
                    {isRtl
                      ? "لا يوجد سجل وصفات عدسات لاصقة سابقة لهذا العميل."
                      : "There is no contact lens prescription history for this client."}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
};
