import React, { useState, useEffect, CSSProperties } from "react";
import { toast as sonnerToast } from "sonner";
import QRCodeReact from "qrcode.react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { useInventoryStore, FrameItem } from "@/store/inventoryStore";
import {
  Check,
  AlertTriangle,
  Calendar,
  SortDesc,
  SortAsc,
  Search,
  ListFilter,
} from "lucide-react";
import { useLanguageStore } from "@/store/languageStore";
import { PrintService } from "@/utils/PrintService";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface FrameLabelTemplateProps {
  onPrintError?: (errorMessage: string) => void;
}

/**
 * Custom hook for frame label printing functionality
 */
export const usePrintLabel = (onError?: (message: string) => void) => {
  const { frames } = useInventoryStore();
  const { t } = useLanguageStore();
  const [isPrinting, setIsPrinting] = useState(false);

  const generateQRCodeDataURL = (text: string): Promise<string> => {
    return QRCode.toDataURL(text, {
      width: 200,
      height: 200,
      margin: 0,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H", // High error correction capability
    });
  };

  const printSingleLabel = async (frameId: string) => {
    const frame = frames.find((f) => f.frameId === frameId);

    if (!frame) {
      const errorMsg = t("frameNotFound");
      sonnerToast(errorMsg);
      if (onError) onError(errorMsg);
      return;
    }

    try {
      setIsPrinting(true);
      console.log(
        `[LabelPrinting] Starting single label print for frame ${frameId}`
      );

      const qrCodeDataURL = await generateQRCodeDataURL(frame.frameId);
      const labelContent = createFrameLabelContent(frame, qrCodeDataURL);
      const htmlDocument = PrintService.prepareLabelDocument(labelContent);

      console.log(
        "[LabelPrinting] Generated QR code data URL length:",
        qrCodeDataURL.length
      );

      PrintService.printHtml(htmlDocument, "label", () => {
        console.log(
          `[LabelPrinting] Print process completed for frame ${frameId}`
        );
        setIsPrinting(false);
        sonnerToast.success(t("labelPrintedSuccessfully"));
      });
    } catch (error) {
      console.error("[LabelPrinting] QR code generation error:", error);
      const errorMsg = t("errorGeneratingQRCode");
      sonnerToast.error(errorMsg);
      if (onError) onError(errorMsg);
      setIsPrinting(false);
    }
  };

  const printMultipleLabels = async (frameIds: string[]) => {
    if (frameIds.length === 0) {
      const errorMsg = t("noFramesSelected");
      sonnerToast.warning(errorMsg);
      if (onError) onError(errorMsg);
      return;
    }

    const selectedFrames = frames.filter((f) => frameIds.includes(f.frameId));

    if (selectedFrames.length === 0) {
      const errorMsg = t("noFramesFound");
      sonnerToast.warning(errorMsg);
      if (onError) onError(errorMsg);
      return;
    }

    try {
      setIsPrinting(true);
      console.log(
        `[LabelPrinting] Starting multi-label print for ${selectedFrames.length} frames`
      );

      let allLabelsContent = "";

      for (const frame of selectedFrames) {
        console.log(
          `[LabelPrinting] Generating label content for frame ${frame.frameId}`
        );
        const qrCodeDataURL = await generateQRCodeDataURL(frame.frameId);
        allLabelsContent += createFrameLabelContent(frame, qrCodeDataURL);
      }

      const htmlDocument = PrintService.prepareLabelDocument(allLabelsContent);

      PrintService.printHtml(htmlDocument, "label", () => {
        console.log(
          `[LabelPrinting] Print process completed for ${selectedFrames.length} frames`
        );
        setIsPrinting(false);
        sonnerToast.success(t("labelsPrintedSuccessfully"));
      });
    } catch (error) {
      console.error("[LabelPrinting] QR code generation error:", error);
      const errorMsg = t("errorGeneratingQRCodes");
      sonnerToast.error(errorMsg);
      if (onError) onError(errorMsg);
      setIsPrinting(false);
    }
  };

  const createFrameLabelContent = (frame: FrameItem, qrCodeDataURL: string) => {
    const formattedPrice = Number.isInteger(frame.price)
      ? Math.floor(frame.price)
      : frame.price.toFixed(3);

    return `
      <div class="label-container">
        <div class="left-section">
          <div class="store-logo">
            <img src="/lovable-uploads/826ece02-80b8-482d-a2be-8292f3460297.png" alt="Store Logo" />
          </div>
          <div class="qr-code">
            <img src="${qrCodeDataURL}" alt="QR Code" class="qr-image" />
          </div>
        </div>
        <div class="right-section">
          <div class="brand-name">${frame.brand} ${frame.model}</div>
          <div class="detail-info">Color: ${frame.color || "-"}</div>
          <div class="detail-info">Size: ${frame.size || "-"}</div>
          <div class="price">${formattedPrice} KWD</div>
        </div>
      </div>
    `;
  };

  return { printSingleLabel, printMultipleLabels, isPrinting };
};

