import React from "react";
import { format } from "date-fns";
import { Invoice } from "@/store/invoiceStore";
import {
  CheckCircle2,
  Receipt,
  CreditCard,
  Calendar,
  Phone,
  User,
  UserCircle2,
  RefreshCcw,
} from "lucide-react";
import { ContactLensItem } from "./ContactLensSelector";
import { MoenLogo, storeInfo } from "@/assets/logo";
import { useLanguageStore } from "@/store/languageStore";

interface ReceiptInvoiceProps {
  invoice: Invoice;
  isPrintable?: boolean;

  patientName?: string;
  patientPhone?: string;
  invoiceType?: "glasses" | "contacts" | "exam";
  lensType?: string;
  lensPrice?: number;
  coating?: string;
  coatingPrice?: number;
  coatingColor?: string;
  frame?: {
    brand: string;
    model: string;
    color: string;
    size: string;
    price: number;
  };
  framePrice?: number;
  discount?: number;
  total?: number;
  deposit?: number;
  remaining?: number;
  paymentMethod?: string;
  authNumber?: string;
  contactLenses?: ContactLensItem[];
  serviceName?: string;
  serviceId?: string;
  serviceDescription?: string;
  servicePrice?: number;
}

const getFormattedPaymentMethod = (method: string): string => {
  if (!method) return "";

  const paymentMethodMap: Record<string, string> = {
    Cash: "نقداً",
    KNET: "كي نت",
    "Credit Card": "بطاقة ائتمان",
    "Debit Card": "بطاقة سحب",
    "Bank Transfer": "تحويل بنكي",
  };

  const reversePaymentMethodMap: Record<string, string> = {
    نقداً: "Cash",
    "كي نت": "KNET",
    "بطاقة ائتمان": "Credit Card",
    "بطاقة سحب": "Debit Card",
    "تحويل بنكي": "Bank Transfer",
  };

  const arabicEquivalent = paymentMethodMap[method];
  const englishEquivalent = reversePaymentMethodMap[method];

  if (arabicEquivalent) {
    return `${method} | ${arabicEquivalent}`;
  } else if (englishEquivalent) {
    return `${englishEquivalent} | ${method}`;
  }

  return method;
};

