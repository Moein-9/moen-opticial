import React from "react";
import { useLanguageStore } from "@/store/languageStore";
import { useInvoiceForm } from "./InvoiceFormContext";
import { Button } from "@/components/ui/button";
import { 
  ClipboardCheck, Printer, Receipt, 
  Check, ChevronRight, FileText, PartyPopper,
  CreditCard, User, Phone, Calendar, AlertTriangle,
  Contact, ScrollText, Glasses, Paintbrush, Wrench
} from "lucide-react";
import { CustomPrintService } from "@/utils/CustomPrintService";
import { Invoice } from "@/store/invoiceStore";
import { CustomPrintWorkOrderButton } from "@/components/CustomPrintWorkOrderButton";
import { PrintOptionsDialog } from "@/components/PrintOptionsDialog";
import { toast } from "sonner";
import { WorkOrder as InventoryWorkOrder } from "@/types/inventory";
import { PrintButton } from "@/components/PrintButton";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface InvoiceStepSummaryProps {
  setInvoicePrintOpen: (open: boolean) => void;
  setWorkOrderPrintOpen: (open: boolean) => void;
  setActiveTab?: (tab: string) => void;
}

export const InvoiceStepSummary: React.FC<InvoiceStepSummaryProps> = ({ 
  setInvoicePrintOpen, 
  setWorkOrderPrintOpen,
  setActiveTab
}) => {
  const { t, language } = useLanguageStore();
  const { getValues, calculateTotal, calculateRemaining } = useInvoiceForm();
  
  const textAlignClass = language === 'ar' ? 'text-right' : 'text-left';
  const directionClass = language === 'ar' ? 'rtl' : 'ltr';
  
  const currentTimestamp = new Date().toISOString();
  
  const invoice = {
    invoiceId: getValues('invoiceId') || "",
    workOrderId: getValues('workOrderId') || "",
    patientName: getValues('patientName') || "",
    patientPhone: getValues('patientPhone') || "",
    patientId: getValues('patientId') || "",
    invoiceType: getValues('invoiceType') || "glasses",
    lensType: getValues('lensType') || "",
    lensPrice: getValues('lensPrice') || 0,
    coating: getValues('coating') || "",
    coatingPrice: getValues('coatingPrice') || 0,
    coatingColor: getValues('coatingColor') || "",
    thickness: getValues('thickness') || "",
    thicknessPrice: getValues('thicknessPrice') || 0,
    frameBrand: getValues('frameBrand') || "",
    frameModel: getValues('frameModel') || "",
    frameColor: getValues('frameColor') || "",
    framePrice: getValues('framePrice') || 0,
    contactLensItems: getValues('contactLensItems') || [],
    contactLensRx: getValues('contactLensRx') || null,
    discount: getValues('discount') || 0,
    deposit: getValues('deposit') || 0,
    total: calculateTotal(),
    remaining: calculateRemaining(),
    paymentMethod: getValues('paymentMethod') || "",
    isPaid: calculateRemaining() <= 0,
    authNumber: getValues('authNumber') || "",
    serviceName: getValues('serviceName') || "",
    serviceId: getValues('serviceId') || "",
    serviceDescription: getValues('serviceDescription') || "",
    servicePrice: getValues('servicePrice') || 0,
    createdAt: currentTimestamp,
  } as Invoice;
  
  const rxData = getValues('rx') || {
    sphereOD: "",
    cylOD: "",
    axisOD: "",
    sphereOS: "",
    cylOS: "",
    axisOS: "",
    add: "",
    pd: "",
    pdRight: "",
    pdLeft: "",
    addOD: "",
    addOS: "",
    prism: "",
    base: "",
    va: "",
    notes: "",
    optometrist: ""
  };
  
  const patient = {
    patientId: getValues('patientId') || "",
    name: getValues('patientName') || "",
    phone: getValues('patientPhone') || "",
    contactLensRx: getValues('contactLensRx') || null,
    dob: "",
    notes: "",
    rx: rxData,
    createdAt: currentTimestamp
  } as any;
  
  const hasInvoiceData = !!invoice.invoiceId;
  const isContactLens = invoice.invoiceType === "contacts";
  const isEyeExam = invoice.invoiceType === "exam";
  
  const lensTypeValue = getValues('lensType') || "";
  const lensTypeObject = typeof lensTypeValue === 'string' 
    ? { name: lensTypeValue, price: getValues('lensPrice') || 0 }
    : lensTypeValue;
  
  const workOrder = {
    id: invoice.workOrderId || "",
    patientId: patient.patientId || "",
    createdAt: currentTimestamp,
    lensType: lensTypeObject,
    contactLenses: invoice.contactLensItems,
    contactLensRx: getValues('contactLensRx') || null,
    isContactLens: isContactLens,
    isPaid: invoice.isPaid,
    rx: rxData,
    coatingColor: getValues('coatingColor') || "",
    ...(invoice.discount ? { discount: invoice.discount } : {})
  } as any;
  
  const getColorStyle = (colorName: string) => {
    if (!colorName) return "transparent";
    
    const colorMap: Record<string, string> = {
      "Brown": "#8B4513",
      "Gray": "#808080",
      "Green": "#006400",
      "Blue": "#0000CD"
    };
    
    return colorMap[colorName] || "transparent";
  };
  
  const getColorDisplayName = (colorName: string) => {
    if (!colorName) return "";
    
    const colorMap: Record<string, { en: string, ar: string }> = {
      "Brown": { en: "Brown", ar: "بني" },
      "Gray": { en: "Gray", ar: "رمادي" },
      "Green": { en: "Green", ar: "أخضر" },
      "Blue": { en: "Blue", ar: "أزرق" }
    };
    
    return colorMap[colorName] || { en: colorName, ar: colorName };
  };
  
  const coatingColor = getValues('coatingColor') || "";
  const colorDisplayName = getColorDisplayName(coatingColor);
  const isRtl = language === 'ar';
  
  const handlePrintInvoice = () => {
    CustomPrintService.printInvoice(invoice);
  };
  
  const handlePrintWorkOrder = () => {
    console.log("Sending work order with coating color:", workOrder.coatingColor);
    CustomPrintService.printWorkOrder(workOrder, invoice, patient);
  };
  
  if (!hasInvoiceData) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="p-8 rounded-lg bg-amber-50 border-2 border-amber-200 shadow-sm">
          <div className="flex items-center mb-6">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center shadow-md">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <div className="ml-5">
              <h3 className="text-xl font-semibold text-amber-800">
                {language === 'ar' ? 'لا توجد بيانات للفاتورة بعد' : 'No invoice data yet'}
              </h3>
              <p className="text-amber-700 text-base mt-1">
                {t('startBySelectingClient')}
              </p>
            </div>
          </div>
          
          <div className="mt-6 flex justify-center">
            <Button 
              onClick={() => setActiveTab && setActiveTab("patient")}
              className="px-6 py-3 h-auto text-base"
            >
              <User className="w-5 h-5 mr-2" />
              {t('goToClientSection')}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="p-8 rounded-lg bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-200 shadow-sm">
        <div className="flex items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-md">
            <PartyPopper className="w-8 h-8 text-white" />
          </div>
          <div className="ml-5">
            <h3 className="text-xl font-semibold text-green-800">
              {t('invoiceCreated')}
            </h3>
            <p className="text-green-700 text-base mt-1">
              {t('invoiceSuccessMessage')}
            </p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-green-200 mb-5 shadow-sm">
          <div className="flex flex-col space-y-4">
            <div className={`flex justify-between items-center pb-3 border-b border-dashed border-green-200 ${textAlignClass}`}>
              <div className="flex items-center">
                <Receipt className="w-5 h-5 text-amber-500 mr-2" />
                <span className="text-gray-600 font-medium">{t('invoiceNumber')}:</span>
              </div>
              <span className="font-bold text-lg text-amber-500">{invoice.invoiceId}</span>
            </div>
            
            {!isEyeExam && (
              <div className={`flex justify-between items-center pb-3 border-b border-dashed border-green-200 ${textAlignClass}`}>
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-primary mr-2" />
                  <span className="text-gray-600 font-medium">{t('workOrderNumber')}:</span>
                </div>
                <span className="font-bold text-lg text-primary">{invoice.workOrderId}</span>
              </div>
            )}
            
            <div className={`flex justify-between items-center pb-3 border-b border-dashed border-green-200 ${textAlignClass}`}>
              <div className="flex items-center">
                {isEyeExam ? (
                  <ScrollText className="w-5 h-5 text-blue-600 mr-2" />
                ) : isContactLens ? (
                  <Contact className="w-5 h-5 text-blue-600 mr-2" />
                ) : invoice.invoiceType === "repair" ? (
                  <Wrench className="w-5 h-5 text-purple-600 mr-2" />
                ) : (
                  <Glasses className="w-5 h-5 text-blue-600 mr-2" />
                )}
                <span className="text-gray-600 font-medium">{t('orderType')}:</span>
              </div>
              <span className="font-medium">
                {isEyeExam 
                  ? (language === 'ar' ? 'فحص العين' : 'Eye Exam') 
                  : isContactLens 
                    ? t('contactLenses') 
                    : invoice.invoiceType === "repair"
                      ? (language === 'ar' ? 'خدمة الإصلاح' : 'Repair Service')
                      : t('glasses')}
              </span>
            </div>
            
            <div className={`flex justify-between items-center ${textAlignClass}`}>
              <div className="flex items-center">
                <User className="w-5 h-5 text-blue-500 mr-2" />
                <span className="text-gray-600 font-medium">{t('clientName')}:</span>
              </div>
              <span className="font-medium">{invoice.patientName || t('anonymous')}</span>
            </div>
            
            {invoice.patientPhone && (
              <div className={`flex justify-between items-center ${textAlignClass}`}>
                <div className="flex items-center">
                  <Phone className="w-5 h-5 text-blue-400 mr-2" />
                  <span className="text-gray-600 font-medium">{t('clientPhone')}:</span>
                </div>
                <span>{invoice.patientPhone}</span>
              </div>
            )}
            
            <div className={`flex justify-between items-center ${textAlignClass}`}>
              <div className="flex items-center">
                <Calendar className="w-5 h-5 text-amber-500 mr-2" />
                <span className="text-gray-600 font-medium">{t('date')}:</span>
              </div>
              <span>{new Date().toLocaleDateString('en-US')}</span>
            </div>
            
            {invoice.coating && coatingColor && (
              <div className={`flex justify-between items-center pb-3 border-t border-dashed border-green-200 pt-3 ${textAlignClass}`}>
                <div className="flex items-center">
                  <Paintbrush className="w-5 h-5 text-purple-500 mr-2" />
                  <span className="text-gray-600 font-medium">{t('coatingColor')}:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {typeof colorDisplayName === 'string' 
                      ? colorDisplayName 
                      : (isRtl ? colorDisplayName.ar : colorDisplayName.en)}
                  </span>
                  <div 
                    className="w-4 h-4 rounded-full border border-gray-300 color-preview" 
                    style={{ 
                      backgroundColor: getColorStyle(coatingColor),
                      printColorAdjust: 'exact',
                      WebkitPrintColorAdjust: 'exact'
                    }}
                  />
                </div>
              </div>
            )}
            
            <div className="my-3 border-t border-dashed border-green-200"></div>
            
            <div className={`flex justify-between items-center ${textAlignClass}`}>
              <div className="flex items-center">
                <Receipt className="w-5 h-5 text-purple-500 mr-2" />
                <span className="text-gray-600 font-medium">{t('totalInvoice')}:</span>
              </div>
              <span className="font-bold text-lg">{invoice.total.toFixed(2)} {t('kwd')}</span>
            </div>
            
            <div className={`flex justify-between items-center ${textAlignClass}`}>
              <div className="flex items-center">
                <CreditCard className="w-5 h-5 text-orange-500 mr-2" />
                <span className="text-gray-600 font-medium">{t('paymentStatus')}:</span>
              </div>
              <div className={`px-3 py-1 rounded-full ${invoice.isPaid ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"} font-medium text-sm`}>
                {invoice.isPaid ? t('paidInFull') : t('partiallyPaid')}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Card className="border-2 border-primary/20 shadow-sm overflow-hidden">
        <div className="p-6 bg-primary/5">
          <h3 className={`text-lg font-semibold text-primary pb-3 flex items-center ${textAlignClass}`}>
            <FileText className="w-5 h-5 mr-2" />
            {t('nextSteps')}
          </h3>
          <Separator className="my-2 bg-primary/20" />
        </div>
        
        <CardContent className="p-4 space-y-4">
          {!isEyeExam && (
            <PrintOptionsDialog
              invoice={invoice}
              workOrder={workOrder}
              patient={patient}
              onPrintWorkOrder={handlePrintWorkOrder}
              onPrintInvoice={handlePrintInvoice}
            >
              <div className="group cursor-pointer rounded-lg border hover:border-blue-400 transition-all duration-300 overflow-hidden hover:shadow-md">
                <div className="flex items-center">
                  <div className={`${language === 'ar' ? 'order-last' : 'order-first'} w-16 h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center p-4`}>
                    <ClipboardCheck className="w-8 h-8 text-white" />
                  </div>
                  <div className={`flex-grow p-4 ${textAlignClass}`}>
                    <h4 className="font-medium text-lg text-blue-700">{t('printWorkOrder')}</h4>
                    <p className="text-sm text-gray-600">{t('printWorkOrderDescription')}</p>
                  </div>
                  <div className={`p-4 ${language === 'ar' ? 'rotate-180' : ''}`}>
                    <ChevronRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </PrintOptionsDialog>
          )}
          
          <div 
            className="group cursor-pointer rounded-lg border hover:border-green-400 transition-all duration-300 overflow-hidden hover:shadow-md"
            onClick={handlePrintInvoice}
          >
            <div className="flex items-center">
              <div className={`${language === 'ar' ? 'order-last' : 'order-first'} w-16 h-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center p-4`}>
                <Receipt className="w-8 h-8 text-white" />
              </div>
              <div className={`flex-grow p-4 ${textAlignClass}`}>
                <h4 className="font-medium text-lg text-green-700">{t('printInvoice')}</h4>
                <p className="text-sm text-gray-600">{t('printInvoiceDescription')}</p>
              </div>
              <div className={`p-4 ${language === 'ar' ? 'rotate-180' : ''}`}>
                <ChevronRight className="w-5 h-5 text-green-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
