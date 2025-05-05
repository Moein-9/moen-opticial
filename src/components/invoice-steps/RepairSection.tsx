import React, { useState, useEffect } from "react";
import { useLanguageStore } from "@/store/languageStore";
import { useInvoiceForm } from "./InvoiceFormContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Wrench, Check, Loader2 } from "lucide-react";
import { useInventoryStore, ServiceItem } from "@/store/inventoryStore";

export const RepairSection: React.FC = () => {
  const { language } = useLanguageStore();
  const { setValue, getValues, validateCurrentStep } = useInvoiceForm();
  const [repairPrice, setRepairPrice] = useState<number>(
    getValues("repairPrice") || 0
  );
  const [repairDescription, setRepairDescription] = useState<string>(
    getValues("repairDescription") || ""
  );
  const [repairType, setRepairType] = useState<string>(
    getValues("repairType") || ""
  );
  const [repairServices, setRepairServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const { getServicesByCategory } = useInventoryStore();

  const isRtl = language === "ar";
  const textAlignClass = isRtl ? "text-right" : "text-left";

  // Make sure form has valid values for navigation
  const ensureFormValidity = () => {
    // Always set invoice type to repair
    setValue("invoiceType", "repair");

    // If no repair type is set, initialize with defaults
    if (!repairType) {
      const defaultType = isRtl ? "إصلاح عام" : "General Repair";
      setRepairType(defaultType);
      setValue("repairType", defaultType);
      setValue("serviceName", defaultType);
    }
  };

  // Fetch repair services from Supabase when component mounts
  useEffect(() => {
    const fetchRepairServices = async () => {
      setIsLoading(true);
      try {
        const services = await getServicesByCategory("repair");
        setRepairServices(services);

        // If we have services and no current selection, select the first one
        if (services.length > 0 && !repairType) {
          applyRepairService(services[0]);
          setIsInitialized(true);
        } else if (services.length === 0) {
          // Ensure form is valid even with no services
          ensureFormValidity();
          setIsInitialized(true);
        } else {
          // If we already have a selection
          setIsInitialized(true);
        }
      } catch (error) {
        console.error("Failed to fetch repair services:", error);
        // Ensure form is valid even on error
        ensureFormValidity();
        setIsInitialized(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepairServices();
  }, [getServicesByCategory]);

  // Ensure form validity whenever component values change
  useEffect(() => {
    if (!isLoading && isInitialized) {
      ensureFormValidity();

      // Only validate after initialization is complete
      setTimeout(() => {
        validateCurrentStep("products");
      }, 0);
    }
  }, [repairType, repairPrice, isLoading, isInitialized]);

  // Ensure form values stay in sync with component state
  useEffect(() => {
    if (repairType) {
      setValue("repairType", repairType);
      setValue("serviceName", repairType);
    }
    
    if (repairPrice > 0) {
      setValue("repairPrice", repairPrice);
      setValue("servicePrice", repairPrice);
    }
    
    if (repairDescription) {
      setValue("repairDescription", repairDescription);
      setValue("serviceDescription", repairDescription);
    }
    
    // Always ensure invoice type is set to repair
    setValue("invoiceType", "repair");
    
  }, [repairType, repairPrice, repairDescription, setValue]);

  const handleRepairPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const price = parseFloat(e.target.value) || 0;
    setRepairPrice(price);
    setValue("repairPrice", price);
    setValue("servicePrice", price);
  };

  const handleRepairTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRepairType(e.target.value);
    setValue("repairType", e.target.value);
    setValue("serviceName", e.target.value);
  };

  const handleRepairDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setRepairDescription(e.target.value);
    setValue("repairDescription", e.target.value);
    setValue("serviceDescription", e.target.value);
  };

  const applyRepairService = (service: ServiceItem) => {
    setRepairType(service.name);
    setRepairPrice(service.price);
    
    // Set all necessary form values
    setValue("repairType", service.name);
    setValue("repairPrice", service.price);
    setValue("serviceName", service.name);
    setValue("servicePrice", service.price);

    // If the service has a description, use it
    if (service.description) {
      setRepairDescription(service.description);
      setValue("repairDescription", service.description);
      setValue("serviceDescription", service.description);
    }

    // Set invoice type to repair
    setValue("invoiceType", "repair");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle
            className={`text-lg flex items-center gap-2 ${textAlignClass}`}
          >
            <Wrench className="w-5 h-5 text-purple-600" />
            {isRtl ? "خدمة الإصلاح" : "Repair Service"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500 mr-2" />
              <p className="text-purple-700">
                {isRtl
                  ? "جاري تحميل خدمات الإصلاح..."
                  : "Loading repair services..."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {repairServices.length > 0 ? (
                  repairServices.map((service) => (
                    <Button
                      key={service.id}
                      variant="outline"
                      className={`p-3 h-auto ${
                        repairType === service.name
                          ? "bg-purple-100 border-purple-500"
                          : ""
                      }`}
                      onClick={() => applyRepairService(service)}
                    >
                      <div className="flex flex-col items-center gap-1 text-center">
                        <span className="font-medium text-sm">
                          {service.name}
                        </span>
                        <span className="text-purple-700 font-semibold">
                          {service.price.toFixed(3)} KWD
                        </span>
                        {repairType === service.name && (
                          <Check className="w-4 h-4 text-purple-600" />
                        )}
                      </div>
                    </Button>
                  ))
                ) : (
                  <div className="col-span-5 text-center py-4 text-purple-600">
                    {isRtl
                      ? "لا توجد خدمات إصلاح متاحة. يرجى إضافة خدمات في قسم الإدارة."
                      : "No repair services available. Please add services in the management section."}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-dashed border-purple-200">
                <Label className={`block mb-2 ${textAlignClass}`}>
                  {isRtl ? "نوع الإصلاح المخصص" : "Custom Repair Type"}
                </Label>
                <Input
                  placeholder={isRtl ? "أدخل نوع الإصلاح" : "Enter repair type"}
                  value={repairType}
                  onChange={handleRepairTypeChange}
                  className={textAlignClass}
                />
              </div>

              <div>
                <Label className={`block mb-2 ${textAlignClass}`}>
                  {isRtl ? "وصف الإصلاح" : "Repair Description"}
                </Label>
                <Textarea
                  placeholder={
                    isRtl ? "أدخل تفاصيل الإصلاح" : "Enter repair details"
                  }
                  value={repairDescription}
                  onChange={handleRepairDescriptionChange}
                  rows={3}
                  className={textAlignClass}
                />
              </div>

              <div>
                <Label className={`block mb-2 ${textAlignClass}`}>
                  {isRtl ? "سعر الإصلاح" : "Repair Price"} (KWD)
                </Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={repairPrice || ""}
                  onChange={handleRepairPriceChange}
                  className={textAlignClass}
                />
              </div>

              <div className="mt-6 p-3 bg-purple-50 rounded-lg border border-purple-100 flex items-center justify-between">
                <span className="font-medium">
                  {isRtl ? "السعر الإجمالي:" : "Total Price:"}
                </span>
                <span className="text-lg font-bold text-purple-700">
                  {repairPrice.toFixed(3)} KWD
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
