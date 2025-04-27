import React, { useState, useEffect } from "react";
import { useLanguageStore } from "@/store/languageStore";
import { useInvoiceForm } from "./InvoiceFormContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  BadgePercent,
  Banknote,
  CreditCard,
  Check,
  CreditCard as CardIcon,
  Save,
  RefreshCw,
} from "lucide-react";
import { useInvoiceStore } from "@/store/invoiceStore";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { saveOrder as saveOrderToSupabase } from "@/services/invoiceService";

export const InvoiceStepPayment: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguageStore();
  const isRtl = language === "ar";
  const {
    getValues,
    setValue,
    calculateTotal,
    calculateRemaining,
    finalPrice,
    updateFinalPrice,
    validateCurrentStep,
  } = useInvoiceForm();

  const addWorkOrder = useInvoiceStore((state) => state.addWorkOrder);
  const addInvoice = useInvoiceStore((state) => state.addInvoice);

  const [discount, setDiscount] = useState(getValues("discount") || 0);
  const [finalPriceInput, setFinalPriceInput] = useState(0);
  const [deposit, setDeposit] = useState(getValues("deposit") || 0);
  const [paymentMethod, setPaymentMethod] = useState(
    getValues("paymentMethod") || ""
  );
  const [authNumber, setAuthNumber] = useState(getValues("authNumber") || "");
  const [orderSaved, setOrderSaved] = useState(
    !!getValues("workOrderId") && !!getValues("invoiceId")
  );
  const [showPaymentError, setShowPaymentError] = useState(false);

  const [total, setTotal] = useState(calculateTotal());
  const [remaining, setRemaining] = useState(calculateRemaining());

  const calculateSubtotal = () => {
    if (getValues("invoiceType") === "exam") {
      return getValues("servicePrice") || 0;
    } else if (getValues("invoiceType") === "glasses") {
      const lensPrice = getValues("lensPrice") || 0;
      const coatingPrice = getValues("coatingPrice") || 0;
      const thicknessPrice = getValues("thicknessPrice") || 0;
      const framePrice = getValues("skipFrame")
        ? 0
        : getValues("framePrice") || 0;
      return lensPrice + coatingPrice + thicknessPrice + framePrice;
    } else {
      const contactLensItems = getValues("contactLensItems") || [];
      return contactLensItems.reduce(
        (sum, lens) => sum + (lens.price || 0) * (lens.qty || 1),
        0
      );
    }
  };

  const subtotal = calculateSubtotal();

  useEffect(() => {
    const currentTotal = calculateTotal();
    setFinalPriceInput(currentTotal);

    setValue("isFinalPriceMode", true);
  }, []);

  useEffect(() => {
    const newTotal = calculateTotal();
    const newRemaining = Math.max(0, newTotal - deposit);

    setTotal(newTotal);
    setRemaining(newRemaining);

    setValue("total", newTotal);
    setValue("remaining", newRemaining);
    setValue("isPaid", newRemaining <= 0);
  }, [discount, deposit, calculateTotal]);

  const handleFinalPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setFinalPriceInput(value);

    const newDiscount = Math.max(0, subtotal - value);
    setDiscount(newDiscount);
    setValue("discount", newDiscount);
    updateFinalPrice(value);
  };

  const handleDepositChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setDeposit(value);
    setValue("deposit", value);
  };

  const handlePayInFull = () => {
    setDeposit(total);
    setValue("deposit", total);
  };

  const selectPaymentMethod = (method: string) => {
    setPaymentMethod(method);
    setValue("paymentMethod", method);
    if (showPaymentError) setShowPaymentError(false);
  };

  const handleAuthNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAuthNumber(e.target.value);
    setValue("authNumber", e.target.value);
  };

  const saveOrder = async () => {
    if (!paymentMethod) {
      setShowPaymentError(true);
      toast.error(t("paymentMethodRequired"));
      return;
    }

    if (!validateCurrentStep("payment")) {
      return;
    }

    const patientId = getValues("patientId") || "anonymous";
    const invoiceType = getValues("invoiceType") || "glasses";

    // Save to local store for immediate use
    let workOrder: any = {
      patientId,
    };

    if (invoiceType === "glasses") {
      workOrder.lensType = {
        name: getValues("lensType"),
        price: getValues("lensPrice"),
      };
    } else if (invoiceType === "contacts") {
      workOrder.contactLenses = getValues("contactLensItems") || [];
      workOrder.contactLensRx = getValues("contactLensRx") || null;
    }

    const workOrderId = addWorkOrder?.(workOrder) || `WO${Date.now()}`;
    setValue("workOrderId", workOrderId);

    const formData = getValues();
    const initialDeposit = formData.deposit || 0;

    // Create an initial payment entry for the deposit amount matching the exact structure from the database
    const initialPayment = {
      date: new Date().toISOString(),
      amount: initialDeposit,
      method: formData.paymentMethod,
    };

    // Only add a payment entry if there's an actual deposit
    const payments = initialDeposit > 0 ? [initialPayment] : [];

    const invoiceData: any = {
      patientId: formData.patientId,
      patientName: formData.patientName,
      patientPhone: formData.patientPhone,
      invoiceType: formData.invoiceType || "glasses",

      discount: formData.discount,
      deposit: formData.deposit,
      total: formData.total,

      paymentMethod: formData.paymentMethod,
      authNumber: formData.authNumber,
      workOrderId: workOrderId,
      payments: payments, // Include payments array with initial deposit
    };

    if (invoiceType === "glasses") {
      invoiceData.lensType = formData.lensType;
      invoiceData.lensPrice = formData.lensPrice;

      invoiceData.coating = formData.coating;
      invoiceData.coatingPrice = formData.coatingPrice;

      invoiceData.frameBrand = formData.frameBrand;
      invoiceData.frameModel = formData.frameModel;
      invoiceData.frameColor = formData.frameColor;
      invoiceData.framePrice = formData.framePrice;
    } else if (invoiceType === "contacts") {
      invoiceData.contactLensItems = formData.contactLensItems || [];
      invoiceData.contactLensRx = formData.contactLensRx || null;
    }

    const invoiceId = addInvoice(invoiceData);
    setValue("invoiceId", invoiceId);

    // Now save to Supabase
    try {
      const savingToastId = toast.loading("Saving order to database...");

      // Log what we're sending to Supabase
      console.log("Saving to Supabase with data:", {
        ...formData,
        payments: payments,
        workOrderId: workOrderId,
        invoiceId: invoiceId,
      });

      // Pass the payments array explicitly to the saveOrderToSupabase function
      const result = await saveOrderToSupabase({
        ...formData,
        payments: payments,
        workOrderId: workOrderId,
        invoiceId: invoiceId,
      });

      if (result.invoiceId) {
        // Update the invoiceId and workOrderId in case they're different
        if (result.invoiceId !== invoiceId) {
          setValue("invoiceId", result.invoiceId);
        }

        if (result.workOrderId && result.workOrderId !== workOrderId) {
          setValue("workOrderId", result.workOrderId);
        }

        toast.success("Order saved successfully to database");
        toast.dismiss(savingToastId);
      } else {
        // Even if Supabase fails, we can continue with local data
        toast.error(
          "Could not save to database, but order can still be processed locally"
        );
        toast.dismiss(savingToastId);
      }
    } catch (error) {
      console.error("Error saving to Supabase:", error);
      toast.error("Order saved locally, but database sync failed");
    }

    setOrderSaved(true);

    toast.success(`${t("orderSavedSuccess")}`);

    const event = new CustomEvent("navigateToSummary");
    window.dispatchEvent(event);
  };

  const textAlignClass = isRtl ? "text-right" : "text-left";
  const directionClass = isRtl ? "rtl" : "ltr";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border rounded-lg p-5 bg-card shadow-sm">
        <div className="border-b border-primary/30 pb-3 mb-4">
          <h3
            className={`text-lg font-semibold text-primary flex items-center gap-2 ${textAlignClass}`}
          >
            <BadgePercent className="w-5 h-5" />
            {t("discountSection")}
          </h3>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <BadgePercent className="w-5 h-5 text-primary" />
              </div>
              <Label
                htmlFor="finalPrice"
                className={`text-muted-foreground mb-1.5 block ${textAlignClass}`}
              >
                {isRtl ? "المبلغ النهائي:" : "Final Amount:"}
              </Label>
              <Input
                id="finalPrice"
                type="number"
                step="0.01"
                value={finalPriceInput || ""}
                onChange={handleFinalPriceChange}
                className={`pl-10 border-primary/20 focus:border-primary ${textAlignClass}`}
                placeholder={
                  isRtl
                    ? "أدخل السعر النهائي للعميل"
                    : "Enter the final price for the customer"
                }
              />
              {discount > 0 && (
                <div className="mt-1 text-xs text-red-500">
                  {isRtl
                    ? `الخصم: ${discount.toFixed(3)} د.ك`
                    : `Discount: ${discount.toFixed(3)} KWD`}
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Banknote className="w-5 h-5 text-green-500" />
              </div>
              <Label
                htmlFor="deposit"
                className={`text-muted-foreground mb-1.5 block ${textAlignClass}`}
              >
                {t("depositColon")}
              </Label>
              <Input
                id="deposit"
                type="number"
                step="0.01"
                value={deposit}
                onChange={(e) => handleDepositChange(e)}
                className={`pl-10 border-primary/20 focus:border-primary ${textAlignClass}`}
              />
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handlePayInFull}
            className="w-full border-primary/20 hover:bg-primary/5 text-primary hover:text-primary/80"
          >
            <Banknote
              className={`w-5 h-5 ${isRtl ? "ml-2" : "mr-2"} text-green-500`}
            />
            {t("payInFull")} ({total.toFixed(2)} {isRtl ? "د.ك" : t("kwd")})
          </Button>
        </div>
      </div>

      <div className="border rounded-lg p-5 bg-card shadow-sm">
        <div className="border-b border-primary/30 pb-3 mb-4">
          <h3
            className={`text-lg font-semibold text-primary flex items-center gap-2 ${textAlignClass}`}
          >
            <CreditCard className="w-5 h-5" />
            {t("paymentSection")}
          </h3>
        </div>

        <div
          className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${
            showPaymentError ? "border-2 border-red-500 rounded-md p-2" : ""
          }`}
        >
          <div
            className={`border rounded-lg p-3 text-center cursor-pointer transition-all ${
              paymentMethod === (isRtl ? "نقداً" : "Cash")
                ? "border-primary bg-primary/5 shadow-sm"
                : "hover:border-primary/30 hover:bg-muted/10"
            }`}
            onClick={() => selectPaymentMethod(isRtl ? "نقداً" : "Cash")}
          >
            <img
              src="https://cdn-icons-png.flaticon.com/512/7083/7083125.png"
              alt={t("cash")}
              title={t("cash")}
              className="w-12 h-10 object-contain mx-auto mb-2"
            />
            <span className="text-sm font-medium">{t("cash")}</span>
          </div>

          <div
            className={`border rounded-lg p-3 text-center cursor-pointer transition-all ${
              paymentMethod === (isRtl ? "كي نت" : "KNET")
                ? "border-primary bg-primary/5 shadow-sm"
                : "hover:border-primary/30 hover:bg-muted/10"
            }`}
            onClick={() => selectPaymentMethod(isRtl ? "كي نت" : "KNET")}
          >
            <img
              src="https://kabkg.com/staticsite/images/knet.png"
              alt={t("knet")}
              title={t("knet")}
              className="w-12 h-10 object-contain mx-auto mb-2"
            />
            <span className="text-sm font-medium">{t("knet")}</span>
          </div>

          <div
            className={`border rounded-lg p-3 text-center cursor-pointer transition-all ${
              paymentMethod === "Visa"
                ? "border-primary bg-primary/5 shadow-sm"
                : "hover:border-primary/30 hover:bg-muted/10"
            }`}
            onClick={() => selectPaymentMethod("Visa")}
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg"
              alt="Visa"
              title="Visa"
              className="w-12 h-10 object-contain mx-auto mb-2 bg-white rounded"
            />
            <span className="text-sm font-medium">{t("visa")}</span>
          </div>

          <div
            className={`border rounded-lg p-3 text-center cursor-pointer transition-all ${
              paymentMethod === "MasterCard"
                ? "border-primary bg-primary/5 shadow-sm"
                : "hover:border-primary/30 hover:bg-muted/10"
            }`}
            onClick={() => selectPaymentMethod("MasterCard")}
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg"
              alt="MasterCard"
              title="MasterCard"
              className="w-12 h-10 object-contain mx-auto mb-2 bg-white rounded"
            />
            <span className="text-sm font-medium">{t("mastercard")}</span>
          </div>
        </div>

        {showPaymentError && (
          <div className="mt-2 text-red-500 text-sm">
            {isRtl
              ? "يرجى اختيار طريقة الدفع"
              : "Please select a payment method"}
          </div>
        )}

        {(paymentMethod === "Visa" ||
          paymentMethod === "MasterCard" ||
          paymentMethod === "كي نت" ||
          paymentMethod === "KNET") && (
          <div className="mt-4 space-y-2">
            <Label
              htmlFor="authNumber"
              className={`text-muted-foreground block ${textAlignClass}`}
            >
              {t("approvalNumber")}:
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <CardIcon className="w-5 h-5 text-primary" />
              </div>
              <Input
                id="authNumber"
                value={authNumber}
                onChange={handleAuthNumberChange}
                placeholder="xxxxxx"
                className={`pl-10 ${textAlignClass}`}
              />
            </div>
          </div>
        )}

        <div className="mt-6 p-4 border rounded-lg bg-primary/5">
          <div
            className={`flex justify-between text-lg font-medium ${textAlignClass}`}
          >
            <span>{t("totalInvoice")}:</span>
            <span>
              {total.toFixed(2)} {isRtl ? "د.ك" : t("kwd")}
            </span>
          </div>

          <div
            className={`flex justify-between mt-2 text-green-600 ${textAlignClass}`}
          >
            <span>{t("deposit")}:</span>
            <span>
              {deposit.toFixed(2)} {isRtl ? "د.ك" : t("kwd")}
            </span>
          </div>

          <div
            className={`flex justify-between mt-2 ${
              remaining > 0 ? "text-amber-600" : "text-green-600"
            } font-medium ${textAlignClass}`}
          >
            <span>{t("remaining")}:</span>
            <span>
              {remaining.toFixed(2)} {isRtl ? "د.ك" : t("kwd")}
            </span>
          </div>
        </div>

        {!orderSaved ? (
          <motion.div
            className="mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Button className="w-full" size="lg" onClick={saveOrder}>
              <Save className="w-5 h-5 mr-2" />
              {isRtl ? "حفظ الطلب" : "Save Order"}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            className="mt-6 p-3 border border-green-500 rounded-lg flex items-center justify-center bg-green-50 text-green-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Check className="w-5 h-5 mr-2" />
            <span className="font-medium">
              {isRtl ? "تم حفظ الطلب بنجاح" : "Order saved successfully"}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
};