export const ReceiptInvoice: React.FC<ReceiptInvoiceProps> = ({
  invoice,
  isPrintable = false,
  patientName,
  patientPhone,
  invoiceType,
  lensType,
  lensPrice,
  coating,
  coatingPrice,
  coatingColor,
  frame,
  framePrice,
  discount,
  total,
  deposit,
  remaining,
  paymentMethod,
  authNumber,
  contactLenses,
  serviceName,
  serviceId,
  serviceDescription,
  servicePrice,
}) => {
  const { language, t } = useLanguageStore();
  const isRtl = language === "ar";
  const dirClass = isRtl ? "rtl" : "ltr";

  const name = patientName || invoice.patientName;
  const phone = patientPhone || invoice.patientPhone;
  const lens = lensType || invoice.lensType;
  const lensP = lensPrice !== undefined ? lensPrice : invoice.lensPrice;
  const coat = coating || invoice.coating;
  const coatP =
    coatingPrice !== undefined ? coatingPrice : invoice.coatingPrice;
  const coatColor = coatingColor || invoice.coatingColor || "";
  const frameBrand = frame?.brand || invoice.frameBrand;
  const frameModel = frame?.model || invoice.frameModel;
  const frameP = framePrice !== undefined ? framePrice : invoice.framePrice;
  const disc = discount !== undefined ? discount : invoice.discount;
  const tot = total !== undefined ? total : invoice.total;
  const dep = deposit !== undefined ? deposit : invoice.deposit;
  const rem = remaining !== undefined ? remaining : invoice.remaining;
  const payMethod = paymentMethod || invoice.paymentMethod;
  const auth = authNumber || (invoice as any).authNumber;
  const isPaid = rem <= 0 || invoice.isPaid === true;

  const contactLensItems = Array.isArray(contactLenses)
    ? contactLenses
    : Array.isArray(invoice.contactLensItems)
    ? invoice.contactLensItems
    : [];

  const isContactLens =
    invoiceType === "contacts" ||
    invoice.invoiceType === "contacts" ||
    contactLensItems.length > 0;
  const isEyeExam = invoiceType === "exam" || invoice.invoiceType === "exam";

  const service = {
    name: serviceName || invoice.serviceName || "",
    id: serviceId || invoice.serviceId || "",
    description: serviceDescription || invoice.serviceDescription || "",
    price:
      servicePrice !== undefined ? servicePrice : invoice.servicePrice || 0,
  };

  const isRefunded = invoice.isRefunded;
  const refundAmount = invoice.refundAmount || 0;
  const refundDate = invoice.refundDate;
  const refundMethod = invoice.refundMethod;
  const refundReason = invoice.refundReason;

  const subtotal = invoice.total + (disc || 0);
  const showDiscount = disc > 0;

  const addressLines = storeInfo.address.split("\n");

  const getColorStyle = (colorName: string) => {
    if (!colorName) return "transparent";

    const colorMap: Record<string, string> = {
      Brown: "#8B4513",
      Gray: "#808080",
      Green: "#006400",
      Blue: "#0000CD",
    };

    return colorMap[colorName] || "transparent";
  };

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

  const colorDisplayName = getColorDisplayName(coatColor);

  return (
    <div
      className={`${dirClass} print-receipt`}
      id="receipt-invoice"
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        width: "80mm",
        maxWidth: "80mm",
        margin: "0 auto",
        backgroundColor: "white",
        padding: "10px",
        fontSize: "14px",
        border: isPrintable ? "none" : "1px solid #ddd",
        borderRadius: isPrintable ? "0" : "4px",
        boxShadow: isPrintable ? "none" : "0 1px 2px rgba(0,0,0,0.05)",
        fontFamily: isRtl ? "Zain, sans-serif" : "Yrsa, serif",
        pageBreakInside: "avoid",
        pageBreakAfter: "always",
        textAlign: "center",
      }}
    >
      <div className="mb-3">
        <div className="flex justify-center mb-1">
          <MoenLogo className="w-auto h-14" />
        </div>
        <h2 className="font-bold text-xl mb-0">{storeInfo.name}</h2>
        <div className="text-sm font-medium space-y-0.5">
          {Array.isArray(addressLines) &&
            addressLines.map((line, index) => (
              <p key={index} className="m-0 leading-tight">
                {line}
              </p>
            ))}
          <p className="m-0 leading-tight ltr">{storeInfo.phone}</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="inline-flex items-center justify-center gap-1 border-2 border-black px-5 py-2 rounded">
          <Receipt className="w-6 h-6" />
          <span className="font-bold text-lg">{t("invoice")}</span>
        </div>
      </div>

      <div className="mb-3 border-2 border-black rounded p-3">
        <div className="mb-2 border-b border-gray-400 pb-2">
          <div className="flex items-center justify-center gap-1">
            <User className="w-5 h-5" />
            <span className="font-bold text-base">
              {isRtl
                ? "معلومات العميل | Customer Info"
                : "Customer Info | معلومات العميل"}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-1">
              <UserCircle2 className="w-4 h-4" />
              <span className="font-semibold text-sm">
                {isRtl ? "الاسم | Name:" : "Name | الاسم:"}
              </span>
            </div>
            <span className="font-semibold text-sm">{name}</span>
          </div>

          {phone && (
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-1">
                <Phone className="w-4 h-4" />
                <span className="font-semibold text-sm">
                  {isRtl ? "الهاتف | Phone:" : "Phone | الهاتف:"}
                </span>
              </div>
              <span className="font-semibold text-sm">{phone}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mb-3 border-2 border-black rounded p-3">
        <div className="mb-2 border-b border-gray-400 pb-2">
          <div className="flex items-center justify-center gap-1">
            <Receipt className="w-5 h-5" />
            <span className="font-bold text-base">
              {isRtl
                ? "رقم الفاتورة | Invoice Number"
                : "Invoice Number | رقم الفاتورة"}
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span className="font-semibold text-sm">
              {format(new Date(invoice.createdAt), "dd/MM/yyyy")}
            </span>
          </div>
          <span className="font-semibold text-lg text-primary">
            #{invoice.invoiceId}
          </span>
        </div>
      </div>

      <div className="mb-3">
        <div className="py-2 bg-black text-white mb-3 font-bold text-base rounded">
          {isRtl ? "المنتجات | Products" : "Products | المنتجات"}
        </div>

        <div className="space-y-2 px-2">
          {isEyeExam ? (
            <div className="p-2 border-2 border-gray-300 rounded">
              <div className="text-base font-bold text-center">
                {isRtl ? "فحص العين | Eye Exam" : "Eye Exam | فحص العين"}
              </div>
              <div className="text-base font-medium text-center">
                {service.name || t("eyeExam")}
                {service.description && <span> - {service.description}</span>}
              </div>
            </div>
          ) : isContactLens &&
            Array.isArray(contactLensItems) &&
            contactLensItems.length > 0 ? (
            contactLensItems.map((lens, idx) => (
              <div key={idx} className="p-2 border-2 border-gray-300 rounded">
                <div className="text-base font-bold text-center mb-1">
                  {lens.brand} {lens.type}
                </div>
                <div className="text-base font-medium text-center">
                  {lens.color && (
                    <span>
                      {t("color")}: {lens.color} -{" "}
                    </span>
                  )}
                  <span>
                    {t("quantity")}: {lens.qty || 1}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-2">
              {lens && (
                <div className="p-2 border-2 border-gray-300 rounded">
                  <div className="text-base font-bold text-center mb-1">
                    {isRtl ? "العدسات | Lenses" : "Lenses | العدسات"}
                  </div>
                  <div className="text-base font-medium text-center">
                    {lens}
                  </div>
                </div>
              )}

              {frameBrand && (
                <div className="p-2 border-2 border-gray-300 rounded">
                  <div className="text-base font-bold text-center mb-1">
                    {isRtl ? "الإطار | Frame" : "Frame | الإطار"}
                  </div>
                  <div className="text-base font-medium text-center">
                    {frameBrand} {frameModel}
                  </div>
                </div>
              )}

              {coat && (
                <div className="p-2 border-2 border-gray-300 rounded">
                  <div className="text-base font-bold text-center mb-1">
                    {isRtl ? "الطلاء | Coating" : "Coating | الطلاء"}
                  </div>
                  <div className="text-base font-medium text-center">
                    {coat}
                  </div>

                  {coatColor && (
                    <div className="mt-1 flex flex-col">
                      <div className="flex justify-between px-2 text-sm">
                        <span>
                          {isRtl ? "اللون | Color" : "Color | اللون"}:
                        </span>
                        <span>
                          {typeof colorDisplayName === "object"
                            ? isRtl
                              ? colorDisplayName.ar
                              : colorDisplayName.en
                            : coatColor}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1 p-1 bg-gray-50 rounded border border-gray-200">
                        <span className="text-sm">
                          {isRtl ? "عينة | Sample" : "Sample | عينة"}
                        </span>
                        <div
                          className="w-4 h-4 rounded-full border border-gray-300"
                          style={{
                            backgroundColor: getColorStyle(coatColor),
                            printColorAdjust: "exact",
                            WebkitPrintColorAdjust: "exact",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 border-2 border-gray-300 rounded p-3">
          <div className="flex justify-between px-2 font-bold">
            <span className="text-lg">
              {isRtl ? "المجموع | Total" : "Total | المجموع"}:
            </span>
            <span className="text-lg">KWD {tot.toFixed(3)}</span>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <div className="py-2 bg-black text-white mb-3 font-bold text-base rounded">
          {isRtl ? "الدفع | Payment" : "Payment | الدفع"}
        </div>

        <div className="px-1">
          {Array.isArray(invoice.payments) && invoice.payments.length > 0 ? (
            invoice.payments.map((payment, index) => (
              <div key={index} className="border-b border-gray-300 py-1 mb-1">
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-base">
                    {format(new Date(payment.date), "dd/MM/yyyy")}
                  </span>
                  <span className="font-bold text-base">
                    KWD {payment.amount.toFixed(3)}
                  </span>
                </div>
                <div className="text-sm font-medium flex items-center justify-center gap-1">
                  <CreditCard className="w-4 h-4" />
                  <span>{getFormattedPaymentMethod(payment.method)}</span>
                  {payment.authNumber && <span> - {payment.authNumber}</span>}
                </div>
              </div>
            ))
          ) : (
            <div className="border-b border-gray-300 py-1 mb-1">
              <div className="flex justify-between mb-1">
                <span className="font-bold text-base">
                  {format(new Date(invoice.createdAt), "dd/MM/yyyy")}
                </span>
                <span className="font-bold text-base">
                  KWD {dep.toFixed(3)}
                </span>
              </div>
              <div className="text-sm font-medium flex items-center justify-center gap-1">
                <CreditCard className="w-4 h-4" />
                <span>{getFormattedPaymentMethod(payMethod)}</span>
                {auth && <span> - {auth}</span>}
              </div>
            </div>
          )}

          {rem > 0 ? (
            <div className="flex justify-between font-bold mt-2 pt-1 px-1">
              <span className="text-lg">
                {isRtl ? "المتبقي | Remaining" : "Remaining | المتبقي"}:
              </span>
              <span className="text-lg">KWD {rem.toFixed(3)}</span>
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-center gap-1 font-bold">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-base">
                {isRtl
                  ? "تم الدفع بالكامل | PAID IN FULL"
                  : "PAID IN FULL | تم الدفع بالكامل"}
              </span>
            </div>
          )}
        </div>
      </div>

      {isRefunded && (
        <div className="mb-3">
          <div className="py-2 bg-red-600 text-white mb-3 font-bold text-base rounded">
            {isRtl ? "استرداد | Refund" : "Refund | استرداد"}
          </div>

          <div className="p-2 border-2 border-red-300 rounded space-y-2">
            <div className="flex items-center justify-center gap-1 mb-2">
              <RefreshCcw className="w-4 h-4 text-red-600" />
              <span className="font-bold text-sm text-red-600">
                {isRtl
                  ? "تم استرداد هذه الفاتورة | This invoice has been refunded"
                  : "This invoice has been refunded | تم استرداد هذه الفاتورة"}
              </span>
            </div>

            <div className="flex justify-between px-2">
              <span className="font-semibold text-sm">
                {isRtl
                  ? "مبلغ الاسترداد | Refund Amount"
                  : "Refund Amount | مبلغ الاسترداد"}
                :
              </span>
              <span className="font-bold text-sm text-red-600">
                KWD {refundAmount.toFixed(3)}
              </span>
            </div>

            <div className="flex justify-between px-2">
              <span className="font-semibold text-sm">
                {isRtl
                  ? "تاريخ الاسترداد | Refund Date"
                  : "Refund Date | تاريخ الاسترداد"}
                :
              </span>
              <span className="font-semibold text-sm">
                {refundDate
                  ? format(new Date(refundDate), "dd/MM/yyyy")
                  : "N/A"}
              </span>
            </div>

            <div className="flex justify-between px-2">
              <span className="font-semibold text-sm">
                {isRtl
                  ? "طريقة الاسترداد | Refund Method"
                  : "Refund Method | طريقة الاسترداد"}
                :
              </span>
              <span className="font-semibold text-sm">
                {getFormattedPaymentMethod(refundMethod || "")}
              </span>
            </div>

            {refundReason && (
              <div className="px-2 pt-1 border-t border-red-200">
                <div className="font-semibold text-sm text-center">
                  {isRtl
                    ? "سبب الاسترداد | Refund Reason"
                    : "Refund Reason | سبب الاسترداد"}
                  :
                </div>
                <div className="text-xs font-medium text-center">
                  {refundReason}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 pt-2 border-t-2 border-gray-300 text-center">
        {isRtl ? (
          <p className="font-bold text-sm mb-0">
            شكراً لاختياركم نظارات المعين. يسعدنا خدمتكم دائماً!
          </p>
        ) : (
          <p className="font-bold text-sm mb-0">
            Thank you for choosing Moein Optical. We're always delighted to
            serve you!
          </p>
        )}
        <div className="text-xs font-medium">
          {format(new Date(), "yyyy-MM-dd")}
        </div>
      </div>

      <style>
        {`
          @media print {
            @page {
              size: 80mm auto !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            body {
              width: 80mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              color: black !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            #receipt-invoice {
              width: 80mm !important;
              max-width: 80mm !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              border: none !important;
              box-shadow: none !important;
              padding: 6px 8px !important;
              margin: 0 !important;
              background-color: white !important;
              color: black !important;
              text-align: center !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
              font-size: 12px !important;
            }
            
            .print-receipt * {
              visibility: visible !important;
              opacity: 1 !important;
              color: black !important;
            }
            
            .bg-black, .bg-red-600 {
              background-color: black !important;
              color: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            .text-white {
              color: white !important;
            }
            
            .bg-black *, .bg-red-600 * {
              color: white !important;
            }
            
            .text-red-600 {
              color: #dc2626 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            .border-red-300 {
              border-color: #fca5a5 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            .border-red-200 {
              border-color: #fecaca !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            #receipt-invoice .border-2 {
              border-width: 2px !important;
              border-style: solid !important;
            }
            
            #receipt-invoice .border-black {
              border-color: black !important;
            }
            
            #receipt-invoice .border-gray-300, #receipt-invoice .border-gray-400 {
              border-color: #d1d5db !important;
            }
            
            #receipt-invoice .rounded {
              border-radius: 0.25rem !important;
            }
            
            .thermal-receipt {
              font-family: ${
                isRtl ? "Zain, sans-serif" : "Yrsa, serif"
              } !important;
            }
            
            .mb-1 { margin-bottom: 0.25rem !important; }
            .mb-2 { margin-bottom: 0.5rem !important; }
            .mb-3 { margin-bottom: 0.75rem !important; }
            .mt-2 { margin-top: 0.5rem !important; }
            .mt-3 { margin-top: 0.75rem !important; }
            .px-1 { padding-left: 0.25rem !important; padding-right: 0.25rem !important; }
            .px-2 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
            .py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
            .py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
            .p-2 { padding: 0.5rem !important; }
            .p-3 { padding: 0.75rem !important; }
            .pt-1 { padding-top: 0.25rem !important; }
            .pt-2 { padding-top: 0.5rem !important; }
            .pb-2 { padding-bottom: 0.5rem !important; }
            
            .text-primary { color: rgb(var(--primary)) !important; }
            
            html, body {
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              overflow: visible !important;
            }
            
            .print-receipt {
              height: fit-content !important;
              min-height: fit-content !important;
              max-height: fit-content !important;
            }
            
            .print-receipt img, .print-receipt svg {
              max-height: 13mm !important;
              width: auto !important;
            }
            
            body {
              font-family: ${
                isRtl ? "Zain, sans-serif" : "Yrsa, serif"
              } !important;
            }
            
            .text-xs { font-size: 10px !important; }
            .text-sm { font-size: 13px !important; }
            .text-base { font-size: 16px !important; }
            .text-lg { font-size: 18px !important; }
            .text-xl { font-size: 20px !important; }
            
            .text-primary { font-size: 18px !important; font-weight: bold !important; }
            
            svg {
              width: 16px !important;
              height: 16px !important;
            }
            
            .ltr {
              direction: ltr !important;
              text-align: center !important;
            }
          }
        `}
      </style>
    </div>
  );
};
