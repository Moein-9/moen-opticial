import React, { createContext, useContext, useState, useCallback } from "react";

// Make sure all fields used in the components are included in this interface
interface InvoiceFormData {
  invoiceType: "glasses" | "contacts" | "exam" | "repair";
  patientName: string;
  patientPhone: string;
  date: Date | null;
  dueDate: Date | null;
  notes: string;
  discount: number;
  deposit: number;
  remaining: number;
  total: number;
  
  // Glasses-specific
  skipFrame: boolean;
  frameBrand: string;
  frameModel: string;
  frameColor: string;
  frameSize: string;
  framePrice: number;
  lensType: string;
  lensPrice: number;
  coating: string;
  coatingPrice: number;
  coatingColor: string; // Ensure this is defined clearly
  thickness: string;
  thicknessPrice: number;
  rx: any; // prescription
  
  // Contacts-specific
  contactLensItems: any[];
  contactLensRx: any;
  
  // Exam-specific
  serviceName: string;
  serviceId: string;
  serviceDescription: string;
  servicePrice: number;

  // Repair-specific
  repairType: string;
  repairDescription: string;
  repairPrice: number;

  lensCombinationPrice: number | null;
  
  // Invoice specific fields
  invoiceId: string;
  workOrderId: string;
  patientId: string;
  paymentMethod: string;
  authNumber: string;
  isPaid: boolean;
  isFinalPriceMode: boolean;
  skipPatient: boolean;
}

interface InvoiceFormContextType {
  formData: InvoiceFormData;
  setValue: <K extends keyof InvoiceFormData>(field: K, value: InvoiceFormData[K]) => void;
  getValues: <K extends keyof InvoiceFormData>(field?: K) => K extends undefined ? InvoiceFormData : InvoiceFormData[K];
  updateServicePrice: (price: number) => void;
  
  // Required methods for the components
  calculateTotal: () => number;
  calculateRemaining: () => number;
  validateCurrentStep: (step: string) => boolean;
  updateFinalPrice: (price: number) => void;
  finalPrice: number;
  
  // Patient search related
  patientSearchResults: any[];
  setPatientSearchResults: (results: any[]) => void;
  currentPatient: any | null;
  setCurrentPatient: (patient: any | null) => void;
}

const InvoiceFormContext = createContext<InvoiceFormContextType | undefined>(undefined);

const defaultFormState: InvoiceFormData = {
  invoiceType: "glasses",
  patientName: "",
  patientPhone: "",
  date: null,
  dueDate: null,
  notes: "",
  discount: 0,
  deposit: 0,
  remaining: 0,
  total: 0,
  
  skipFrame: false,
  frameBrand: "",
  frameModel: "",
  frameColor: "",
  frameSize: "",
  framePrice: 0,
  lensType: "",
  lensPrice: 0,
  coating: "",
  coatingPrice: 0,
  coatingColor: "", // Initialize coating color
  thickness: "",
  thicknessPrice: 0,
  rx: null,
  
  contactLensItems: [],
  contactLensRx: null,
  
  serviceName: "",
  serviceId: "",
  serviceDescription: "",
  servicePrice: 0,
  
  // Repair fields
  repairType: "",
  repairDescription: "",
  repairPrice: 0,
  
  lensCombinationPrice: null,
  
  // Initialize new fields
  invoiceId: "",
  workOrderId: "",
  patientId: "",
  paymentMethod: "",
  authNumber: "",
  isPaid: false,
  isFinalPriceMode: false,
  skipPatient: false,
};

