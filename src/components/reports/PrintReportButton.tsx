
import React from 'react';
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useLanguageStore } from "@/store/languageStore";

interface PrintReportButtonProps {
  onPrint: () => void;
  className?: string;
  label?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  icon?: React.ReactNode;
  disabled?: boolean;
  description?: string;
}

export const PrintReportButton: React.FC<PrintReportButtonProps> = ({
  onPrint,
  className = "",
  label,
  variant = "default",
  icon,
  disabled = false,
}) => {
  const { language } = useLanguageStore();

  const defaultLabel = language === 'ar' ? 'طباعة التقرير' : 'Print Report';
  const buttonLabel = label || defaultLabel;

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTimeout(() => {
      onPrint();
    }, 100);
  };

  const isPrimary = variant === "default";

  return (
    <Button
      onClick={handlePrint}
      variant={variant}
      disabled={disabled}
      className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold transition-colors ${
        isPrimary
          ? "bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
          : ""
      } ${className}`}
    >
      {icon || <Printer className="w-4 h-4" />}
      <span>{buttonLabel}</span>
    </Button>
  );
};