/**
 * Frame Label Template Component
 */
export const FrameLabelTemplate: React.FC<FrameLabelTemplateProps> = ({
  onPrintError,
}) => {
  const { frames, fetchFrames, isLoadingFrames, searchFrames } = useInventoryStore();
  const { printMultipleLabels, isPrinting } = usePrintLabel(onPrintError);
  const { t, language } = useLanguageStore();
  const [selectedFrames, setSelectedFrames] = useState<string[]>([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [sortOrder, setSortOrder] = useState<
    "newest" | "oldest" | "priceHigh" | "priceLow"
  >("newest");
  const [filteredFrames, setFilteredFrames] = useState<FrameItem[]>([]);

  // Initialize with frames from the store
  useEffect(() => {
    const initFrames = async () => {
      if (frames.length === 0) {
        await fetchFrames();
      }
      setFilteredFrames(frames);
    };
    
    initFrames();
  }, [fetchFrames, frames]);
  
  // Handle search with debounce
  useEffect(() => {
    const performSearch = async () => {
      setIsSearching(true);
      try {
        // Use the same search function as FrameInventory
        const results = await searchFrames(searchTerm);
        
        // Apply sorting to the search results
        let sortedResults = [...results];
        switch (sortOrder) {
          case 'newest':
            sortedResults.sort((a, b) => b.frameId.localeCompare(a.frameId));
            break;
          case 'oldest':
            sortedResults.sort((a, b) => a.frameId.localeCompare(b.frameId));
            break;
          case 'priceHigh':
            sortedResults.sort((a, b) => b.price - a.price);
            break;
          case 'priceLow':
            sortedResults.sort((a, b) => a.price - b.price);
            break;
        }
        
        setFilteredFrames(sortedResults);
      } catch (error) {
        console.error('Error searching frames:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(() => {
      if (searchTerm.trim() !== '') {
        performSearch();
      } else {
        // If search term is empty, just apply sorting to all frames
        let sortedResults = [...frames];
        switch (sortOrder) {
          case 'newest':
            sortedResults.sort((a, b) => b.frameId.localeCompare(a.frameId));
            break;
          case 'oldest':
            sortedResults.sort((a, b) => a.frameId.localeCompare(b.frameId));
            break;
          case 'priceHigh':
            sortedResults.sort((a, b) => b.price - a.price);
            break;
          case 'priceLow':
            sortedResults.sort((a, b) => a.price - b.price);
            break;
        }
        setFilteredFrames(sortedResults);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchTerm, sortOrder, frames, searchFrames]);

  // Add the missing toggleFrameSelection function
  const toggleFrameSelection = (frameId: string) => {
    if (selectedFrames.includes(frameId)) {
      setSelectedFrames((prev) => prev.filter((id) => id !== frameId));
    } else {
      setSelectedFrames((prev) => [...prev, frameId]);
    }
  };

  const selectAllFrames = () => {
    setSelectedFrames(filteredFrames.map((f) => f.frameId));
  };

  const deselectAllFrames = () => {
    setSelectedFrames([]);
  };

  const handlePrintSelected = () => {
    console.log(
      `[FrameLabelTemplate] Attempting to print ${selectedFrames.length} selected frames`
    );
    printMultipleLabels(selectedFrames);
  };

  const previewStyles: Record<string, React.CSSProperties> = {
    container: {
      width: "200px",
      height: "32px",
      display: "flex",
      border: "1px solid #ddd",
      overflow: "hidden",
      background: "white",
    },
    leftSection: {
      width: "70px",
      height: "100%",
      padding: "2px",
      display: "flex",
      flexDirection: "column" as const,
      justifyContent: "space-between",
      alignItems: "center",
      borderRight: "1px solid #eee",
    },
    rightSection: {
      width: "130px",
      height: "100%",
      padding: "2px 4px",
      display: "flex",
      flexDirection: "column" as const,
      justifyContent: "space-between",
    },
    storeLogo: {
      width: "100%",
      display: "flex",
      justifyContent: "center",
      marginBottom: "1px",
    },
    storeLogoImg: {
      height: "10px",
      width: "auto",
    },
    qrCode: {
      display: "flex",
      justifyContent: "center",
    },
    brandName: {
      fontWeight: "bold",
      fontSize: "8px",
      lineHeight: "1",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxHeight: "16px",
      display: "-webkit-box" as any,
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical" as any,
    },
    detailInfo: {
      fontSize: "6px",
      lineHeight: "1",
      overflow: "hidden",
      whiteSpace: "nowrap" as const,
      textOverflow: "ellipsis",
    },
    price: {
      fontWeight: "bold",
      fontSize: "10px",
      marginTop: "1px",
    },
  };

  const PreviewLabel = ({ frame }: { frame: FrameItem }) => {
    const formattedPrice = Number.isInteger(frame.price)
      ? Math.floor(frame.price)
      : frame.price.toFixed(3);

    return (
      <div style={previewStyles.container}>
        <div style={previewStyles.leftSection}>
          <div style={previewStyles.storeLogo}>
            <img
              src="/lovable-uploads/826ece02-80b8-482d-a2be-8292f3460297.png"
              alt="Store Logo"
              style={previewStyles.storeLogoImg}
            />
          </div>
          <div style={previewStyles.qrCode}>
            <QRCodeReact
              value={frame.frameId}
              size={36}
              level="H"
              includeMargin={false}
              renderAs="svg"
            />
          </div>
        </div>
        <div style={previewStyles.rightSection}>
          <div style={previewStyles.brandName}>
            {frame.brand} {frame.model}
          </div>
          <div style={previewStyles.detailInfo}>
            Color: {frame.color || "-"}
          </div>
          <div style={previewStyles.detailInfo}>Size: {frame.size || "-"}</div>
          <div style={previewStyles.price}>{formattedPrice} KWD</div>
        </div>
      </div>
    );
  };

  const isRtl = language === "ar";
  const dirClass = isRtl ? "rtl" : "ltr";

  return (
    <div className={`space-y-4 ${dirClass} max-h-[calc(100vh-150px)] flex flex-col`}>
      <div className="flex flex-col md:flex-row justify-between items-start gap-3">
        <div className="md:w-1/2 w-full">
          <h2 className="text-lg font-semibold mb-2">
            {isRtl ? "طباعة ملصقات الإطارات" : "Print Frame Labels"}
          </h2>
          <div className="relative w-full">
            <Search
              className={`absolute ${
                isRtl ? "right-3" : "left-3"
              } top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground`}
            />
            <Input
              placeholder={isRtl ? "بحث عن إطار..." : "Search frames..."}
              className={`${isRtl ? "pr-9" : "pl-9"} w-full`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full md:w-auto flex flex-wrap gap-2 items-center justify-end">
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none">
            {isRtl
              ? `الإطارات المحددة: ${selectedFrames.length}`
              : `Selected Frames: ${selectedFrames.length}`}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <ListFilter className="h-4 w-4" />
                {isRtl ? "ترتيب" : "Sort"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => setSortOrder("newest")}
                className="gap-2"
              >
                <SortDesc className="h-4 w-4" />
                {isRtl ? "الأحدث أولاً" : "Newest First"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortOrder("oldest")}
                className="gap-2"
              >
                <SortAsc className="h-4 w-4" />
                {isRtl ? "الأقدم أولاً" : "Oldest First"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortOrder("priceHigh")}
                className="gap-2"
              >
                <SortDesc className="h-4 w-4" />
                {isRtl ? "السعر: من الأعلى للأدنى" : "Price: High to Low"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortOrder("priceLow")}
                className="gap-2"
              >
                <SortAsc className="h-4 w-4" />
                {isRtl ? "السعر: من الأدنى للأعلى" : "Price: Low to High"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={selectAllFrames}
            disabled={isPrinting}
          >
            {isRtl ? "تحديد الكل" : "Select All"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={deselectAllFrames}
            disabled={isPrinting}
          >
            {isRtl ? "إلغاء التحديد" : "Deselect All"}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handlePrintSelected}
            disabled={selectedFrames.length === 0 || isPrinting}
            className="relative"
          >
            {isPrinting
              ? isRtl
                ? "جاري الطباعة..."
                : "Printing..."
              : isRtl
              ? "طباعة المحدد"
              : "Print Selected"}
            {isPrinting && (
              <span className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </span>
            )}
          </Button>
        </div>
      </div>

      {selectedFrames.length === 0 && filteredFrames.length > 0 && (
        <div className="p-3 bg-amber-50 text-amber-800 rounded border border-amber-200 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>
            {isRtl
              ? "يرجى تحديد الإطارات المراد طباعة ملصقات لها"
              : "Please select frames to print labels"}
          </span>
        </div>
      )}

      {selectedFrames.length > 0 && filteredFrames.length > 0 && (
        <div className="mb-4 p-3 border rounded-md">
          <h3 className="text-sm font-medium mb-2">
            {isRtl ? "معاينة الملصق" : "Label Preview"}
          </h3>
          <div className="flex items-center">
            <PreviewLabel
              frame={
                filteredFrames.find((f) => f.frameId === selectedFrames[0]) ||
                filteredFrames[0]
              }
            />
            {selectedFrames.length > 1 && (
              <div className="ml-3 text-sm text-gray-500">
                {isRtl
                  ? `+ ${selectedFrames.length - 1} ملصق إضافي سيتم طباعته`
                  : `+ ${
                      selectedFrames.length - 1
                    } more label(s) will be printed`}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 overflow-y-auto flex-1 p-1">
        {filteredFrames.map((frame) => (
          <div
            key={frame.frameId}
            className={`border rounded p-2 cursor-pointer hover:bg-gray-50 transition-colors ${
              selectedFrames.includes(frame.frameId)
                ? "bg-blue-50 border-blue-200"
                : ""
            }`}
            onClick={() => toggleFrameSelection(frame.frameId)}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-sm">
                  {frame.brand} {frame.model}
                </div>
                <div className="text-xs text-gray-500">
                  {isRtl
                    ? `اللون: ${frame.color || "-"}، المقاس: ${
                        frame.size || "-"
                      }`
                    : `${frame.color || "-"}, ${frame.size || "-"}`}
                </div>
                <div className="text-xs font-medium">
                  {frame.price.toFixed(3)} KWD
                </div>
              </div>
              {selectedFrames.includes(frame.frameId) && (
                <Check className="h-4 w-4 text-blue-500" />
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredFrames.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          {searchTerm
            ? isRtl
              ? "لم يتم العثور على إطارات تطابق معايير البحث"
              : "No frames found matching search criteria"
            : isRtl
            ? "لا توجد إطارات متاحة"
            : "No frames available"}
        </div>
      )}
    </div>
  );
};