export const InvoiceFormProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [formData, setFormData] = useState<InvoiceFormData>(defaultFormState);
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [patientSearchResults, setPatientSearchResults] = useState<any[]>([]);
  const [currentPatient, setCurrentPatient] = useState<any | null>(null);
  
  const setValue = useCallback(<K extends keyof InvoiceFormData>(field: K, value: InvoiceFormData[K]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);
  
  const getValues = useCallback(<K extends keyof InvoiceFormData>(field?: K): K extends undefined ? InvoiceFormData : InvoiceFormData[K] => {
    return field ? formData[field] : formData as any;
  }, [formData]);
  
  const updateServicePrice = useCallback((price: number) => {
    setFormData(prev => ({
      ...prev,
      total: price - prev.discount,
      remaining: price - prev.discount - prev.deposit,
      servicePrice: price
    }));
  }, []);
  
  const calculateSubtotal = useCallback(() => {
    if (formData.invoiceType === 'exam') {
      return formData.servicePrice || 0;
    } else if (formData.invoiceType === 'repair') {
      return formData.repairPrice || 0;
    } else if (formData.invoiceType === 'glasses') {
      let lensPrice = formData.lensCombinationPrice !== null 
        ? formData.lensCombinationPrice 
        : formData.lensPrice + formData.coatingPrice + formData.thicknessPrice;
      
      const framePrice = formData.skipFrame ? 0 : formData.framePrice;
      return lensPrice + framePrice;
    } else {
      // Contact lenses
      const contactLensTotal = formData.contactLensItems.reduce((sum, lens) => 
        sum + ((lens.price || 0) * (lens.qty || 1)), 0
      );
      return contactLensTotal;
    }
  }, [formData]);
  
  const calculateTotal = useCallback(() => {
    if (formData.invoiceType === 'exam') {
      return formData.servicePrice - formData.discount;
    } else if (formData.invoiceType === 'repair') {
      return formData.repairPrice - formData.discount;
    } else if (formData.invoiceType === 'glasses') {
      let lensPrice = formData.lensCombinationPrice !== null 
        ? formData.lensCombinationPrice 
        : formData.lensPrice + formData.coatingPrice + formData.thicknessPrice;
      
      const framePrice = formData.skipFrame ? 0 : formData.framePrice;
      return lensPrice + framePrice - formData.discount;
    } else {
      // Contact lenses
      const contactLensTotal = formData.contactLensItems.reduce((sum, lens) => 
        sum + ((lens.price || 0) * (lens.qty || 1)), 0
      );
      return contactLensTotal - formData.discount;
    }
  }, [formData]);
  
  const calculateRemaining = useCallback(() => {
    const total = calculateTotal();
    return Math.max(0, total - formData.deposit);
  }, [formData, calculateTotal]);
  
  const validateCurrentStep = useCallback((step: string): boolean => {
    if (step === 'patient') {
      if (!formData.patientName && !formData.skipPatient) {
        return false;
      }
      return true;
    } else if (step === 'products') {
      if (formData.invoiceType === 'glasses') {
        // For glasses, either lens or frame is required
        if (!formData.skipFrame && !formData.frameBrand) {
          return false;
        }
        if (!formData.lensType && !formData.skipFrame) {
          return false;
        }
      } else if (formData.invoiceType === 'contacts' && (!formData.contactLensItems || formData.contactLensItems.length === 0)) {
        // For contacts, at least one item is required
        return false;
      } else if (formData.invoiceType === 'repair') {
        // For repair, require repair type and price
        if (!formData.repairType || formData.repairPrice <= 0) {
          return false;
        }
        
        // Also ensure serviceName and servicePrice are set correctly
        if (formData.serviceName !== formData.repairType || formData.servicePrice !== formData.repairPrice) {
          // Sync these values if they aren't matching
          formData.serviceName = formData.repairType;
          formData.servicePrice = formData.repairPrice;
        }
        
        return true;
      }
      // For exam, we don't need to validate anything specific
      return true;
    } else if (step === 'payment') {
      // Validate payment method
      if (!formData.paymentMethod) {
        return false;
      }
      // Card payments require auth number
      if ((formData.paymentMethod === 'Visa' || formData.paymentMethod === 'MasterCard') && !formData.authNumber) {
        return false;
      }
      return true;
    }
    return true;
  }, [formData]);
  
  const updateFinalPrice = useCallback((price: number) => {
    setFinalPrice(price);
    
    const newDiscount = Math.max(0, calculateSubtotal() - price);
    
    setFormData(prev => ({
      ...prev,
      discount: newDiscount,
      total: price,
      remaining: Math.max(0, price - prev.deposit)
    }));
  }, [calculateSubtotal]);
  
  const contextValue: InvoiceFormContextType = {
    formData,
    setValue,
    getValues,
    updateServicePrice,
    calculateTotal,
    calculateRemaining,
    validateCurrentStep,
    finalPrice,
    updateFinalPrice,
    patientSearchResults,
    setPatientSearchResults,
    currentPatient,
    setCurrentPatient
  };
  
  return (
    <InvoiceFormContext.Provider value={contextValue}>
      {children}
    </InvoiceFormContext.Provider>
  );
};

export const useInvoiceForm = () => {
  const context = useContext(InvoiceFormContext);
  if (!context) {
    throw new Error("useInvoiceForm must be used within a InvoiceFormProvider");
  }
  return context;
};
