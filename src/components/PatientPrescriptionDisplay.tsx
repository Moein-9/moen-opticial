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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Printer,
  FileText,
  Receipt,
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
  const { language, t } = useLanguageStore();

  // Get the latest glasses prescription (either current or most recent from history)
  const latestGlassesPrescription = useMemo(() => {
    if (!rxHistory || rxHistory.length === 0) return rx;

    const sortedHistory = [...rxHistory].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA; // Sort descending (newest first)
    });

    const rxDate = rx.createdAt ? new Date(rx.createdAt).getTime() : 0;
    const latestHistoryDate = sortedHistory[0].createdAt
      ? new Date(sortedHistory[0].createdAt).getTime()
      : 0;

    return latestHistoryDate > rxDate ? sortedHistory[0] : rx;
  }, [rx, rxHistory]);

  // Get the latest contact lens prescription (either current or most recent from history)
  const latestContactLensPrescription = useMemo(() => {
    if (!contactLensRx) return null;
    if (!contactLensRxHistory || contactLensRxHistory.length === 0)
      return contactLensRx;

    const sortedHistory = [...contactLensRxHistory].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA; // Sort descending (newest first)
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
    if (!dateString)
      return language === "ar" ? "تاريخ غير متوفر" : "Date not available";
    try {
      // Always use English locale for date formatting to ensure MM/DD/YYYY format
      return format(parseISO(dateString), "MM/dd/yyyy", { locale: enUS });
    } catch (error) {
      return language === "ar" ? "تاريخ غير صالح" : "Invalid date";
    }
  };

  return (
    <Card className="border-0 shadow-sm rounded-lg overflow-hidden mb-4">
      <CardHeader className="pb-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg p-3">
        <CardTitle className="text-base flex items-center gap-1.5">
          <Receipt className="h-4 w-4" />
          {language === "ar" ? "الوصفة الطبية" : "Prescription Information"}
        </CardTitle>
        <CardDescription className="text-indigo-100 text-xs">
          {language === "ar"
            ? "بيانات الوصفة الطبية للنظارات والعدسات اللاصقة"
            : "Glasses and contact lens prescription information"}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="glasses" className="w-full">
          <TabsList className="w-full grid grid-cols-2 rounded-none bg-gradient-to-r from-indigo-50 to-purple-50 p-0 h-10">
            <TabsTrigger
              value="glasses"
              className="rounded-none h-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=inactive]:text-indigo-600 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 transition-all flex items-center gap-1.5"
            >
              <Glasses className="h-4 w-4" />
              {language === "ar" ? "وصفة النظارات" : "Glasses Prescription"}
            </TabsTrigger>
            <TabsTrigger
              value="contacts"
              className="rounded-none h-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=inactive]:text-green-600 data-[state=active]:border-b-2 data-[state=active]:border-green-600 transition-all flex items-center gap-1.5"
            >
              <Contact className="h-4 w-4" />
              {language === "ar"
                ? "وصفة العدسات اللاصقة"
                : "Contact Lens Prescription"}
            </TabsTrigger>
          </TabsList>

          {/* Glasses Prescription Tab Content */}
          <TabsContent value="glasses" className="mt-0">
            <Tabs defaultValue="current" className="w-full">
              <TabsList className="w-full grid grid-cols-2 rounded-none bg-gradient-to-r from-indigo-50 to-indigo-100 p-0 h-8">
                <TabsTrigger
                  value="current"
                  className="rounded-none border-b-2 border-transparent text-indigo-600 h-full data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 data-[state=active]:bg-white data-[state=active]:shadow-none transition-all text-xs"
                >
                  {language === "ar"
                    ? "الوصفة الحالية"
                    : "Current Prescription"}
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="rounded-none border-b-2 border-transparent text-indigo-600 h-full data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 data-[state=active]:bg-white data-[state=active]:shadow-none transition-all text-xs"
                >
                  {language === "ar" ? "سجل الوصفات" : "Prescription History"}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="current" className="mt-0 p-2">
                <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-indigo-100">
                  <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-1.5 flex justify-between items-center">
                    <h3 className="font-medium text-indigo-700 flex items-center gap-1 text-xs">
                      <Glasses className="h-3 w-3" />
                      {language === "ar"
                        ? "وصفة النظارات الحالية"
                        : "Current Glasses Prescription"}
                    </h3>
                    <div className="text-xs text-indigo-600 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {latestGlassesPrescription.createdAt
                        ? formatDate(latestGlassesPrescription.createdAt)
                        : language === "ar"
                        ? "تاريخ غير متوفر"
                        : "Date not available"}
                    </div>
                  </div>

                  <table className="w-full text-sm compact-table ltr border-collapse">
                    <thead className="bg-indigo-600">
                      <tr>
                        <th className="text-white font-medium text-xs p-1.5 text-left"></th>
                        <th className="text-white font-medium text-xs p-1.5 text-left">
                          SPH
                        </th>
                        <th className="text-white font-medium text-xs p-1.5 text-left">
                          CYL
                        </th>
                        <th className="text-white font-medium text-xs p-1.5 text-left">
                          AXIS
                        </th>
                        <th className="text-white font-medium text-xs p-1.5 text-left">
                          ADD
                        </th>
                        <th className="text-white font-medium text-xs p-1.5 text-left">
                          PD
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-indigo-100 bg-indigo-50/50">
                        <td className="font-medium text-indigo-800 p-1.5 text-xs">
                          {language === "ar"
                            ? "العين اليمنى (OD)"
                            : "Right Eye (OD)"}
                        </td>
                        <td className="font-medium p-1.5 text-xs">
                          {latestGlassesPrescription.sphereOD || "-"}
                        </td>
                        <td className="font-medium p-1.5 text-xs">
                          {latestGlassesPrescription.cylOD || "-"}
                        </td>
                        <td className="font-medium p-1.5 text-xs">
                          {latestGlassesPrescription.axisOD || "-"}
                        </td>
                        <td className="font-medium p-1.5 text-xs">
                          {latestGlassesPrescription.addOD || "-"}
                        </td>
                        <td className="font-medium p-1.5 text-xs">
                          {latestGlassesPrescription.pdRight || "-"}
                        </td>
                      </tr>
                      <tr className="bg-indigo-50/30">
                        <td className="font-medium text-indigo-800 p-1.5 text-xs">
                          {language === "ar"
                            ? "العين اليسرى (OS)"
                            : "Left Eye (OS)"}
                        </td>
                        <td className="font-medium p-1.5 text-xs">
                          {latestGlassesPrescription.sphereOS || "-"}
                        </td>
                        <td className="font-medium p-1.5 text-xs">
                          {latestGlassesPrescription.cylOS || "-"}
                        </td>
                        <td className="font-medium p-1.5 text-xs">
                          {latestGlassesPrescription.axisOS || "-"}
                        </td>
                        <td className="font-medium p-1.5 text-xs">
                          {latestGlassesPrescription.addOS || "-"}
                        </td>
                        <td className="font-medium p-1.5 text-xs">
                          {latestGlassesPrescription.pdLeft || "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-md border-indigo-300 bg-gradient-to-r from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 transition-all shadow-sm h-7 text-xs"
                    onClick={() =>
                      onPrintPrescription(latestGlassesPrescription)
                    }
                  >
                    <Printer
                      className={`h-3 w-3 ${
                        language === "ar" ? "ml-1" : "mr-1"
                      } text-indigo-600`}
                    />
                    {language === "ar"
                      ? "طباعة وصفة النظارات"
                      : "Print Glasses Prescription"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-0 p-2">
                {rxHistory && rxHistory.length > 0 ? (
                  <div className="space-y-2">
                    {rxHistory
                      .slice()
                      .sort((a, b) => {
                        const dateA = a.createdAt
                          ? new Date(a.createdAt).getTime()
                          : 0;
                        const dateB = b.createdAt
                          ? new Date(b.createdAt).getTime()
                          : 0;
                        return dateB - dateA; // Sort descending (newest first)
                      })
                      .map((historyItem, index) => (
                        <div
                          key={index}
                          className="border border-indigo-100 rounded-lg overflow-hidden shadow-sm"
                        >
                          <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 px-2 py-1.5 flex justify-between items-center">
                            <div className="font-medium text-indigo-800 flex items-center gap-1 text-xs">
                              <History className="h-3 w-3 text-indigo-600" />
                              {language === "ar" ? "تاريخ:" : "Date:"}
                            </div>
                            <div className="text-indigo-700 font-medium text-xs">
                              {formatDate(historyItem.createdAt)}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-md text-indigo-600 hover:bg-indigo-100 border-indigo-200 h-6 w-6 p-0"
                              onClick={() => onPrintPrescription(historyItem)}
                            >
                              <Printer className="h-3 w-3" />
                            </Button>
                          </div>
                          <table className="w-full text-xs ltr border-collapse">
                            <thead className="bg-indigo-600">
                              <tr>
                                <th className="text-white font-medium p-1 text-left text-xs"></th>
                                <th className="text-white font-medium p-1 text-left text-xs">
                                  SPH
                                </th>
                                <th className="text-white font-medium p-1 text-left text-xs">
                                  CYL
                                </th>
                                <th className="text-white font-medium p-1 text-left text-xs">
                                  AXIS
                                </th>
                                <th className="text-white font-medium p-1 text-left text-xs">
                                  ADD
                                </th>
                                <th className="text-white font-medium p-1 text-left text-xs">
                                  PD
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-indigo-100 bg-indigo-50/50">
                                <td className="font-medium text-indigo-800 p-1 text-xs">
                                  {language === "ar"
                                    ? "العين اليمنى (OD)"
                                    : "Right Eye (OD)"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.sphereOD || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.cylOD || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.axisOD || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.addOD || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.pdRight || "-"}
                                </td>
                              </tr>
                              <tr className="bg-indigo-50/30">
                                <td className="font-medium text-indigo-800 p-1 text-xs">
                                  {language === "ar"
                                    ? "العين اليسرى (OS)"
                                    : "Left Eye (OS)"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.sphereOS || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.cylOS || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.axisOS || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.addOS || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.pdLeft || "-"}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-4 border rounded-lg bg-gradient-to-r from-gray-50 to-indigo-50/20">
                    <FileText className="h-8 w-8 mx-auto text-indigo-300 mb-2 opacity-70" />
                    <h3 className="text-base font-medium mb-1 text-indigo-700">
                      {language === "ar"
                        ? "لا يوجد سجل وصفات نظارات سابقة"
                        : "No Glasses Prescription History"}
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto text-gray-600 text-xs">
                      {language === "ar"
                        ? "لا يوجد سجل وصفات نظارات طبية سابقة لهذا العميل."
                        : "There is no glasses prescription history for this client."}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Contact Lens Prescription Tab Content */}
          <TabsContent value="contacts" className="mt-0">
            <Tabs defaultValue="current" className="w-full">
              <TabsList className="w-full grid grid-cols-2 rounded-none bg-gradient-to-r from-green-50 to-green-100 p-0 h-8">
                <TabsTrigger
                  value="current"
                  className="rounded-none border-b-2 border-transparent text-green-600 h-full data-[state=active]:border-green-600 data-[state=active]:text-green-700 data-[state=active]:bg-white data-[state=active]:shadow-none transition-all text-xs"
                >
                  {language === "ar"
                    ? "الوصفة الحالية"
                    : "Current Prescription"}
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="rounded-none border-b-2 border-transparent text-green-600 h-full data-[state=active]:border-green-600 data-[state=active]:text-green-700 data-[state=active]:bg-white data-[state=active]:shadow-none transition-all text-xs"
                >
                  {language === "ar" ? "سجل الوصفات" : "Prescription History"}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="current" className="mt-0 p-2">
                {latestContactLensPrescription ? (
                  <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-green-100">
                    <div className="bg-gradient-to-r from-green-50 to-green-100 p-1.5 flex justify-between items-center">
                      <h3 className="font-medium text-green-700 flex items-center gap-1 text-xs">
                        <Eye className="h-3 w-3" />
                        {language === "ar"
                          ? "وصفة العدسات اللاصقة الحالية"
                          : "Current Contact Lens Prescription"}
                      </h3>
                      <div className="text-xs text-green-600 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {latestContactLensPrescription.createdAt
                          ? formatDate(latestContactLensPrescription.createdAt)
                          : language === "ar"
                          ? "تاريخ غير متوفر"
                          : "Date not available"}
                      </div>
                    </div>

                    <table className="w-full text-sm compact-table ltr border-collapse">
                      <thead className="bg-green-600">
                        <tr>
                          <th className="text-white font-medium text-xs p-1.5 text-left"></th>
                          <th className="text-white font-medium text-xs p-1.5 text-left">
                            SPH
                          </th>
                          <th className="text-white font-medium text-xs p-1.5 text-left">
                            CYL
                          </th>
                          <th className="text-white font-medium text-xs p-1.5 text-left">
                            AXIS
                          </th>
                          <th className="text-white font-medium text-xs p-1.5 text-left">
                            BC
                          </th>
                          <th className="text-white font-medium text-xs p-1.5 text-left">
                            DIA
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-green-100 bg-green-50/50">
                          <td className="font-medium text-green-800 p-1.5 text-xs">
                            {language === "ar"
                              ? "العين اليمنى (OD)"
                              : "Right Eye (OD)"}
                          </td>
                          <td className="font-medium p-1.5 text-xs">
                            {latestContactLensPrescription.rightEye.sphere ||
                              "-"}
                          </td>
                          <td className="font-medium p-1.5 text-xs">
                            {latestContactLensPrescription.rightEye.cylinder ||
                              "-"}
                          </td>
                          <td className="font-medium p-1.5 text-xs">
                            {latestContactLensPrescription.rightEye.axis || "-"}
                          </td>
                          <td className="font-medium p-1.5 text-xs">
                            {latestContactLensPrescription.rightEye.bc || "-"}
                          </td>
                          <td className="font-medium p-1.5 text-xs">
                            {latestContactLensPrescription.rightEye.dia || "-"}
                          </td>
                        </tr>
                        <tr className="bg-green-50/30">
                          <td className="font-medium text-green-800 p-1.5 text-xs">
                            {language === "ar"
                              ? "العين اليسرى (OS)"
                              : "Left Eye (OS)"}
                          </td>
                          <td className="font-medium p-1.5 text-xs">
                            {latestContactLensPrescription.leftEye.sphere ||
                              "-"}
                          </td>
                          <td className="font-medium p-1.5 text-xs">
                            {latestContactLensPrescription.leftEye.cylinder ||
                              "-"}
                          </td>
                          <td className="font-medium p-1.5 text-xs">
                            {latestContactLensPrescription.leftEye.axis || "-"}
                          </td>
                          <td className="font-medium p-1.5 text-xs">
                            {latestContactLensPrescription.leftEye.bc || "-"}
                          </td>
                          <td className="font-medium p-1.5 text-xs">
                            {latestContactLensPrescription.leftEye.dia || "-"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 border rounded-lg bg-gradient-to-r from-gray-50 to-green-50/20">
                    <Eye className="h-8 w-8 mx-auto text-green-300 mb-2 opacity-70" />
                    <h3 className="text-base font-medium mb-1 text-green-700">
                      {language === "ar"
                        ? "لا توجد وصفة عدسات لاصقة"
                        : "No Contact Lens Prescription"}
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto text-gray-600 text-xs">
                      {language === "ar"
                        ? "لم يتم إضافة وصفة عدسات لاصقة لهذا العميل بعد."
                        : "No contact lens prescription has been added for this client yet."}
                    </p>
                  </div>
                )}

                {latestContactLensPrescription && (
                  <div className="flex justify-end mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-md border-green-300 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 transition-all shadow-sm h-7 text-xs"
                      onClick={() =>
                        onPrintContactLensPrescription?.(
                          latestContactLensPrescription
                        )
                      }
                    >
                      <Printer
                        className={`h-3 w-3 ${
                          language === "ar" ? "ml-1" : "mr-1"
                        } text-green-600`}
                      />
                      {language === "ar"
                        ? "طباعة وصفة العدسات"
                        : "Print Contact Lens Prescription"}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-0 p-2">
                {contactLensRxHistory && contactLensRxHistory.length > 0 ? (
                  <div className="space-y-2">
                    {contactLensRxHistory
                      .slice()
                      .sort((a, b) => {
                        const dateA = a.createdAt
                          ? new Date(a.createdAt).getTime()
                          : 0;
                        const dateB = b.createdAt
                          ? new Date(b.createdAt).getTime()
                          : 0;
                        return dateB - dateA; // Sort descending (newest first)
                      })
                      .map((historyItem, index) => (
                        <div
                          key={index}
                          className="border border-green-100 rounded-lg overflow-hidden shadow-sm"
                        >
                          <div className="bg-gradient-to-r from-green-50 to-green-100 px-2 py-1.5 flex justify-between items-center">
                            <div className="font-medium text-green-800 flex items-center gap-1 text-xs">
                              <History className="h-3 w-3 text-green-600" />
                              {language === "ar" ? "تاريخ:" : "Date:"}
                            </div>
                            <div className="text-green-700 font-medium text-xs">
                              {formatDate(historyItem.createdAt)}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-md text-green-600 hover:bg-green-100 border-green-200 h-6 w-6 p-0"
                              onClick={() =>
                                onPrintContactLensPrescription?.(historyItem)
                              }
                            >
                              <Printer className="h-3 w-3" />
                            </Button>
                          </div>
                          <table className="w-full text-xs ltr border-collapse">
                            <thead className="bg-green-600">
                              <tr>
                                <th className="text-white font-medium p-1 text-left text-xs"></th>
                                <th className="text-white font-medium p-1 text-left text-xs">
                                  SPH
                                </th>
                                <th className="text-white font-medium p-1 text-left text-xs">
                                  CYL
                                </th>
                                <th className="text-white font-medium p-1 text-left text-xs">
                                  AXIS
                                </th>
                                <th className="text-white font-medium p-1 text-left text-xs">
                                  BC
                                </th>
                                <th className="text-white font-medium p-1 text-left text-xs">
                                  DIA
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-green-100 bg-green-50/50">
                                <td className="font-medium text-green-800 p-1 text-xs">
                                  {language === "ar"
                                    ? "العين اليمنى (OD)"
                                    : "Right Eye (OD)"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.rightEye.sphere || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.rightEye.cylinder || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.rightEye.axis || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.rightEye.bc || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.rightEye.dia || "-"}
                                </td>
                              </tr>
                              <tr className="bg-green-50/30">
                                <td className="font-medium text-green-800 p-1 text-xs">
                                  {language === "ar"
                                    ? "العين اليسرى (OS)"
                                    : "Left Eye (OS)"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.leftEye.sphere || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.leftEye.cylinder || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.leftEye.axis || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.leftEye.bc || "-"}
                                </td>
                                <td className="font-medium p-1 text-xs">
                                  {historyItem.leftEye.dia || "-"}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-4 border rounded-lg bg-gradient-to-r from-gray-50 to-green-50/20">
                    <FileText className="h-8 w-8 mx-auto text-green-300 mb-2 opacity-70" />
                    <h3 className="text-base font-medium mb-1 text-green-700">
                      {language === "ar"
                        ? "لا يوجد سجل وصفات عدسات لاصقة سابقة"
                        : "No Contact Lens Prescription History"}
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto text-gray-600 text-xs">
                      {language === "ar"
                        ? "لا يوجد سجل وصفات عدسات لاصقة سابقة لهذا العميل."
                        : "There is no contact lens prescription history for this client."}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
