import React from "react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { MoenLogo, storeInfo } from "@/assets/logo";
import { useLanguageStore } from "@/store/languageStore";
import {
  CheckCircle2,
  AlertTriangle,
  Calendar,
  User,
  Phone,
  Eye,
  History,
} from "lucide-react";
import { useInventoryStore } from "@/store/inventoryStore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function getLensTypeArabic(type: string): string {
  const typeMap: Record<string, string> = {
    distance: "نظارات للنظر البعيد",
    reading: "نظارات طبية للقراءة",
    progressive: "عدسات تقدمية",
    bifocal: "عدسات ثنائية",
    sunglasses: "عدسات شمسية",
  };

  return typeMap[type.toLowerCase()] || type;
}

function getCoatingArabic(coating: string): string {
  const coatingMap: Record<string, string> = {
    "anti-reflective": "مضاد للانعكاس",
    "blue light": "حماية شاشة",
    "scratch resistant": "ضد الخدش",
    basic: "عادي",
    filter: "فلتر",
    "super filter": "سوبر فلتر",
  };

  return coatingMap[coating.toLowerCase()] || coating;
}

interface CustomWorkOrderReceiptProps {
  workOrder: any;
  invoice?: any;
  patient?: any;
  isPrintable?: boolean;
}

export const CustomWorkOrderReceipt: React.FC<CustomWorkOrderReceiptProps> = ({
  workOrder,
  invoice,
  patient,
  isPrintable = false,
}) => {
  const { language, t } = useLanguageStore();
  const { lensTypes, lensCoatings } = useInventoryStore();
  const isRtl = language === "ar";
  const dirClass = isRtl ? "rtl" : "ltr";

  const patientName =
    patient?.name ||
    invoice?.patientName ||
    workOrder?.patientName ||
    t("anonymous");
  const patientPhone =
    patient?.phone || invoice?.patientPhone || workOrder?.patientPhone;

  let rx: any = null;
  let contactLensRx: any = null;

  if (workOrder?.rx) {
    rx = workOrder.rx;
    console.log("Using RX from workOrder:", rx);
  } else if (
    patient?.rx &&
    Array.isArray(patient.rx) &&
    patient.rx.length > 0
  ) {
    rx = patient.rx[0];
    console.log("Using RX from patient.rx array:", rx);
  } else if (
    patient?.rx &&
    typeof patient.rx === "object" &&
    !Array.isArray(patient.rx)
  ) {
    rx = patient.rx;
    console.log("Using RX from patient.rx object:", rx);
  }

  if (workOrder?.contactLensRx) {
    contactLensRx = workOrder.contactLensRx;
    console.log("Using Contact Lens RX from workOrder:", contactLensRx);
  } else if (invoice?.contactLensRx) {
    contactLensRx = invoice.contactLensRx;
    console.log("Using Contact Lens RX from invoice:", contactLensRx);
  } else if (patient?.contactLensRx) {
    contactLensRx = patient.contactLensRx;
    console.log("Using Contact Lens RX from patient:", contactLensRx);
  }

  if (!rx) {
    console.log("No RX data found, using empty placeholder");
    rx = {
      sphereOD: "—",
      cylOD: "—",
      axisOD: "—",
      sphereOS: "—",
      cylOS: "—",
      axisOS: "—",
      add: "—",
      pd: "—",
    };
  }

  console.log("Work Order RX data:", {
    workOrderRx: workOrder?.rx,
    patientRx: patient?.rx,
    finalRx: rx,
  });

  console.log("Contact lens RX data sources:", {
    workOrderRx: workOrder?.contactLensRx,
    invoiceRx: invoice?.contactLensRx,
    patientRx: patient?.contactLensRx,
    finalContactLensRx: contactLensRx,
  });

  const frameData = {
    brand: workOrder?.frameBrand || invoice?.frameBrand || "",
    model: workOrder?.frameModel || invoice?.frameModel || "",
    color: workOrder?.frameColor || invoice?.frameColor || "",
    size: workOrder?.frameSize || invoice?.frameSize || "",
    price: workOrder?.framePrice || invoice?.framePrice || 0,
  };

  // Ensure contactLensItems is always an array
  const contactLensItems = Array.isArray(invoice?.contactLensItems)
    ? invoice?.contactLensItems
    : Array.isArray(workOrder?.contactLenses)
    ? workOrder?.contactLenses
    : [];
  const isContactLens = contactLensItems && contactLensItems.length > 0;

  const lensType = workOrder?.lensType || invoice?.lensType || "";
  const lensPrice = workOrder?.lensPrice || invoice?.lensPrice || 0;
  const thickness = workOrder?.thickness || invoice?.thickness || "";

  const lastEditedAt = workOrder?.lastEditedAt || invoice?.lastEditedAt;
  const hasBeenEdited = !!lastEditedAt;
  const editHistory = workOrder?.editHistory || invoice?.editHistory || [];
  const latestEdit =
    editHistory.length > 0 ? editHistory[editHistory.length - 1] : null;

  const getLensTypeString = () => {
    if (!lensType) return "";
    if (typeof lensType === "object" && lensType !== null) {
      return lensType.type || lensType.name || "";
    }
    return String(lensType);
  };

  const lensTypeString = getLensTypeString();

  const matchingLens = lensTypes.find((lt) => {
    const ltType = lt.type ? String(lt.type).toLowerCase() : "";
    return ltType === lensTypeString.toLowerCase();
  });

  const lensName = matchingLens?.name || getLensTypeArabic(lensTypeString);

  const coating = workOrder?.coating || invoice?.coating || "";
  const coatingPrice = workOrder?.coatingPrice || invoice?.coatingPrice || 0;
  const coatingColor = workOrder?.coatingColor || invoice?.coatingColor || "";

  const coatingString =
    typeof coating === "object" ? coating?.name || "" : String(coating);
  const matchingCoating = lensCoatings.find((c) => {
    const cName = c.name ? String(c.name).toLowerCase() : "";
    const cDesc = c.description ? String(c.description).toLowerCase() : "";
    return (
      (cName && coatingString && cName.includes(coatingString.toLowerCase())) ||
      (cDesc && coatingString && cDesc.includes(coatingString.toLowerCase()))
    );
  });

  const coatingName = matchingCoating?.name || getCoatingArabic(coatingString);

  const getColorDisplayName = (colorName: string) => {
    if (!colorName) return "";

    const colorMap: Record<string, { en: string; ar: string }> = {
      Brown: { en: "Brown", ar: "بني" },
      Gray: { en: "Gray", ar: "رمادي" },
      Green: { en: "Green", ar: "أخضر" },
      Blue: { en: "Blue", ar: "أزرق" },
    };

    return colorMap[colorName] || { en: colorName, ar: colorName };
  };

  const colorDisplayName = getColorDisplayName(coatingColor);

  const getColorStyle = (colorName: string) => {
    const colorMap: Record<string, string> = {
      Brown: "#8B4513",
      Gray: "#808080",
      Green: "#006400",
      Blue: "#0000CD",
    };

    return colorMap[colorName] || "transparent";
  };

  const total = invoice?.total || workOrder?.total || 0;
  const deposit = invoice?.deposit || workOrder?.deposit || 0;
  const discount = invoice?.discount || workOrder?.discount || 0;
  const subtotal = total + discount;
  const amountPaid = invoice?.payments
    ? invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)
    : deposit || 0;
  const remaining = total - amountPaid;
  const isPaid = remaining <= 0;

  const orderNumber =
    workOrder?.id ||
    invoice?.workOrderId ||
    `WO${Date.now().toString().slice(-6)}`;

  if (!workOrder && !invoice) {
    return (
      <div
        className={`${dirClass} print-receipt`}
        id="work-order-receipt"
        dir={isRtl ? "rtl" : "ltr"}
        style={{
          width: "74mm",
          maxWidth: "74mm",
          margin: "0 auto",
          backgroundColor: "#FFFBEB",
          padding: "4mm",
          fontSize: "13px",
          border: "1px solid #FDE68A",
          borderRadius: "4px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          fontFamily: "Cairo, sans-serif",
          pageBreakInside: "avoid",
          pageBreakAfter: "always",
        }}
      >
        <div className="flex flex-col items-center justify-center h-full gap-2 py-4">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
          <h3 className="font-bold text-amber-800 text-base text-center">
            {t("startBySelectingClient")}
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${dirClass} print-receipt`}
      id="work-order-receipt"
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        width: "74mm",
        maxWidth: "74mm",
        margin: "0 auto",
        backgroundColor: "white",
        color: "black",
        padding: "2mm",
        fontSize: "14px",
        border: isPrintable ? "none" : "1px solid #ddd",
        borderRadius: isPrintable ? "0" : "4px",
        boxShadow: isPrintable ? "none" : "0 1px 3px rgba(0,0,0,0.1)",
        fontFamily: "Cairo, sans-serif",
        pageBreakInside: "avoid",
        pageBreakAfter: "always",
      }}
    >
      <div className="text-center border-b border-gray-300 pb-2 mb-2">
        <div className="flex justify-center mb-1">
          <MoenLogo className="w-auto h-12" />
        </div>
        <h2 className="font-bold text-lg mb-0">{storeInfo.name}</h2>
        <p className="text-sm font-medium mb-0 text-gray-600">
          {storeInfo.address}
        </p>
        <p className="text-sm font-medium text-gray-600">
          {t("phone")}: {storeInfo.phone}
        </p>
      </div>

      <div className="text-center mb-2">
        <div className="bg-black text-white py-1 px-2 mb-1 font-bold text-base rounded">
          {isRtl ? "أمر عمل | WORK ORDER" : "WORK ORDER | أمر عمل"}
        </div>
        <p className="text-sm mb-0 text-gray-600 font-bold">
          {isRtl ? "ORDER #: " : "رقم الطلب: "}
          <span className="font-bold work-order-number">{orderNumber}</span>
        </p>
        <p className="text-sm text-gray-600 rx-creation-date">
          {format(new Date(), "yyyy-MM-dd HH:mm", { locale: enUS })}
        </p>

        {hasBeenEdited && (
          <div className="mt-1 inline-block">
            <Badge
              variant="outline"
              className="bg-violet-50 text-violet-700 border-violet-200 flex items-center gap-1 text-xs"
            >
              <History className="h-3 w-3" />
              {isRtl ? "تم التعديل" : "Edited"}
              <span className="text-xs ml-1">
                {format(new Date(lastEditedAt), "yyyy-MM-dd HH:mm", {
                  locale: enUS,
                })}
              </span>
            </Badge>

            {latestEdit && latestEdit.notes && (
              <div className="text-xs text-violet-700 mt-0.5">
                {latestEdit.notes}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-2">
        <div className="text-center bg-black text-white py-1 mb-1 font-bold text-base rounded">
          {isRtl
            ? "معلومات المريض | Patient Information"
            : "Patient Information | معلومات المريض"}
        </div>

        <div className="space-y-1 text-sm px-2">
          <div className="flex justify-between items-center">
            <span className="font-bold flex items-center gap-1">
              <User className="h-4 w-4" />{" "}
              {isRtl ? "الاسم | Name" : "Name | الاسم"}:
            </span>
            <span className="font-medium">{patientName}</span>
          </div>

          {patientPhone && (
            <div className="flex justify-between items-center">
              <span className="font-bold flex items-center gap-1">
                <Phone className="h-4 w-4" />{" "}
                {isRtl ? "الهاتف | Phone" : "Phone | الهاتف"}:
              </span>
              <span>{patientPhone}</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="font-bold flex items-center gap-1">
              <Calendar className="h-4 w-4" />{" "}
              {isRtl ? "التاريخ | Date" : "Date | التاريخ"}:
            </span>
            <span>{format(new Date(), "dd/MM/yyyy")}</span>
          </div>
        </div>
      </div>

      <div className="mb-2">
        <div className="text-center bg-black text-white py-1 mb-1 font-bold text-base rounded">
          {isRtl
            ? "تفاصيل الوصفة الطبية | Prescription Details"
            : "Prescription Details | تفاصيل الوصفة الطبية"}
        </div>

        {isContactLens ? (
          <table
            className="w-full border-collapse"
            dir="ltr"
            style={{ direction: "ltr", tableLayout: "fixed" }}
          >
            <thead>
              <tr className="bg-gray-100">
                <th
                  className="p-1 border border-gray-300 text-center font-bold"
                  style={{ width: "15%", fontSize: "13px" }}
                >
                  Eye
                </th>
                <th
                  className="p-1 border border-gray-300 text-center font-bold"
                  style={{ width: "17%", fontSize: "13px" }}
                >
                  SPH
                </th>
                <th
                  className="p-1 border border-gray-300 text-center font-bold"
                  style={{ width: "17%", fontSize: "13px" }}
                >
                  CYL
                </th>
                <th
                  className="p-1 border border-gray-300 text-center font-bold"
                  style={{ width: "17%", fontSize: "13px" }}
                >
                  AXIS
                </th>
                <th
                  className="p-1 border border-gray-300 text-center font-bold"
                  style={{ width: "17%", fontSize: "13px" }}
                >
                  BC
                </th>
                <th
                  className="p-1 border border-gray-300 text-center font-bold"
                  style={{ width: "17%", fontSize: "13px" }}
                >
                  DIA
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  className="p-1 border border-gray-300 font-bold text-center bg-gray-100"
                  style={{ fontSize: "13px" }}
                >
                  OD
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {contactLensRx?.rightEye?.sphere || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {contactLensRx?.rightEye?.cylinder || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {contactLensRx?.rightEye?.axis || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {contactLensRx?.rightEye?.bc || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {contactLensRx?.rightEye?.dia || "—"}
                </td>
              </tr>
              <tr>
                <td
                  className="p-1 border border-gray-300 font-bold text-center bg-gray-100"
                  style={{ fontSize: "13px" }}
                >
                  OS
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {contactLensRx?.leftEye?.sphere || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {contactLensRx?.leftEye?.cylinder || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {contactLensRx?.leftEye?.axis || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {contactLensRx?.leftEye?.bc || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {contactLensRx?.leftEye?.dia || "—"}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table
            className="w-full border-collapse"
            dir="ltr"
            style={{ direction: "ltr", tableLayout: "fixed" }}
          >
            <thead>
              <tr className="bg-gray-100">
                <th
                  className="p-1 border border-gray-300 text-center font-bold"
                  style={{ width: "15%", fontSize: "13px" }}
                >
                  Eye
                </th>
                <th
                  className="p-1 border border-gray-300 text-center font-bold"
                  style={{ width: "17%", fontSize: "13px" }}
                >
                  SPH
                </th>
                <th
                  className="p-1 border border-gray-300 text-center font-bold"
                  style={{ width: "17%", fontSize: "13px" }}
                >
                  CYL
                </th>
                <th
                  className="p-1 border border-gray-300 text-center font-bold"
                  style={{ width: "17%", fontSize: "13px" }}
                >
                  AXIS
                </th>
                <th
                  className="p-1 border border-gray-300 text-center font-bold"
                  style={{ width: "17%", fontSize: "13px" }}
                >
                  ADD
                </th>
                <th
                  className="p-1 border border-gray-300 text-center font-bold"
                  style={{ width: "17%", fontSize: "13px" }}
                >
                  PD
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  className="p-1 border border-gray-300 font-bold text-center bg-gray-100"
                  style={{ fontSize: "13px" }}
                >
                  OD
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {rx?.sphereOD || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {rx?.cylOD || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {rx?.axisOD || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {rx?.addOD || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {rx?.pdRight || "—"}
                </td>
              </tr>
              <tr>
                <td
                  className="p-1 border border-gray-300 font-bold text-center bg-gray-100"
                  style={{ fontSize: "13px" }}
                >
                  OS
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {rx?.sphereOS || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {rx?.cylOS || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {rx?.axisOS || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {rx?.addOS || "—"}
                </td>
                <td
                  className="p-1 border border-gray-300 text-center"
                  style={{ fontSize: "13px" }}
                >
                  {rx?.pdLeft || "—"}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        <div className="mt-1 text-xs flex justify-between px-1">
          <span className="font-medium">
            OD = {isRtl ? "العين اليمنى" : "Right Eye"}
          </span>
          <span className="font-medium">
            OS = {isRtl ? "العين اليسرى" : "Left Eye"}
          </span>
        </div>
      </div>

      <div className="mb-2">
        <div className="text-center bg-black text-white py-1 mb-1 font-bold text-base rounded">
          {isRtl
            ? "تفاصيل المنتج | Product Details"
            : "Product Details | تفاصيل المنتج"}
        </div>

        <div className="space-y-2 text-sm px-1">
          {frameData.brand && !isContactLens && (
            <Card className="mb-1 border border-gray-200 rounded-md">
              <CardContent className="p-1">
                <div className="font-bold border-b border-gray-300 pb-0.5 mb-0.5">
                  {isRtl ? "الإطار | Frame" : "Frame | الإطار"}
                </div>
                <div className="px-1 space-y-0.5 text-sm">
                  <div className="flex justify-between">
                    <span className="font-semibold">
                      {isRtl ? "الماركة | Brand" : "Brand | الماركة"}:
                    </span>
                    <span>{frameData.brand}</span>
                  </div>
                  {frameData.model && (
                    <div className="flex justify-between">
                      <span className="font-semibold">
                        {isRtl ? "الموديل | Model" : "Model | الموديل"}:
                      </span>
                      <span>{frameData.model}</span>
                    </div>
                  )}
                  {frameData.color && (
                    <div className="flex justify-between">
                      <span className="font-semibold">
                        {isRtl ? "اللون | Color" : "Color | اللون"}:
                      </span>
                      <span>{frameData.color}</span>
                    </div>
                  )}
                  {frameData.size && (
                    <div className="flex justify-between">
                      <span className="font-semibold">
                        {isRtl ? "المقاس | Size" : "Size | المقاس"}:
                      </span>
                      <span>{frameData.size}</span>
                    </div>
                  )}
                  {frameData.price > 0 && (
                    <div className="flex justify-between">
                      <span className="font-semibold">
                        {isRtl ? "السعر | Price" : "Price | السعر"}:
                      </span>
                      <span className="font-bold">
                        {frameData.price.toFixed(3)} KWD
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {isContactLens &&
            Array.isArray(contactLensItems) &&
            contactLensItems.length > 0 && (
              <Card className="mb-1 border border-gray-200 rounded-md">
                <CardContent className="p-1">
                  <div className="font-bold border-b border-gray-300 pb-0.5 mb-0.5">
                    {isRtl
                      ? "العدسات اللاصقة | Contact Lenses"
                      : "Contact Lenses | العدسات اللاصقة"}
                  </div>
                  <div className="px-1 space-y-1 text-xs">
                    {contactLensItems.length > 0 ? (
                      contactLensItems.map((lens, idx) => (
                        <div
                          key={idx}
                          className={
                            idx !== 0
                              ? "border-t border-dashed border-gray-200 pt-0.5 mt-0.5"
                              : ""
                          }
                        >
                          <div className="flex justify-between">
                            <span className="font-semibold">
                              {isRtl ? "النوع | Type" : "Type | النوع"}:
                            </span>
                            <span>
                              {lens.brand} {lens.type}
                            </span>
                          </div>
                          {lens.color && (
                            <div className="flex justify-between">
                              <span className="font-semibold">
                                {isRtl ? "اللون | Color" : "Color | اللون"}:
                              </span>
                              <span>{lens.color}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="font-semibold">
                              {isRtl
                                ? "الكمية | Quantity"
                                : "Quantity | الكمية"}
                              :
                            </span>
                            <span>{lens.qty || 1}</span>
                          </div>
                          {lens.price > 0 && (
                            <div className="flex justify-between">
                              <span className="font-semibold">
                                {isRtl
                                  ? "السعر الإفرادي | Unit Price"
                                  : "Unit Price | السعر الإفرادي"}
                                :
                              </span>
                              <span className="font-bold">
                                {lens.price.toFixed(3)} KWD
                              </span>
                            </div>
                          )}
                          {lens.price > 0 && lens.qty > 1 && (
                            <div className="flex justify-between">
                              <span className="font-semibold">
                                {isRtl ? "المجموع | Total" : "Total | المجموع"}:
                              </span>
                              <span className="font-bold">
                                {(lens.price * (lens.qty || 1)).toFixed(3)} KWD
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 text-center py-1">
                        {isRtl
                          ? "لا توجد بيانات للعدسات اللاصقة"
                          : "No contact lens data available"}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

          {!isContactLens && lensTypeString && (
            <Card className="mb-1 border border-gray-200 rounded-md">
              <CardContent className="p-1">
                <div className="font-bold border-b border-gray-300 pb-0.5 mb-0.5">
                  {isRtl ? "العدسات | Lenses" : "Lenses | العدسات"}
                </div>
                <div className="px-1 space-y-0.5 text-sm">
                  <div className="flex justify-between">
                    <span className="font-semibold">
                      {isRtl ? "النوع | Type" : "Type | النوع"}:
                    </span>
                    <span>{lensName}</span>
                  </div>
                  {thickness && (
                    <div className="flex justify-between">
                      <span className="font-semibold">
                        {isRtl ? "السماكة | Thickness" : "Thickness | السماكة"}:
                      </span>
                      <span>{thickness}</span>
                    </div>
                  )}
                  {lensPrice > 0 && (
                    <div className="flex justify-between">
                      <span className="font-semibold">
                        {isRtl ? "السعر | Price" : "Price | السعر"}:
                      </span>
                      <span className="font-bold">
                        {lensPrice.toFixed(3)} KWD
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!isContactLens && coating && (
            <Card className="mb-1 border border-gray-200 rounded-md">
              <CardContent className="p-1">
                <div className="font-bold border-b border-gray-300 pb-0.5 mb-0.5">
                  {isRtl ? "الطلاء | Coating" : "Coating | الطلاء"}
                </div>
                <div className="px-1 space-y-0.5 text-sm">
                  <div className="flex justify-between">
                    <span className="font-semibold">
                      {isRtl ? "النوع | Type" : "Type | النوع"}:
                    </span>
                    <span>{coatingName}</span>
                  </div>

                  {coatingColor && (
                    <>
                      <div className="flex justify-between">
                        <span className="font-semibold">
                          {isRtl ? "اللون | Color" : "Color | اللون"}:
                        </span>
                        <span>
                          {typeof colorDisplayName === "object"
                            ? isRtl
                              ? colorDisplayName.ar
                              : colorDisplayName.en
                            : colorDisplayName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1 p-1 bg-gray-50 rounded border border-gray-200">
                        <span className="font-semibold text-xs">
                          {isRtl
                            ? "عرض اللون | Color Preview"
                            : "Color Preview | عرض اللون"}
                        </span>
                        <div
                          className="w-6 h-6 rounded-full border border-gray-300 color-preview"
                          style={{
                            backgroundColor: getColorStyle(coatingColor),
                          }}
                        ></div>
                      </div>
                    </>
                  )}

                  {coatingPrice > 0 && (
                    <div className="flex justify-between">
                      <span className="font-semibold">
                        {isRtl ? "السعر | Price" : "Price | السعر"}:
                      </span>
                      <span className="font-bold">
                        {coatingPrice.toFixed(3)} KWD
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="mb-2">
        <div className="text-center bg-black text-white py-1 mb-1 font-bold text-base rounded">
          {isRtl
            ? "معلومات الدفع | Payment Information"
            : "Payment Information | معلومات الدفع"}
        </div>

        <Card className="border border-gray-200 rounded-md">
          <CardContent className="p-1">
            <div className="space-y-0.5 text-sm">
              <div className="flex justify-between">
                <span className="font-bold">
                  {isRtl
                    ? "المجموع الفرعي | Subtotal"
                    : "Subtotal | المجموع الفرعي"}
                  :
                </span>
                <span className="font-semibold">{subtotal.toFixed(3)} KWD</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between">
                  <span className="font-bold">
                    {isRtl ? "الخصم | Discount" : "Discount | الخصم"}:
                  </span>
                  <span className="font-semibold">
                    -{discount.toFixed(3)} KWD
                  </span>
                </div>
              )}

              <div className="flex justify-between border-b border-gray-200 pb-0.5">
                <span className="font-bold">
                  {isRtl ? "الإجمالي | Total" : "Total | الإجمالي"}:
                </span>
                <span className="font-semibold">{total.toFixed(3)} KWD</span>
              </div>

              <div className="flex justify-between">
                <span className="font-bold">
                  {isRtl ? "المدفوع | Paid" : "Paid | المدفوع"}:
                </span>
                <span className="font-semibold">
                  {amountPaid.toFixed(3)} KWD
                </span>
              </div>

              {isPaid ? (
                <div className="mt-1 p-1 bg-green-100 rounded border border-green-300 text-center">
                  <div className="flex items-center justify-center gap-1 text-green-800 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isRtl
                        ? "تم الدفع بالكامل | PAID IN FULL"
                        : "PAID IN FULL | تم الدفع بالكامل"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-1">
                  <div
                    className="p-1 bg-[#FFDEE2] rounded border border-red-300 text-center"
                    style={{ backgroundColor: "#FFDEE2" }}
                  >
                    <div className="font-bold text-red-700 text-sm">
                      {isRtl
                        ? "المبلغ المتبقي | REMAINING AMOUNT"
                        : "REMAINING AMOUNT | المبلغ المتبقي"}
                    </div>
                    <div className="text-base font-bold text-red-800">
                      {remaining.toFixed(3)} KWD
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-2">
        <div className="text-center bg-black text-white py-1 mb-1 font-bold text-base rounded">
          {isRtl
            ? "تأكيد الجودة | Quality Confirmation"
            : "Quality Confirmation | تأكيد الجودة"}
        </div>

        <div className="flex gap-2 mb-2">
          <div className="flex-1 border border-gray-300 rounded p-1">
            <div className="text-center text-xs font-bold mb-1">
              {isRtl ? "توقيع القائم بالعمل" : "Technician Signature"}
            </div>
            <div className="h-7 border border-dashed border-gray-400 rounded-sm"></div>
          </div>
          <div className="flex-1 border border-gray-300 rounded p-1">
            <div className="text-center text-xs font-bold mb-1">
              {isRtl ? "توقيع المشرف" : "Supervisor Signature"}
            </div>
            <div className="h-7 border border-dashed border-gray-400 rounded-sm"></div>
          </div>
        </div>

        <div className="border border-gray-300 rounded p-1 mb-2">
          <div className="text-center text-xs font-bold mb-1">
            {isRtl ? "ملاحظات | Notes" : "Notes | ملاحظات"}
          </div>
          <div className="min-h-[40px] p-1 border border-gray-300 rounded-sm text-xs">
            {workOrder?.notes || ""}
          </div>
        </div>

        <div className="text-center text-xs">
          <p className="mb-0">{storeInfo.footer1}</p>
          <p className="mb-0">{storeInfo.footer2}</p>
        </div>
      </div>
    </div>
  );
};
