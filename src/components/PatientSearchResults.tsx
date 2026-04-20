import React from "react";
import { format, parseISO, differenceInYears, formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useLanguageStore } from "@/store/languageStore";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, UserSearch, Phone, Clock, Sparkles, User } from "lucide-react";
import { Patient } from "@/integrations/supabase/schema";

interface PatientWithMeta extends Patient {
  lastVisit?: string;
  avatar?: string;
}

interface PatientSearchResultsProps {
  searchResults: PatientWithMeta[];
  onSelectPatient: (patient: PatientWithMeta) => void;
}

const formatPhone = (raw?: string) => {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  // Kuwait 8-digit style: XXXX XXXX
  if (digits.length === 8) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return raw;
};

const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const avatarColor = (seed: string) => {
  const palette = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-purple-100 text-purple-700",
    "bg-pink-100 text-pink-700",
    "bg-teal-100 text-teal-700",
    "bg-indigo-100 text-indigo-700",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
};

export const PatientSearchResults: React.FC<PatientSearchResultsProps> = ({
  searchResults,
  onSelectPatient,
}) => {
  const { language } = useLanguageStore();
  const isRtl = language === "ar";
  const dirClass = isRtl ? "rtl" : "ltr";
  const locale = isRtl ? ar : enUS;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    try {
      return format(parseISO(dateString), "PP", { locale });
    } catch {
      return "";
    }
  };

  const lastVisitLabel = (dateString?: string) => {
    if (!dateString) return isRtl ? "عميل جديد" : "New customer";
    try {
      const d = parseISO(dateString);
      const rel = formatDistanceToNow(d, { addSuffix: true, locale });
      return `${formatDate(dateString)} · ${rel}`;
    } catch {
      return formatDate(dateString);
    }
  };

  const getAge = (dob?: string) => {
    if (!dob) return null;
    try {
      return differenceInYears(new Date(), new Date(dob));
    } catch {
      return null;
    }
  };

  // Dynamic column visibility — only show DOB/Age columns if at least one result has DOB
  const anyHasDob = searchResults.some((p) => !!p.date_of_birth);

  return (
    <Card className={`mb-6 shadow-sm ${dirClass}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {isRtl ? "نتائج البحث" : "Search results"}
        </CardTitle>
        <CardDescription>
          {isRtl
            ? `تم العثور على ${searchResults.length} عميل`
            : `Found ${searchResults.length} customer${
                searchResults.length !== 1 ? "s" : ""
              }`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {searchResults.length === 0 ? (
          <div className="text-center py-10">
            <UserSearch className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium mb-1">
              {isRtl ? "لا توجد نتائج" : "No results"}
            </h3>
            <p className="text-muted-foreground">
              {isRtl
                ? "جرّب البحث باسم مختلف أو رقم الهاتف."
                : "Try a different name or phone number."}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[40%]">
                    {isRtl ? "العميل" : "Customer"}
                  </TableHead>
                  <TableHead>
                    {isRtl ? "رقم الهاتف" : "Phone"}
                  </TableHead>
                  {anyHasDob && (
                    <TableHead>{isRtl ? "العمر" : "Age"}</TableHead>
                  )}
                  <TableHead>
                    {isRtl ? "آخر زيارة" : "Last visit"}
                  </TableHead>
                  <TableHead className="text-right w-[140px]">
                    {isRtl ? "الإجراء" : "Action"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.map((patient) => {
                  const initials = getInitials(patient.full_name || "");
                  const color = avatarColor(patient.id || patient.full_name || "");
                  const age = getAge(patient.date_of_birth);
                  const isNew = !patient.lastVisit;
                  return (
                    <TableRow
                      key={patient.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => onSelectPatient(patient)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${color}`}
                          >
                            {initials || <User className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {patient.full_name}
                            </div>
                            {isNew && (
                              <Badge
                                variant="secondary"
                                className="mt-0.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[10px] font-medium gap-1"
                              >
                                <Sparkles className="w-3 h-3" />
                                {isRtl ? "عميل جديد" : "New"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {patient.phone_number ? (
                          <a
                            href={`tel:${patient.phone_number}`}
                            dir="ltr"
                            className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {formatPhone(patient.phone_number)}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      {anyHasDob && (
                        <TableCell>
                          {age !== null ? (
                            <span className="text-sm">
                              {age} {isRtl ? "سنة" : age === 1 ? "year" : "years"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          {!isNew && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                          <span className={isNew ? "text-emerald-700 font-medium" : ""}>
                            {lastVisitLabel(patient.lastVisit)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPatient(patient);
                          }}
                        >
                          <Eye className={`h-4 w-4 ${isRtl ? "ml-1.5" : "mr-1.5"}`} />
                          {isRtl ? "عرض الملف" : "View profile"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
