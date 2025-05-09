import React, { useState, useEffect } from "react";
import {
  useInventoryStore,
  FrameItem,
  initInventoryStore,
} from "@/store/inventoryStore";
import * as frameService from "@/services/frameService"; // Add this import
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Glasses,
  Package,
  Edit,
  Copy,
  Save,
  Tag,
  QrCode,
  Printer,
  Upload,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import { FrameLabelTemplate, usePrintLabel } from "./FrameLabelTemplate";
import { useLanguageStore } from "@/store/languageStore";

interface ImportResult {
  added: number;
  duplicates: number;
  errors: number;
  errorDetails: string[];
}

const FrameItemCard = ({
  frame,
  index,
  onPrintLabel,
  onEdit,
  onCopy,
}: {
  frame: FrameItem;
  index: number;
  onPrintLabel: (frameId: string) => void;
  onEdit: (frame: FrameItem) => void;
  onCopy: (frame: FrameItem) => void;
}) => {
  const { t, language } = useLanguageStore();

  const getBrandColor = (brand: string): string => {
    const colors = [
      "bg-blue-50 border-blue-200 text-blue-800",
      "bg-purple-50 border-purple-200 text-purple-800",
      "bg-teal-50 border-teal-200 text-teal-800",
      "bg-amber-50 border-amber-200 text-amber-800",
      "bg-pink-50 border-pink-200 text-pink-800",
      "bg-indigo-50 border-indigo-200 text-indigo-800",
      "bg-emerald-50 border-emerald-200 text-emerald-800",
    ];

    let hash = 0;
    for (let i = 0; i < brand.length; i++) {
      hash = brand.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  };

  const colorClass = getBrandColor(frame.brand);
  const [bgClass, borderClass, textClass] = colorClass.split(" ");

  return (
    <Card
      key={index}
      className={`overflow-hidden hover:shadow-md transition-all duration-200 border-gray-200 border ${bgClass.replace(
        "bg-",
        "bg-opacity-30 bg-"
      )}`}
    >
      <CardHeader
        className={`p-3 ${bgClass} ${borderClass} border-b flex flex-row justify-between items-start`}
      >
        <div className="flex items-start gap-2">
          <Glasses
            className={`h-5 w-5 ${textClass.replace("text-", "text-")} mt-0.5`}
          />
          <div>
            <div className="font-bold text-base">
              {frame.brand} - {frame.model}
            </div>
            <div className="text-sm font-medium mt-0.5">
              {frame.price.toFixed(2)} KWD
            </div>
          </div>
        </div>
        <Badge
          variant={frame.qty > 5 ? "outline" : "destructive"}
          className={`text-xs rounded-full ${frame.qty > 5 ? textClass : ""}`}
        >
          {language === "ar"
            ? `في المخزون: ${frame.qty}`
            : `In Stock: ${frame.qty}`}
        </Badge>
      </CardHeader>
      <CardContent className="p-3 pt-2 text-sm">
        <div className="flex justify-between py-1 border-b border-gray-100">
          <span className={textClass}>{t("color")}:</span>
          <span>{frame.color || "-"}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className={textClass}>{t("size")}:</span>
          <span>{frame.size || "-"}</span>
        </div>
      </CardContent>
      <CardFooter className="p-0 border-t">
        <div className="grid grid-cols-3 w-full divide-x divide-x-reverse">
          <Button
            variant="ghost"
            className={`rounded-none h-10 ${textClass}`}
            onClick={() => onEdit(frame)}
          >
            <Edit className="h-4 w-4 mr-1" /> {t("edit")}
          </Button>
          <Button
            variant="ghost"
            className="rounded-none h-10 text-amber-600"
            onClick={() => onCopy(frame)}
          >
            <Copy className="h-4 w-4 mr-1" /> {t("copy")}
          </Button>
          <Button
            variant="ghost"
            className="rounded-none h-10 text-green-600"
            onClick={(e) => {
              e.stopPropagation();
              onPrintLabel(frame.frameId);
            }}
          >
            <QrCode className="h-4 w-4 mr-1" /> {t("print")}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export const FrameInventory: React.FC = () => {
  const {
    frames,
    fetchFrames,
    addFrame,
    searchFrames,
    bulkImportFrames,
    isLoadingFrames,
    updateFrame,
  } = useInventoryStore();
  const { printSingleLabel } = usePrintLabel();
  const { t, language } = useLanguageStore();

  const [frameSearchTerm, setFrameSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<FrameItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddFrameDialogOpen, setIsAddFrameDialogOpen] = useState(false);
  const [isEditFrameDialogOpen, setIsEditFrameDialogOpen] = useState(false);
  const [isLabelDialogOpen, setIsLabelDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [processedItems, setProcessedItems] = useState(0);
  const [totalItemsToProcess, setTotalItemsToProcess] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New state variables for paginated loading
  const [isLoadingPaginated, setIsLoadingPaginated] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingTotal, setLoadingTotal] = useState(0);

  const [frameBrand, setFrameBrand] = useState("");
  const [frameModel, setFrameModel] = useState("");
  const [frameColor, setFrameColor] = useState("");
  const [frameSize, setFrameSize] = useState("");
  const [framePrice, setFramePrice] = useState("");
  const [frameQty, setFrameQty] = useState("1");
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);

  const groupedByBrand = React.useMemo(() => {
    const grouped: Record<string, FrameItem[]> = {};

    searchResults.forEach((frame) => {
      if (!grouped[frame.brand]) {
        grouped[frame.brand] = [];
      }
      grouped[frame.brand].push(frame);
    });

    return Object.fromEntries(
      Object.entries(grouped).sort(([brandA], [brandB]) =>
        brandA.localeCompare(brandB)
      )
    );
  }, [searchResults]);

  const handleFrameSearch = async () => {
    setIsSearching(true);
    try {
      const results = await searchFrames(frameSearchTerm);
      setSearchResults(results);

      if (results.length === 0) {
        toast(t("noFramesMatchingSearch"));
      }
    } catch (error) {
      console.error("Error searching frames:", error);
      toast.error(t("errorSearchingFrames") || "Error searching frames");
    } finally {
      setIsSearching(false);
    }
  };

  const resetFrameForm = () => {
    setFrameBrand("");
    setFrameModel("");
    setFrameColor("");
    setFrameSize("");
    setFramePrice("");
    setFrameQty("1");
    setEditingFrameId(null);
  };

  const handleAddFrame = async () => {
    if (!frameBrand || !frameModel || !frameColor || !framePrice) {
      toast.error(t("pleaseEnterCompleteFrameDetails"));
      return;
    }

    const price = parseFloat(framePrice);
    const qty = parseInt(frameQty);

    if (isNaN(price) || price <= 0) {
      toast.error(t("pleaseEnterValidPrice"));
      return;
    }

    if (isNaN(qty) || qty <= 0) {
      toast.error(t("pleaseEnterValidQuantity"));
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingFrameId) {
        // Update existing frame
        const success = await updateFrame(editingFrameId, {
          brand: frameBrand,
          model: frameModel,
          color: frameColor,
          size: frameSize,
          price,
          qty,
        });

        if (success) {
          toast.success(
            t("frameUpdatedSuccessfully") || "Frame updated successfully"
          );
          setIsEditFrameDialogOpen(false);
          resetFrameForm();
          await fetchFrames();
        } else {
          toast.error(t("errorUpdatingFrame") || "Error updating frame");
        }
      } else {
        // Add new frame
        const frameId = await addFrame({
          brand: frameBrand,
          model: frameModel,
          color: frameColor,
          size: frameSize,
          price,
          qty,
        });

        if (frameId) {
          toast.success(t("frameAddedSuccessfully"));
          setIsAddFrameDialogOpen(false);
          resetFrameForm();
          await fetchFrames();
        } else {
          toast.error(t("errorAddingFrame") || "Error adding frame");
        }
      }
    } catch (error) {
      console.error("Error saving frame:", error);
      toast.error(t("errorSavingFrame") || "Error saving frame");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditFrame = (frame: FrameItem) => {
    // Set form values with frame data
    setFrameBrand(frame.brand);
    setFrameModel(frame.model);
    setFrameColor(frame.color);
    setFrameSize(frame.size);
    setFramePrice(frame.price.toString());
    setFrameQty(frame.qty.toString());
    setEditingFrameId(frame.frameId);

    // Open the edit dialog
    setIsEditFrameDialogOpen(true);
  };

  const handleCopyFrame = (frame: FrameItem) => {
    // Set form values with frame data, but keep frameId empty for new frame
    setFrameBrand(frame.brand);
    setFrameModel(frame.model);
    setFrameColor(frame.color);
    setFrameSize(frame.size);
    setFramePrice(frame.price.toString());
    setFrameQty(frame.qty.toString());

    // Open the add dialog
    setIsAddFrameDialogOpen(true);
  };

  const handleImportFrames = () => {
    setIsImporting(true);
    setIsProcessingImport(false);
    setImportResult(null);

    try {
      const lines = importData
        .trim()
        .split("\n")
        .filter((line) => line.trim().length > 0);

      const filteredLines = lines.filter(
        (line) =>
          !line.toLowerCase().includes("brand") &&
          !line.toLowerCase().includes("model") &&
          line.trim().length > 0
      );

      setTotalItemsToProcess(filteredLines.length);
      setProcessedItems(0);

      if (filteredLines.length === 0) {
        toast.error(t("noValidDataToImport"));
        setIsImporting(false);
        return;
      }

      setIsProcessingImport(true);
      processImportBatch(filteredLines, 0, [], []);
    } catch (error) {
      toast.error(
        `Import failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setImportResult({
        added: 0,
        duplicates: 0,
        errors: 1,
        errorDetails: [
          `General error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
      });
      setIsImporting(false);
    }
  };

  const processImportBatch = (
    lines: string[],
    currentIndex: number,
    parsedFrames: Array<Omit<FrameItem, "frameId" | "createdAt">>,
    errors: string[]
  ) => {
    const BATCH_SIZE = 100;
    const end = Math.min(currentIndex + BATCH_SIZE, lines.length);

    for (let i = currentIndex; i < end; i++) {
      try {
        const line = lines[i].trim();

        const parts = line.split(",").map((part) => part.trim());

        if (parts.length < 4) {
          errors.push(
            `Line ${
              i + 1
            }: Not enough data. Expected at least 4 values (brand, model, color, price).`
          );
          continue;
        }

        const brand = parts[0];
        const model = parts[1];
        const color = parts[2];
        const price = parseFloat(parts[3].replace(/[^\d.-]/g, ""));
        const size = parts.length > 4 ? parts[4] : "";
        const qty = parts.length > 5 ? parseInt(parts[5]) : 1;

        if (isNaN(price) || price <= 0) {
          errors.push(`Line ${i + 1}: Invalid price value "${parts[3]}".`);
          continue;
        }

        if (isNaN(qty) || qty <= 0) {
          errors.push(
            `Line ${i + 1}: Invalid quantity value "${parts[5] || 1}".`
          );
          continue;
        }

        parsedFrames.push({
          brand,
          model,
          color,
          size,
          price,
          qty,
        });
      } catch (error) {
        errors.push(
          `Line ${i + 1}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    setProcessedItems(end);

    if (end < lines.length) {
      setTimeout(() => {
        processImportBatch(lines, end, parsedFrames, errors);
      }, 0);
    } else {
      finishImport(parsedFrames, errors);
    }
  };

  const finishImport = async (
    parsedFrames: Array<Omit<FrameItem, "frameId" | "createdAt">>,
    errors: string[]
  ) => {
    try {
      const result = await bulkImportFrames(parsedFrames);

      setImportResult({
        added: result.added,
        duplicates: result.duplicates,
        errors: errors.length,
        errorDetails: errors,
      });

      // Refresh search results with updated frames
      await fetchFrames();
      setSearchResults(frames);

      if (result.added > 0) {
        toast.success(`${result.added} frames imported successfully`);
      }

      if (result.duplicates > 0) {
        toast.warning(
          `${result.duplicates} duplicate frames were detected and skipped`
        );
      }

      if (errors.length > 0) {
        toast.error(`${errors.length} errors occurred during import`);
      }
    } catch (error) {
      toast.error(
        `Final import processing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsImporting(false);
      setIsProcessingImport(false);
    }
  };

  useEffect(() => {
    // Initialize by loading frames from Supabase on component mount with pagination
    const init = async () => {
      setIsLoadingPaginated(true);
      setLoadingProgress(0);
      
      try {
        // Use direct API calls to show progress during pagination
        const pageSize = 1000;
        let page = 0;
        let allFrames: FrameItem[] = [];
        let hasMore = true;
        
        while (hasMore) {
          const frames = await frameService.getAllFrames({ page, pageSize });
          allFrames = [...allFrames, ...frames];
          
          setLoadingProgress(page + 1);
          
          // If we got fewer items than the page size, we've reached the end
          if (frames.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
        
        setSearchResults(allFrames);
      } catch (error) {
        console.error('Error fetching frames:', error);
        toast.error(t("errorFetchingFrames") || "Error fetching frames");
      } finally {
        setIsLoadingPaginated(false);
      }
    };

    init();
  }, []);

  // Update search results when frames change, but don't override search results
  useEffect(() => {
    if (!isSearching && !isLoadingFrames && frameSearchTerm.trim() === '') {
      setSearchResults(frames);
    }
  }, [frames, isSearching, isLoadingFrames, frameSearchTerm]);

  const isRtl = language === "ar";
  const dirClass = isRtl ? "rtl" : "ltr";

  return (
    <div className={`space-y-6 ${dirClass}`}>
      <div className="flex flex-col md:flex-row justify-between items-stretch gap-4">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className={`absolute ${
                isRtl ? "right-3" : "left-3"
              } top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground`}
            />
            <Input
              value={frameSearchTerm}
              onChange={(e) => setFrameSearchTerm(e.target.value)}
              placeholder={isRtl ? "بحث عن إطار" : "Search for frame"}
              className={`${
                isRtl ? "pr-9 text-right" : "pl-9 text-left"
              } w-full`}
              onKeyDown={(e) => e.key === "Enter" && handleFrameSearch()}
              disabled={isSearching || isLoadingFrames}
            />
          </div>
          <Button
            onClick={handleFrameSearch}
            variant="secondary"
            className="shrink-0"
            disabled={isSearching || isLoadingFrames}
          >
            {isSearching ? (
              <Loader2
                className={`h-4 w-4 ${isRtl ? "ml-1" : "mr-1"} animate-spin`}
              />
            ) : (
              <Search className={`h-4 w-4 ${isRtl ? "ml-1" : "mr-1"}`} />
            )}
            {t("search")}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsLabelDialogOpen(true)}
            className="shrink-0"
          >
            <Tag className={`h-4 w-4 ${isRtl ? "ml-1" : "mr-1"}`} />
            {isRtl ? "طباعة الملصقات" : "Print Labels"}
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsImportDialogOpen(true)}
            className="shrink-0 border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Upload className={`h-4 w-4 ${isRtl ? "ml-1" : "mr-1"}`} />
            {isRtl ? "استيراد الإطارات" : "Import Frames"}
          </Button>

          <Button
            onClick={() => {
              resetFrameForm();
              setIsAddFrameDialogOpen(true);
            }}
            className="shrink-0"
          >
            <Plus className={`h-4 w-4 ${isRtl ? "ml-1" : "mr-1"}`} />
            {isRtl ? "إضافة إطار جديد" : "Add New Frame"}
          </Button>
        </div>
      </div>

      {isLoadingPaginated ? (
        <div className="flex flex-col justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">
            {isRtl ? "جاري تحميل الإطارات..." : "Loading frames..."}
          </p>
          <div className="w-64 mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{isRtl ? "صفحة:" : "Page:"} {loadingProgress}</span>
              <span>{isRtl ? "جاري التحميل" : "Loading..."}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(loadingProgress * 10, 100)}%`,
                }}
              ></div>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
              {isRtl ? "تم تحميل" : "Loaded"} {loadingProgress * 1000}+ {isRtl ? "إطار" : "frames"}
            </p>
          </div>
        </div>
      ) : isLoadingFrames ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <p className="text-lg font-medium">
            {t("loadingFrames") || "Loading frames..."}
          </p>
        </div>
      ) : Object.keys(groupedByBrand).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedByBrand).map(([brand, brandFrames]) => (
            <CollapsibleCard
              key={brand}
              title={`${brand} (${brandFrames.length})`}
              defaultOpen={true}
              headerClassName="bg-gradient-to-r from-amber-50 to-amber-100"
              titleClassName="text-amber-800 font-medium flex items-center gap-2"
              contentClassName="p-4 bg-white"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {brandFrames.map((frame, index) => (
                  <FrameItemCard
                    key={frame.frameId}
                    frame={frame}
                    index={index}
                    onPrintLabel={printSingleLabel}
                    onEdit={handleEditFrame}
                    onCopy={handleCopyFrame}
                  />
                ))}
              </div>
            </CollapsibleCard>
          ))}
        </div>
      ) : (
        <div className="bg-muted/30 rounded-lg p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-medium mb-1">
            {isRtl ? "لم يتم العثور على إطارات" : "No frames found"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {isRtl
              ? "لم يتم العثور على إطارات مطابقة لمعايير البحث."
              : "No frames matching search criteria found."}
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              setFrameSearchTerm("");
              await fetchFrames();
              setSearchResults(frames);
            }}
          >
            {isRtl ? "عرض جميع الإطارات" : "Show all frames"}
          </Button>
        </div>
      )}

      <Dialog
        open={isAddFrameDialogOpen}
        onOpenChange={setIsAddFrameDialogOpen}
      >
        <DialogContent className={`max-w-md ${dirClass}`}>
          <DialogHeader>
            <DialogTitle>
              {isRtl ? "إضافة إطار جديد" : "Add New Frame"}
            </DialogTitle>
            <DialogDescription>
              {isRtl
                ? "أدخل بيانات الإطار الجديد لإضافته إلى المخزون"
                : "Enter the new frame details to add it to inventory"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="frameBrand">{t("brand")}</Label>
                <Input
                  id="frameBrand"
                  value={frameBrand}
                  onChange={(e) => setFrameBrand(e.target.value)}
                  placeholder={isRtl ? "مثال: ريبان" : "Example: RayBan"}
                  className={isRtl ? "text-right" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="frameModel">{t("model")}</Label>
                <Input
                  id="frameModel"
                  value={frameModel}
                  onChange={(e) => setFrameModel(e.target.value)}
                  placeholder={isRtl ? "مثال: واي فيرر" : "Example: Wayfarer"}
                  className={isRtl ? "text-right" : ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="frameColor">{t("color")}</Label>
                <Input
                  id="frameColor"
                  value={frameColor}
                  onChange={(e) => setFrameColor(e.target.value)}
                  placeholder={isRtl ? "مثال: أسود" : "Example: Black"}
                  className={isRtl ? "text-right" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="frameSize">{t("size")}</Label>
                <Input
                  id="frameSize"
                  value={frameSize}
                  onChange={(e) => setFrameSize(e.target.value)}
                  placeholder={isRtl ? "مثال: 52-18-145" : "Example: 52-18-145"}
                  className={isRtl ? "text-right" : ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="framePrice">
                  {isRtl ? "السعر (د.ك)" : "Price (KWD)"}
                </Label>
                <Input
                  id="framePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={framePrice}
                  onChange={(e) => setFramePrice(e.target.value)}
                  placeholder="0.00"
                  className={isRtl ? "text-right" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="frameQty">{t("quantity")}</Label>
                <Input
                  id="frameQty"
                  type="number"
                  step="1"
                  min="1"
                  value={frameQty}
                  onChange={(e) => setFrameQty(e.target.value)}
                  className={isRtl ? "text-right" : ""}
                />
              </div>
            </div>
          </div>

          <DialogFooter className={isRtl ? "flex-row-reverse" : ""}>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddFrameDialogOpen(false);
                resetFrameForm();
              }}
              disabled={isSubmitting}
            >
              {isRtl ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleAddFrame} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2
                  className={`h-4 w-4 ${isRtl ? "ml-1" : "mr-1"} animate-spin`}
                />
              ) : (
                <Save className={`h-4 w-4 ${isRtl ? "ml-1" : "mr-1"}`} />
              )}
              {isRtl ? "حفظ الإطار" : "Save Frame"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditFrameDialogOpen}
        onOpenChange={setIsEditFrameDialogOpen}
      >
        <DialogContent className={`max-w-md ${dirClass}`}>
          <DialogHeader>
            <DialogTitle>{isRtl ? "تعديل الإطار" : "Edit Frame"}</DialogTitle>
            <DialogDescription>
              {isRtl ? "قم بتحديث بيانات الإطار" : "Update frame details"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editFrameBrand">{t("brand")}</Label>
                <Input
                  id="editFrameBrand"
                  value={frameBrand}
                  onChange={(e) => setFrameBrand(e.target.value)}
                  className={isRtl ? "text-right" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editFrameModel">{t("model")}</Label>
                <Input
                  id="editFrameModel"
                  value={frameModel}
                  onChange={(e) => setFrameModel(e.target.value)}
                  className={isRtl ? "text-right" : ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editFrameColor">{t("color")}</Label>
                <Input
                  id="editFrameColor"
                  value={frameColor}
                  onChange={(e) => setFrameColor(e.target.value)}
                  className={isRtl ? "text-right" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editFrameSize">{t("size")}</Label>
                <Input
                  id="editFrameSize"
                  value={frameSize}
                  onChange={(e) => setFrameSize(e.target.value)}
                  className={isRtl ? "text-right" : ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editFramePrice">
                  {isRtl ? "السعر (د.ك)" : "Price (KWD)"}
                </Label>
                <Input
                  id="editFramePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={framePrice}
                  onChange={(e) => setFramePrice(e.target.value)}
                  className={isRtl ? "text-right" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editFrameQty">{t("quantity")}</Label>
                <Input
                  id="editFrameQty"
                  type="number"
                  step="1"
                  min="1"
                  value={frameQty}
                  onChange={(e) => setFrameQty(e.target.value)}
                  className={isRtl ? "text-right" : ""}
                />
              </div>
            </div>
          </div>

          <DialogFooter className={isRtl ? "flex-row-reverse" : ""}>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditFrameDialogOpen(false);
                resetFrameForm();
              }}
              disabled={isSubmitting}
            >
              {isRtl ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleAddFrame} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2
                  className={`h-4 w-4 ${isRtl ? "ml-1" : "mr-1"} animate-spin`}
                />
              ) : (
                <Save className={`h-4 w-4 ${isRtl ? "ml-1" : "mr-1"}`} />
              )}
              {isRtl ? "حفظ التغييرات" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLabelDialogOpen} onOpenChange={setIsLabelDialogOpen}>
        <DialogContent className={`max-w-5xl max-h-[90vh] ${dirClass}`}>
          <DialogHeader>
            <DialogTitle>
              {isRtl ? "طباعة ملصقات الإطارات" : "Print Frame Labels"}
            </DialogTitle>
            <DialogDescription>
              {isRtl
                ? "اختر الإطارات المراد طباعة ملصقات لها"
                : "Select frames for label printing"}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto">
            <FrameLabelTemplate />
          </div>

          <DialogFooter className={isRtl ? "flex-row-reverse" : ""}>
            <Button
              variant="outline"
              onClick={() => setIsLabelDialogOpen(false)}
            >
              {isRtl ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className={`max-w-2xl max-h-[90vh] ${dirClass}`}>
          <DialogHeader>
            <DialogTitle>
              {isRtl ? "استيراد الإطارات" : "Import Frames"}
            </DialogTitle>
            <DialogDescription>
              {isRtl
                ? "أدخل بيانات الإطارات بتنسيق CSV: العلامة التجارية، الموديل، اللون، السعر، الحجم (اختياري)، الكمية (اختياري)"
                : "Enter frame data in CSV format: Brand, Model, Color, Price, Size (optional), Quantity (optional)"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Label htmlFor="importData">
              {isRtl ? "بيانات الإطارات" : "Frame Data"}
            </Label>
            <Textarea
              id="importData"
              placeholder="Brand, Model, Color, Price, Size, Quantity"
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="h-64 font-mono"
              disabled={isImporting}
            />

            {isProcessingImport && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Processing frames...</span>
                  <span>
                    {processedItems} / {totalItemsToProcess}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.round(
                        (processedItems / totalItemsToProcess) * 100
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>
            )}

            {importResult && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="flex flex-col items-center">
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 flex items-center gap-1.5 p-1.5"
                    >
                      <Check className="h-4 w-4" />
                      <span className="font-mono">{importResult.added}</span>
                    </Badge>
                    <span className="text-xs mt-1 text-muted-foreground">
                      {isRtl ? "تمت الإضافة" : "Added"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-700 flex items-center gap-1.5 p-1.5"
                    >
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-mono">
                        {importResult.duplicates}
                      </span>
                    </Badge>
                    <span className="text-xs mt-1 text-muted-foreground">
                      {isRtl ? "تكرار" : "Duplicates"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Badge
                      variant="outline"
                      className="bg-red-50 text-red-700 flex items-center gap-1.5 p-1.5"
                    >
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-mono">{importResult.errors}</span>
                    </Badge>
                    <span className="text-xs mt-1 text-muted-foreground">
                      {isRtl ? "أخطاء" : "Errors"}
                    </span>
                  </div>
                </div>

                {importResult.errorDetails.length > 0 && (
                  <div className="mt-2">
                    <Label className="mb-1 block">
                      {isRtl ? "تفاصيل الأخطاء" : "Error Details"}
                    </Label>
                    <div className="max-h-36 overflow-y-auto rounded border bg-muted/30 p-2 text-sm">
                      {importResult.errorDetails.map((error, index) => (
                        <div
                          key={index}
                          className="text-red-600 font-mono text-xs mb-1"
                        >
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className={isRtl ? "flex-row-reverse" : ""}>
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(false)}
            >
              {isRtl ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleImportFrames}
              disabled={isImporting || !importData.trim()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {isRtl
                ? isImporting
                  ? "جاري الاستيراد..."
                  : "استيراد الإطارات"
                : isImporting
                ? "Importing..."
                : "Import Frames"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
