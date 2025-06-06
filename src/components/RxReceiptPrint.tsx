
import React from "react";
import { format, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import { RxData, ContactLensRx } from "@/store/patientStore";
import { Eye, Calendar, User, Phone } from "lucide-react";
import { MoenLogo, storeInfo } from "@/assets/logo";
import { useLanguageStore } from "@/store/languageStore";

interface RxReceiptPrintProps {
  patientName: string;
  patientPhone?: string;
  rx: RxData;
  isPrintable?: boolean;
  forcedLanguage?: 'en' | 'ar';
  contactLensRx?: ContactLensRx;
  printContactLens?: boolean;
}

export const RxReceiptPrint: React.FC<RxReceiptPrintProps> = ({
  patientName,
  patientPhone,
  rx,
  isPrintable = false,
  forcedLanguage,
  contactLensRx,
  printContactLens = false
}) => {
  const { language: appLanguage, t } = useLanguageStore();
  const language = forcedLanguage || appLanguage;
  const isRtl = language === 'ar';
  
  const containerClass = isPrintable 
    ? "w-[72mm] mx-auto bg-white p-2 text-[11px] border shadow-sm print:shadow-none" 
    : "w-full bg-white p-4 border rounded-lg shadow-sm";
  
  const dirClass = isRtl ? 'rtl text-right' : 'ltr text-left';

  const formattedRxDate = rx.createdAt 
    ? format(parseISO(rx.createdAt), 'MM/dd/yyyy HH:mm', { locale: enUS })
    : format(new Date(), 'MM/dd/yyyy HH:mm', { locale: enUS });

  return (
    <div 
      className={`${containerClass} ${dirClass}`} 
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: 'Cairo, sans-serif' }}
    >
      <div className="text-center border-b pb-2 mb-2">
        <div className="flex justify-center mb-1">
          <MoenLogo className="w-auto h-12" />
        </div>
        <h2 className="font-bold text-base mb-0.5">{storeInfo.name}</h2>
        <p className="text-[10px] text-muted-foreground">{storeInfo.address}</p>
        <p className="text-[10px] text-muted-foreground">{t("phone")}: {storeInfo.phone}</p>
      </div>

      <div className="bg-gray-800 text-white py-1 px-2 text-center font-bold text-sm mb-2 rounded-sm print:bg-black print:text-white">
        <div className="flex items-center justify-center gap-1">
          <Eye className="h-3 w-3" /> 
          {isRtl 
            ? (printContactLens ? "وصفة العدسات اللاصقة" : "وصفة النظارات الطبية") 
            : (printContactLens ? "CONTACT LENS PRESCRIPTION" : "GLASSES PRESCRIPTION")
          }
        </div>
      </div>

      <div className="px-6 mb-2 text-[11px]">
        <div className="flex justify-between border-b pb-0.5 mb-0.5">
          <span className="font-semibold flex items-center">
            <Calendar className="h-3.5 w-3.5 mr-1" /> {t("date")}:
          </span>
          <span>{formattedRxDate}</span>
        </div>
        <div className="flex justify-between border-b pb-0.5 mb-0.5">
          <span className="font-semibold flex items-center">
            <User className="h-3.5 w-3.5 mr-1" /> {t("patient")}:
          </span>
          <span>{patientName}</span>
        </div>
        {patientPhone && (
          <div className="flex justify-between border-b pb-0.5 mb-0.5">
            <span className="font-semibold flex items-center">
              <Phone className="h-3.5 w-3.5 mr-1" /> {t("phone")}:
            </span>
            <span>{patientPhone}</span>
          </div>
        )}
      </div>

      <div className="px-5 mb-3">
        {printContactLens && contactLensRx ? (
          <table className="w-full border-collapse text-[10px] ltr" style={{ maxWidth: "62mm", direction: "ltr" }}>
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 p-0.5 text-center"></th>
                <th className="border border-gray-400 p-0.5 text-center">SPH</th>
                <th className="border border-gray-400 p-0.5 text-center">CYL</th>
                <th className="border border-gray-400 p-0.5 text-center">AXIS</th>
                <th className="border border-gray-400 p-0.5 text-center">BC</th>
                <th className="border border-gray-400 p-0.5 text-center">DIA</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-400 p-0.5 text-center font-medium">OD</td>
                <td className="border border-gray-400 p-0.5 text-center">{contactLensRx.rightEye.sphere || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{contactLensRx.rightEye.cylinder || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{contactLensRx.rightEye.axis || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{contactLensRx.rightEye.bc || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{contactLensRx.rightEye.dia || "-"}</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-0.5 text-center font-medium">OS</td>
                <td className="border border-gray-400 p-0.5 text-center">{contactLensRx.leftEye.sphere || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{contactLensRx.leftEye.cylinder || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{contactLensRx.leftEye.axis || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{contactLensRx.leftEye.bc || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{contactLensRx.leftEye.dia || "-"}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse text-[10px] ltr" style={{ maxWidth: "62mm", direction: "ltr" }}>
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 p-0.5 text-center"></th>
                <th className="border border-gray-400 p-0.5 text-center">SPH</th>
                <th className="border border-gray-400 p-0.5 text-center">CYL</th>
                <th className="border border-gray-400 p-0.5 text-center">AXIS</th>
                <th className="border border-gray-400 p-0.5 text-center">ADD</th>
                <th className="border border-gray-400 p-0.5 text-center">PD</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-400 p-0.5 text-center font-medium">OD</td>
                <td className="border border-gray-400 p-0.5 text-center">{rx.sphereOD || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{rx.cylOD || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{rx.axisOD || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{rx.addOD || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{rx.pdRight || "-"}</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-0.5 text-center font-medium">OS</td>
                <td className="border border-gray-400 p-0.5 text-center">{rx.sphereOS || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{rx.cylOS || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{rx.axisOS || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{rx.addOS || "-"}</td>
                <td className="border border-gray-400 p-0.5 text-center">{rx.pdLeft || "-"}</td>
              </tr>
            </tbody>
          </table>
        )}
        <div className="mt-1 text-[10px] flex justify-between px-2 font-medium">
          <span>OD = {isRtl ? "العين اليمنى" : "Right Eye"}</span>
          <span>OS = {isRtl ? "العين اليسرى" : "Left Eye"}</span>
        </div>
      </div>

      <div className="px-5 mb-2">
        <div className="bg-gray-800 text-white py-0.5 px-1 font-semibold text-[12px] mb-1 text-center print:bg-black print:text-white">
          {printContactLens 
            ? (isRtl ? "نصائح للعناية بالعدسات اللاصقة" : "Contact Lens Care Tips") 
            : (isRtl ? "نصائح للعناية بالنظارات" : "Glasses Care Tips")
          }
        </div>
        {printContactLens ? (
          <ul className={`list-disc px-6 space-y-0.5 text-[12px] font-bold ${dirClass}`}>
            <li>{isRtl ? "اغسل يديك جيداً بالصابون قبل لمس العدسات" : "Always wash your hands thoroughly with soap before touching your lenses"}</li>
            <li>{isRtl ? "استخدم محلول العدسات اللاصقة المناسب فقط" : "Use only the appropriate contact lens solution"}</li>
            <li>{isRtl ? "لا تنم بالعدسات اللاصقة إلا إذا كانت مصممة للاستخدام أثناء النوم" : "Don't sleep with your contacts unless they are specifically designed for overnight wear"}</li>
            <li>{isRtl ? "استبدل العدسات وفقاً للجدول الزمني الموصى به" : "Replace your lenses according to the recommended schedule"}</li>
          </ul>
        ) : (
          <ul className={`list-disc px-6 space-y-0.5 text-[12px] font-bold ${dirClass}`}>
            <li>{t("tip1")}</li>
            <li>{t("tip2")}</li>
            <li>{t("tip3")}</li>
            <li>{t("tip4")}</li>
          </ul>
        )}
      </div>

      <div className="text-center mt-2 pt-2 border-t px-3">
        <p className="font-semibold text-[10px]">
          {isRtl 
            ? "شكراً لاختياركم نظارات المعين. يسعدنا خدمتكم دائماً!" 
            : "Thank you for choosing Moein Optical. We're always delighted to serve you!"}
        </p>
        <p className="text-[9px] mt-1">{format(new Date(), 'yyyy-MM-dd')}</p>
        <div className="mt-1 text-[12px] flex gap-1 justify-center">
          <span>{'•'.repeat(12)}</span>
        </div>
      </div>
    </div>
  );
};

export const RxLanguageDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelect: (language: 'en' | 'ar') => void;
}> = ({ isOpen, onClose, onSelect }) => {
  const { t } = useLanguageStore();
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-auto">
        <h3 className="text-lg font-medium mb-4 text-center">{t("selectLanguageForPrinting")}</h3>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => onSelect('en')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            English
          </button>
          <button
            onClick={() => onSelect('ar')}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            العربية
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 w-full border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
};

export const printRxReceipt = (props: RxReceiptPrintProps) => {
  const { patientName, patientPhone, rx, forcedLanguage, contactLensRx, printContactLens } = props;
  const { language: appLanguage } = useLanguageStore.getState();
  const language = forcedLanguage || appLanguage;
  const isRtl = language === 'ar';
  
  const formattedRxDate = rx.createdAt 
    ? format(parseISO(rx.createdAt), 'dd/MM/yyyy HH:mm')
    : format(new Date(), 'dd/MM/yyyy HH:mm');
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${isRtl ? (printContactLens ? 'وصفة العدسات اللاصقة' : 'وصفة النظارات') : (printContactLens ? 'Contact Lens Prescription' : 'Glasses Prescription')}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    body {
      font-family: 'Cairo', sans-serif;
      margin: 0;
      padding: 0;
      width: 76mm;
      direction: ${isRtl ? 'rtl' : 'ltr'};
      text-align: ${isRtl ? 'right' : 'left'};
      background-color: white;
      color: black;
    }
    .container {
      padding: 4mm;
      max-width: 72mm;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 1px solid #333;
      padding-bottom: 2mm;
      margin-bottom: 2mm;
    }
    .logo {
      max-width: 50mm;
      height: auto;
      margin: 0 auto 1mm;
      display: block;
    }
    .store-name {
      font-weight: bold;
      font-size: 14px;
      margin: 1mm 0;
    }
    .store-info {
      font-size: 9px;
      color: #333;
    }
    .field {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #ddd;
      padding: 1mm 0;
      font-size: 12px;
      margin: 0 7mm; /* Added more margin for better safety zone */
    }
    .field-label {
      font-weight: bold;
      display: flex;
      align-items: center;
    }
    .field-icon {
      margin-right: 1mm;
      width: 3mm;
      height: 3mm;
    }
    .rx-title {
      text-align: center;
      font-weight: bold;
      font-size: 12px;
      margin: 2mm 0;
      text-transform: uppercase;
      background-color: #000;
      color: white;
      padding: 1mm;
      border-radius: 1mm;
      margin-left: 5mm;
      margin-right: 5mm;
    }
    table {
      width: calc(100% - 14mm); /* Reduced width for safety */
      border-collapse: collapse;
      direction: ltr; /* Always LTR for the table */
      font-size: 10px;
      margin: 2mm auto;
    }
    th, td {
      border: 1px solid #333;
      padding: 1mm;
      text-align: center;
    }
    th {
      background-color: #eee;
      font-size: 10px;
    }
    .eye-legend {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      font-weight: 600;
      margin-top: 1mm;
      padding: 0 8mm;
    }
    .section-title {
      font-weight: bold;
      font-size: 10px;
      background-color: #eee;
      padding: 1mm;
      margin: 2mm 6mm 1mm 6mm;
      text-align: ${isRtl ? 'right' : 'left'};
    }
    .notes {
      margin: 2mm 6mm;
      font-size: 9px;
    }
    .tips-title {
      text-align: center;
      font-weight: bold;
      background-color: #000;
      color: white;
      padding: 1mm;
      margin: 2mm 6mm 1mm 6mm;
      font-size: 12px;
    }
    .tips-list {
      padding-${isRtl ? 'right' : 'left'}: 5mm;
      margin: 1mm 8mm;
      font-size: 12px;
      font-weight: 700;
    }
    .tips-list li {
      margin-bottom: 1.5mm;
    }
    .footer {
      text-align: center;
      margin: 2mm 6mm 0;
      padding-top: 2mm;
      border-top: 1px solid #333;
      font-size: 10px;
    }
    .thank-you {
      font-weight: bold;
      font-size: 10px;
      margin-bottom: 1mm;
    }
    .dots {
      margin-top: 2mm;
      font-size: 12px;
    }
    /* Print-specific styles to handle background colors */
    @media print {
      .rx-title, .tips-title {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        background-color: #000 !important;
        color: white !important;
      }
      th {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        background-color: #eee !important;
      }
      .section-title {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        background-color: #eee !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img class="logo" src="/lovable-uploads/d0902afc-d6a5-486b-9107-68104dfd2a68.png" alt="Moen Optician Logo">
      <div class="store-name">${storeInfo.name}</div>
      <div class="store-info">${storeInfo.address}</div>
      <div class="store-info">${isRtl ? 'الهاتف' : 'Phone'}: ${storeInfo.phone}</div>
    </div>
    
    <div class="rx-title">
      ${isRtl 
        ? (printContactLens ? 'وصفة العدسات اللاصقة' : 'وصفة النظارات الطبية') 
        : (printContactLens ? 'CONTACT LENS PRESCRIPTION' : 'GLASSES PRESCRIPTION')
      }
    </div>
    
    <div class="patient-info">
      <div class="field">
        <span class="field-label">
          <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          ${isRtl ? 'التاريخ' : 'Date'}:
        </span>
        <span>${formattedRxDate}</span>
      </div>
      <div class="field">
        <span class="field-label">
          <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          ${isRtl ? 'المريض' : 'Patient'}:
        </span>
        <span>${patientName}</span>
      </div>
      ${patientPhone ? `
      <div class="field">
        <span class="field-label">
          <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          ${isRtl ? 'الهاتف' : 'Phone'}:
        </span>
        <span>${patientPhone}</span>
      </div>
      ` : ''}
    </div>
    
    ${printContactLens && contactLensRx ? `
    <table>
      <thead>
        <tr>
          <th></th>
          <th>SPH</th>
          <th>CYL</th>
          <th>AXIS</th>
          <th>BC</th>
          <th>DIA</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="font-weight: bold;">OD</td>
          <td>${contactLensRx.rightEye.sphere || "-"}</td>
          <td>${contactLensRx.rightEye.cylinder || "-"}</td>
          <td>${contactLensRx.rightEye.axis || "-"}</td>
          <td>${contactLensRx.rightEye.bc || "-"}</td>
          <td>${contactLensRx.rightEye.dia || "-"}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">OS</td>
          <td>${contactLensRx.leftEye.sphere || "-"}</td>
          <td>${contactLensRx.leftEye.cylinder || "-"}</td>
          <td>${contactLensRx.leftEye.axis || "-"}</td>
          <td>${contactLensRx.leftEye.bc || "-"}</td>
          <td>${contactLensRx.leftEye.dia || "-"}</td>
        </tr>
      </tbody>
    </table>
    ` : `
    <table>
      <thead>
        <tr>
          <th></th>
          <th>SPH</th>
          <th>CYL</th>
          <th>AXIS</th>
          <th>ADD</th>
          <th>PD</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="font-weight: bold;">OD</td>
          <td>${rx.sphereOD || "-"}</td>
          <td>${rx.cylOD || "-"}</td>
          <td>${rx.axisOD || "-"}</td>
          <td>${rx.addOD || "-"}</td>
          <td>${rx.pdRight || "-"}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">OS</td>
          <td>${rx.sphereOS || "-"}</td>
          <td>${rx.cylOS || "-"}</td>
          <td>${rx.axisOS || "-"}</td>
          <td>${rx.addOS || "-"}</td>
          <td>${rx.pdLeft || "-"}</td>
        </tr>
      </tbody>
    </table>
    `}
    
    <div class="eye-legend">
      <span>OD = ${isRtl ? 'العين اليمنى' : 'Right Eye'}</span>
      <span>OS = ${isRtl ? 'العين اليسرى' : 'Left Eye'}</span>
    </div>
    
    <div class="tips-title">
      ${printContactLens 
        ? (isRtl ? 'نصائح للعناية بالعدسات اللاصقة' : 'Contact Lens Care Tips') 
        : (isRtl ? 'نصائح للعناية بالنظارات' : 'Glasses Care Tips')
      }
    </div>

    ${printContactLens ? `
    <ul class="tips-list">
      <li>${isRtl ? 'اغسل يديك جيداً بالصابون قبل لمس العدسات' : 'Always wash your hands thoroughly with soap before touching your lenses'}</li>
      <li>${isRtl ? 'استخدم محلول العدسات اللاصقة المناسب فقط' : 'Use only the appropriate contact lens solution'}</li>
      <li>${isRtl ? 'لا تنم بالعدسات اللاصقة إلا إذا كانت مصممة للاستخدام أثناء النوم' : "Don't sleep with your contacts unless they are specifically designed for overnight wear"}</li>
      <li>${isRtl ? 'استبدل العدسات وفقاً للجدول الزمني الموصى به' : 'Replace your lenses according to the recommended schedule'}</li>
    </ul>
    ` : `
    <ul class="tips-list">
      <li>${isRtl ? 'استخدم دائماً كلتا اليدين عند وضع النظارات أو إزالتها' : 'Always use both hands to put on or remove your glasses'}</li>
      <li>${isRtl ? 'نظف العدسات بقطعة قماش نظيفة وناعمة وبمنظف مناسب للعدسات' : 'Clean lenses with a clean, soft cloth and proper lens cleaner'}</li>
      <li>${isRtl ? 'احفظ النظارات في علبتها عندما لا تكون قيد الاستعمال' : 'Store your glasses in their case when not in use'}</li>
      <li>${isRtl ? 'تجنب وضع النظارات على الوجه المقلوب على الأسطح' : 'Avoid placing your glasses face down on surfaces'}</li>
    </ul>
    `}
    
    <div class="footer">
      <div class="thank-you">
        ${isRtl 
          ? "شكراً لاختياركم نظارات المعين. يسعدنا خدمتكم دائماً!" 
          : "Thank you for choosing Moein Optical. We're always delighted to serve you!"}
      </div>
      <div style="margin-top: 1mm; font-size: 9px;">
        ${format(new Date(), 'yyyy-MM-dd')}
      </div>
      <div class="dots">•••••••••••</div>
    </div>
  </div>
  
  <script>
    window.onload = function() {
      // Force background colors to print properly
      document.body.style.webkitPrintColorAdjust = 'exact';
      document.body.style.printColorAdjust = 'exact';
      
      window.print();
      window.onafterprint = function() {
        window.close();
      };
    };
  </script>
</body>
</html>
  `;
  
  try {
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert(isRtl ? 'تم منع النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لطباعة الوصفة.' : 
        'Popup blocked. Please allow popups to print prescription.');
      return;
    }
    
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } catch (error) {
    console.error("Error printing prescription:", error);
    alert(isRtl ? 'حدث خطأ أثناء الطباعة' : 'Error during printing');
  }
};
