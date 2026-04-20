import React from "react";
import { format, parseISO, differenceInYears, formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useLanguageStore } from "@/store/languageStore";
import { Patient } from "@/store/patientStore";
import { Invoice } from "@/store/invoiceStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  Calendar,
  Clock,
  FileBarChart,
  Receipt,
  Sparkles,
  Award,
  User,
  Copy,
  Check,
} from "lucide-react";

interface PatientProfileInfoProps {
  patient: Patient;
  invoices: Invoice[];
  onPrintPrescription: () => void;
}

const formatPhone = (raw?: string) => {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length === 8) return `${d.slice(0, 4)} ${d.slice(4)}`;
  return raw;
};

const initials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const avatarColor = (seed: string) => {
  const palette = [
    "from-blue-400 to-blue-600",
    "from-emerald-400 to-emerald-600",
    "from-amber-400 to-amber-600",
    "from-purple-400 to-purple-600",
    "from-pink-400 to-pink-600",
    "from-teal-400 to-teal-600",
    "from-indigo-400 to-indigo-600",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
};

export const PatientProfileInfo: React.FC<PatientProfileInfoProps> = ({
  patient,
  invoices,
  onPrintPrescription,
}) => {
  const { language, t } = useLanguageStore();
  const isRtl = language === "ar";
  const locale = isRtl ? ar : enUS;
  const [copied, setCopied] = React.useState(false);

  const fmt = (iso?: string) => {
    if (!iso) return "";
    try {
      return format(parseISO(iso), "PP", { locale });
    } catch {
      return "";
    }
  };

  const age = (dob?: string) => {
    if (!dob) return null;
    try {
      return differenceInYears(new Date(), new Date(dob));
    } catch {
      return null;
    }
  };

  const lastVisit = invoices.length > 0
    ? [...invoices].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0].createdAt
    : undefined;

  const totalSpent = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const purchaseCount = invoices.length;
  const hasDob = !!patient.dob;
  const patientAge = hasDob ? age(patient.dob) : null;
  const color = avatarColor(patient.patientId || patient.name);
  const isNew = purchaseCount === 0;
  const isLoyal = purchaseCount >= 5;

  const copyPhone = async () => {
    if (!patient.phone) return;
    try {
      await navigator.clipboard.writeText(patient.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 h-24" />
        <div className="px-6 pb-6 -mt-14">
          <div className="flex flex-col items-center">
            <div
              className={`w-28 h-28 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-4xl shadow-lg ring-4 ring-white`}
            >
              {initials(patient.name) || <User className="w-10 h-10" />}
            </div>
            <h3 className="text-2xl font-bold mt-4 text-center text-slate-900 tracking-tight">
              {patient.name}
            </h3>
            <div className="flex gap-2 mt-3 flex-wrap justify-center">
              {isNew && (
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0 gap-1.5 text-sm px-3 py-1 font-semibold">
                  <Sparkles className="w-4 h-4" />
                  {isRtl ? "عميل جديد" : "New customer"}
                </Badge>
              )}
              {isLoyal && (
                <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-0 gap-1.5 text-sm px-3 py-1 font-semibold">
                  <Award className="w-4 h-4" />
                  {isRtl ? "عميل مميز" : "Loyal customer"}
                </Badge>
              )}
              {!isNew && !isLoyal && (
                <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 border-0 text-sm px-3 py-1 font-semibold">
                  {isRtl
                    ? `${purchaseCount} عملية شراء`
                    : `${purchaseCount} purchase${
                        purchaseCount === 1 ? "" : "s"
                      }`}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Big phone action */}
      {patient.phone && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-sky-100 flex items-center justify-center flex-shrink-0">
              <Phone className="w-7 h-7 text-sky-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                {isRtl ? "رقم الهاتف" : "Phone"}
              </div>
              <a
                href={`tel:${patient.phone}`}
                dir="ltr"
                className="text-xl font-bold text-slate-900 hover:text-sky-700 hover:underline block tabular-nums"
              >
                {formatPhone(patient.phone)}
              </a>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyPhone}
              className="flex-shrink-0 h-10 w-10"
              aria-label={isRtl ? "نسخ الرقم" : "Copy phone"}
            >
              {copied ? (
                <Check className="w-5 h-5 text-emerald-600" />
              ) : (
                <Copy className="w-5 h-5 text-slate-500" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Quick stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2 font-semibold">
            {isRtl ? "إجمالي الإنفاق" : "Total spent"}
          </div>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">
            {totalSpent.toFixed(3)}
          </div>
          <div className="text-sm text-slate-500 font-medium">{t("kwd")}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2 font-semibold">
            {isRtl ? "عدد المشتريات" : "Purchases"}
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {purchaseCount}
          </div>
          <div className="text-sm text-slate-500 font-medium">
            {isRtl ? "طلب" : purchaseCount === 1 ? "order" : "orders"}
          </div>
        </div>
      </div>

      {/* Secondary details */}
      <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
        {hasDob && patientAge !== null && (
          <div className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
                {isRtl ? "العمر" : "Age"}
              </div>
              <div className="text-base font-semibold text-slate-900">
                {patientAge}{" "}
                {isRtl ? "سنة" : patientAge === 1 ? "year" : "years"}
                <span className="text-slate-500 text-sm ms-2 font-normal">
                  ({fmt(patient.dob)})
                </span>
              </div>
            </div>
          </div>
        )}
        {lastVisit && (
          <div className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
                {isRtl ? "آخر زيارة" : "Last visit"}
              </div>
              <div className="text-base font-semibold text-slate-900">
                {fmt(lastVisit)}{" "}
                <span className="text-slate-500 text-sm font-normal">
                  ·{" "}
                  {formatDistanceToNow(parseISO(lastVisit), {
                    addSuffix: true,
                    locale,
                  })}
                </span>
              </div>
            </div>
          </div>
        )}
        {patient.createdAt && (
          <div className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
                {isRtl ? "عميل منذ" : "Customer since"}
              </div>
              <div className="text-base font-semibold text-slate-900">
                {fmt(patient.createdAt)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="space-y-2 pt-1">
        <Button
          variant="outline"
          className="w-full h-12 justify-center gap-2 text-base font-semibold border-slate-300 bg-white hover:bg-slate-50 text-slate-900"
          onClick={onPrintPrescription}
        >
          <Receipt className="w-5 h-5 text-sky-700" />
          {isRtl ? "طباعة الوصفة الطبية" : "Print prescription"}
        </Button>
        <Button
          variant="outline"
          className="w-full h-12 justify-center gap-2 text-base font-semibold border-slate-300 bg-white hover:bg-slate-50 text-slate-900"
        >
          <FileBarChart className="w-5 h-5 text-amber-700" />
          {isRtl ? "تقرير العميل" : "Customer report"}
        </Button>
      </div>
    </div>
  );
};
