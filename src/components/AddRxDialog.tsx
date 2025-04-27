import React, { useState, useEffect } from "react";
import { useLanguageStore } from "@/store/languageStore";
import { RxData } from "@/store/patientStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Save, Glasses, Eye, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface AddRxDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rxData: RxData) => void;
  initialRx?: RxData;
  patientId: string;
}

export const AddRxDialog: React.FC<AddRxDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  initialRx,
  patientId,
}) => {
  const { language, t } = useLanguageStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [rxData, setRxData] = useState<RxData>(
    initialRx || {
      sphereOD: "",
      cylOD: "",
      axisOD: "",
      addOD: "",
      sphereOS: "",
      cylOS: "",
      axisOS: "",
      addOS: "",
      pdRight: "",
      pdLeft: "",
    }
  );

  const [validationErrors, setValidationErrors] = useState({
    rightEye: { cylinderAxisError: false },
    leftEye: { cylinderAxisError: false },
  });

  // Validate cylinder/axis relationship on component mount and when rxData changes
  useEffect(() => {
    validateCylinderAxis("rightEye", rxData.cylOD, rxData.axisOD);
    validateCylinderAxis("leftEye", rxData.cylOS, rxData.axisOS);
  }, [rxData]);

  // Validate that if cylinder has a value, axis must also have a value
  const validateCylinderAxis = (
    eye: "rightEye" | "leftEye",
    cylinder: string,
    axis: string
  ) => {
    // If cylinder has a non-empty value, axis must also have a non-empty value
    const hasCylinder = cylinder !== "";
    const hasAxis = axis !== "";

    setValidationErrors((prev) => ({
      ...prev,
      [eye]: {
        ...prev[eye],
        cylinderAxisError: hasCylinder && !hasAxis,
      },
    }));
  };

  const handleChange = (field: keyof RxData, value: string) => {
    setRxData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Validate cylinder/axis relationship on change
    if (field === "cylOD" || field === "axisOD") {
      validateCylinderAxis(
        "rightEye",
        field === "cylOD" ? value : rxData.cylOD,
        field === "axisOD" ? value : rxData.axisOD
      );
    } else if (field === "cylOS" || field === "axisOS") {
      validateCylinderAxis(
        "leftEye",
        field === "cylOS" ? value : rxData.cylOS,
        field === "axisOS" ? value : rxData.axisOS
      );
    }
  };

  const handleSave = async () => {
    // Check for validation errors before saving
    if (
      validationErrors.rightEye.cylinderAxisError ||
      validationErrors.leftEye.cylinderAxisError
    ) {
      return; // Prevent saving if there are validation errors
    }

    try {
      setIsSubmitting(true);

      // Call the parent's onSave method which will handle saving to Supabase
      onSave({
        ...rxData,
        createdAt: new Date().toISOString(),
      });

      onClose();
    } catch (error) {
      console.error("Error in save process:", error);
      toast.error(
        language === "ar" ? "حدث خطأ غير متوقع" : "An unexpected error occurred"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate values for dropdowns
  const generateSphValues = () => {
    const values = [];
    for (let i = -30; i <= 20; i += 0.25) {
      values.push(i.toFixed(2));
    }
    return values;
  };

  const generateCylValues = () => {
    const values = [];
    for (let i = -10; i <= 0; i += 0.25) {
      values.push(i.toFixed(2));
    }
    return values;
  };

  const generateAxisValues = () => {
    const values = [];
    for (let i = 0; i <= 180; i += 1) {
      values.push(i.toString());
    }
    return values;
  };

  const generateAddValues = () => {
    const values = [""];
    for (let i = 0.75; i <= 4; i += 0.25) {
      values.push(i.toFixed(2));
    }
    return values;
  };

  const generatePdValues = () => {
    const values = [""];
    // Updated PD range to start from 20 to 50 as requested
    for (let i = 20; i <= 50; i += 1) {
      values.push(i.toString());
    }
    return values;
  };

  const sphValues = generateSphValues();
  const cylValues = generateCylValues();
  const axisValues = generateAxisValues();
  const addValues = generateAddValues();
  const pdValues = generatePdValues();

  // Check if there are any validation errors
  const hasValidationErrors =
    validationErrors.rightEye.cylinderAxisError ||
    validationErrors.leftEye.cylinderAxisError;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white rounded-lg shadow-xl border-0 p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-t-lg">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Glasses className="h-5 w-5" />
            {language === "ar" ? "إضافة وصفة جديدة" : "Add New Prescription"}
          </DialogTitle>
          <DialogDescription className="text-indigo-100 opacity-90 text-sm">
            {language === "ar"
              ? "أدخل بيانات الوصفة الطبية الجديدة للنظارات"
              : "Enter the details for the new glasses prescription"}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Prescription Table */}
            <div className="overflow-x-auto bg-white border border-indigo-100 rounded-lg shadow-sm">
              <table className="w-full text-sm ltr compact-table">
                <thead className="bg-indigo-600 text-white">
                  <tr>
                    <th className="p-2 text-left font-medium"></th>
                    <th className="p-2 text-left font-medium">SPH</th>
                    <th className="p-2 text-left font-medium">CYL</th>
                    <th className="p-2 text-left font-medium">AXIS</th>
                    <th className="p-2 text-left font-medium">ADD</th>
                    <th className="p-2 text-left font-medium">PD</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Right Eye (OD) Row */}
                  <tr className="border-b border-indigo-100 bg-indigo-50/50">
                    <td className="p-2 font-medium text-indigo-800 flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-indigo-600" />
                      {language === "ar"
                        ? "العين اليمنى (OD)"
                        : "Right Eye (OD)"}
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full h-8 text-xs rounded border border-indigo-200 bg-white px-2 ltr"
                        value={rxData.sphereOD}
                        onChange={(e) =>
                          handleChange("sphereOD", e.target.value)
                        }
                        dir="ltr"
                      >
                        <option value="">-</option>
                        {sphValues.map((val) => (
                          <option key={`sph-od-${val}`} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full h-8 text-xs rounded border border-indigo-200 bg-white px-2 ltr"
                        value={rxData.cylOD}
                        onChange={(e) => handleChange("cylOD", e.target.value)}
                        dir="ltr"
                      >
                        <option value="">-</option>
                        {cylValues.map((val) => (
                          <option key={`cyl-od-${val}`} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        className={`w-full h-8 text-xs rounded border ${
                          validationErrors.rightEye.cylinderAxisError
                            ? "border-red-500 bg-red-50"
                            : "border-indigo-200 bg-white"
                        } px-2 ltr`}
                        value={rxData.axisOD}
                        onChange={(e) => handleChange("axisOD", e.target.value)}
                        dir="ltr"
                      >
                        <option value="">-</option>
                        {axisValues.map((val) => (
                          <option key={`axis-od-${val}`} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full h-8 text-xs rounded border border-indigo-200 bg-white px-2 ltr"
                        value={rxData.addOD}
                        onChange={(e) => handleChange("addOD", e.target.value)}
                        dir="ltr"
                      >
                        <option value="">-</option>
                        {addValues.map((val) => (
                          <option key={`add-od-${val}`} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full h-8 text-xs rounded border border-indigo-200 bg-white px-2 ltr"
                        value={rxData.pdRight}
                        onChange={(e) =>
                          handleChange("pdRight", e.target.value)
                        }
                        dir="ltr"
                      >
                        <option value="">-</option>
                        {pdValues.map((val) => (
                          <option key={`pd-right-${val}`} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>

                  {/* Left Eye (OS) Row */}
                  <tr className="bg-purple-50/50">
                    <td className="p-2 font-medium text-purple-800 flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-purple-600" />
                      {language === "ar"
                        ? "العين اليسرى (OS)"
                        : "Left Eye (OS)"}
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full h-8 text-xs rounded border border-purple-200 bg-white px-2 ltr"
                        value={rxData.sphereOS}
                        onChange={(e) =>
                          handleChange("sphereOS", e.target.value)
                        }
                        dir="ltr"
                      >
                        <option value="">-</option>
                        {sphValues.map((val) => (
                          <option key={`sph-os-${val}`} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full h-8 text-xs rounded border border-purple-200 bg-white px-2 ltr"
                        value={rxData.cylOS}
                        onChange={(e) => handleChange("cylOS", e.target.value)}
                        dir="ltr"
                      >
                        <option value="">-</option>
                        {cylValues.map((val) => (
                          <option key={`cyl-os-${val}`} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        className={`w-full h-8 text-xs rounded border ${
                          validationErrors.leftEye.cylinderAxisError
                            ? "border-red-500 bg-red-50"
                            : "border-purple-200 bg-white"
                        } px-2 ltr`}
                        value={rxData.axisOS}
                        onChange={(e) => handleChange("axisOS", e.target.value)}
                        dir="ltr"
                      >
                        <option value="">-</option>
                        {axisValues.map((val) => (
                          <option key={`axis-os-${val}`} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full h-8 text-xs rounded border border-purple-200 bg-white px-2 ltr"
                        value={rxData.addOS}
                        onChange={(e) => handleChange("addOS", e.target.value)}
                        dir="ltr"
                      >
                        <option value="">-</option>
                        {addValues.map((val) => (
                          <option key={`add-os-${val}`} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full h-8 text-xs rounded border border-purple-200 bg-white px-2 ltr"
                        value={rxData.pdLeft}
                        onChange={(e) => handleChange("pdLeft", e.target.value)}
                        dir="ltr"
                      >
                        <option value="">-</option>
                        {pdValues.map((val) => (
                          <option key={`pd-left-${val}`} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Validation error message */}
            {hasValidationErrors && (
              <div className="p-3 mt-2 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-red-700 text-sm">
                  {t("axisValidationError") ||
                    "The AXIS values you've inserted are not correct! If CYL value is provided, AXIS value is required."}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="bg-gray-50 p-4 border-t flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-md border-gray-300 hover:bg-gray-100 transition-all"
          >
            {language === "ar" ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={hasValidationErrors || isSubmitting}
            className={`rounded-md ${
              hasValidationErrors || isSubmitting
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            } text-white transition-all`}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting
              ? language === "ar"
                ? "جاري الحفظ..."
                : "Saving..."
              : language === "ar"
              ? "حفظ الوصفة"
              : "Save Prescription"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
