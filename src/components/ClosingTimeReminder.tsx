import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguageStore } from "@/store/languageStore";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Bell, Clock, CheckCircle2 } from "lucide-react";

// Store closes at 10 PM Kuwait time. Two popups fire:
//   21:00–21:29 → friendly "have you entered all today's invoices?"
//   21:30–21:59 → stronger "you logged 0 today — why?" (if total is 0)
//                 or     "last call to log any pending invoices"
// Each reminder is acknowledged per-Kuwait-day via localStorage so it
// doesn't spam.

const KUWAIT_TZ = "Asia/Kuwait";

const getKuwaitHourMinute = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KUWAIT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
};

// YYYY-MM-DD in Kuwait timezone (stable key across UTC midnight rollovers)
const getKuwaitDateKey = () => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KUWAIT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

// Range for "today" in the customer's (Kuwait) timezone — start/end of
// the current Kuwait day, expressed as ISO timestamps.
const getKuwaitDayRangeISO = () => {
  const dateKey = getKuwaitDateKey(); // e.g. "2026-04-20"
  // Kuwait is UTC+3 (no DST). So 00:00 Kuwait = 21:00 UTC the day before.
  // To make this robust, treat the range as YYYY-MM-DDT00:00+03:00 .. +24h.
  const start = new Date(`${dateKey}T00:00:00+03:00`).toISOString();
  const end = new Date(
    new Date(`${dateKey}T00:00:00+03:00`).getTime() + 24 * 60 * 60 * 1000
  ).toISOString();
  return { start, end, dateKey };
};

type ReminderStage = "first" | "second";

export const ClosingTimeReminder: React.FC = () => {
  const { language } = useLanguageStore();
  const isRtl = language === "ar";

  const [activeStage, setActiveStage] = useState<ReminderStage | null>(null);
  const [todayTotal, setTodayTotal] = useState<number | null>(null);
  const [dismissLoading, setDismissLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchTodayTotal = async () => {
      try {
        const { start, end } = getKuwaitDayRangeISO();
        // @ts-ignore — invoices table not in generated types
        const { data, error } = await supabase
          .from("invoices")
          .select("deposit, total, created_at, payments, is_refunded")
          .gte("created_at", start)
          .lt("created_at", end);
        if (error) throw error;
        // Sum the deposits from non-refunded invoices created today. This is
        // a lightweight stand-in for the proper cash-basis aggregation — good
        // enough for "did you log anything today?" gut-check.
        const total = ((data as any[]) || [])
          .filter((r) => !r.is_refunded)
          .reduce((s, r) => s + (Number(r.deposit) || 0), 0);
        if (!cancelled) setTodayTotal(total);
      } catch (e) {
        console.error("Reminder: today total lookup failed:", e);
        if (!cancelled) setTodayTotal(null);
      }
    };

    const check = async () => {
      const { hour, minute } = getKuwaitHourMinute();
      const dateKey = getKuwaitDateKey();

      const firstAckKey = `closing_reminder_first_${dateKey}`;
      const secondAckKey = `closing_reminder_second_${dateKey}`;

      // Second-reminder window: 21:30 – 21:59 (30 min before 10 PM close).
      if (hour === 21 && minute >= 30) {
        if (localStorage.getItem(secondAckKey) === "1") return;
        await fetchTodayTotal();
        if (!cancelled) setActiveStage("second");
        return;
      }

      // First-reminder window: 21:00 – 21:29 (one hour before close).
      if (hour === 21 && minute < 30) {
        if (localStorage.getItem(firstAckKey) === "1") return;
        if (!cancelled) setActiveStage("first");
        return;
      }

      // Outside the reminder windows — clear any open popup.
      if (!cancelled) setActiveStage(null);
    };

    // Run once immediately, then every minute.
    check();
    const id = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!activeStage) return null;

  const dateKey = getKuwaitDateKey();
  const firstAckKey = `closing_reminder_first_${dateKey}`;
  const secondAckKey = `closing_reminder_second_${dateKey}`;

  const acknowledge = () => {
    setDismissLoading(true);
    try {
      if (activeStage === "first") localStorage.setItem(firstAckKey, "1");
      if (activeStage === "second") localStorage.setItem(secondAckKey, "1");
    } catch {
      /* ignore */
    }
    setActiveStage(null);
    setDismissLoading(false);
  };

  // --- Copy ---------------------------------------------------------------
  const firstTitleAR = "تذكير: هل سجّلت كل فواتير اليوم؟";
  const firstTitleEN = "Reminder: Have you logged today's invoices?";
  const firstBodyAR =
    "سيُغلق المحل الساعة ١٠ مساءً. تبقّت ساعة واحدة. يرجى التأكد من إدخال جميع المبيعات والدفعات لليوم قبل الإغلاق. إذا أُدخلت جميع الفواتير، يمكنك تجاهل هذا التذكير.";
  const firstBodyEN =
    "The store closes at 10 PM. One hour left. Please make sure every sale and payment for today is entered in the system before closing. If you've already logged everything, you can dismiss this reminder.";

  const secondTitleAR =
    todayTotal === 0
      ? "تنبيه: إجمالي مبيعات اليوم = ٠٫٠٠ د.ك — هل هذا صحيح؟"
      : "تذكير أخير قبل الإغلاق";
  const secondTitleEN =
    todayTotal === 0
      ? "Heads up: Today's total is 0.00 KWD — is that right?"
      : "Last reminder before closing";
  const secondBodyAR =
    todayTotal === 0
      ? "هذا هو التذكير الثاني. النظام لا يعرض أي مبيعات اليوم. إذا كنتم فعلاً لم تبيعوا شيئاً، اضغطوا (نعم، لم يكن هناك مبيعات). وإذا كانت هناك فواتير لم تُدخَل بعد، يُرجى إدخالها الآن قبل إغلاق المحل."
      : "نصف ساعة فقط قبل الإغلاق. يُرجى التأكد من إدخال آخر فواتير اليوم — أي شيء لم يُدخَل الآن لن يُحتسَب في تقرير اليوم.";
  const secondBodyEN =
    todayTotal === 0
      ? "This is your second reminder. The system shows no sales today. If you genuinely made no sales, click (Yes, no sales today). Otherwise please log the missing invoices now, before the store closes."
      : "Only 30 minutes before closing. Please make sure the last of today's invoices are entered — anything not logged now won't appear in today's report.";

  const title = activeStage === "first" ? firstTitleAR : secondTitleAR;
  const titleEn = activeStage === "first" ? firstTitleEN : secondTitleEN;
  const body = activeStage === "first" ? firstBodyAR : secondBodyAR;
  const bodyEn = activeStage === "first" ? firstBodyEN : secondBodyEN;

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) acknowledge();
      }}
    >
      <DialogContent
        className="max-w-lg"
        dir={isRtl ? "rtl" : "ltr"}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                activeStage === "second" && todayTotal === 0
                  ? "bg-rose-100 text-rose-700"
                  : activeStage === "second"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-sky-100 text-sky-700"
              }`}
            >
              {activeStage === "second" && todayTotal === 0 ? (
                <AlertTriangle className="h-6 w-6" />
              ) : activeStage === "second" ? (
                <Clock className="h-6 w-6" />
              ) : (
                <Bell className="h-6 w-6" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-bold text-slate-900 leading-tight">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-0.5">
                {titleEn}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <p className="text-base text-slate-800 leading-relaxed">{body}</p>
            <p className="text-sm text-slate-500 leading-relaxed">{bodyEn}</p>
          </div>

          {activeStage === "second" && (
            <div
              className={`rounded-xl p-4 border tabular-nums ${
                todayTotal === 0
                  ? "bg-rose-50 border-rose-200"
                  : "bg-emerald-50 border-emerald-200"
              }`}
              dir="ltr"
            >
              <div className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-1 text-start">
                {isRtl ? "إجمالي اليوم حتى الآن" : "Today's total so far"}
              </div>
              <div
                className={`text-3xl font-bold text-start ${
                  todayTotal === 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                {(todayTotal ?? 0).toFixed(2)}{" "}
                <span className="text-base font-semibold">KWD</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {activeStage === "second" && todayTotal === 0 ? (
            <>
              <Button
                variant="outline"
                onClick={acknowledge}
                disabled={dismissLoading}
                className="h-11 text-base"
              >
                {isRtl
                  ? "نعم، لم يكن هناك مبيعات اليوم"
                  : "Yes, no sales today"}
              </Button>
              <Button
                onClick={acknowledge}
                disabled={dismissLoading}
                className="h-11 text-base bg-rose-600 hover:bg-rose-700 text-white"
              >
                <AlertTriangle className="h-5 w-5 me-2" />
                {isRtl
                  ? "سأدخل الفواتير الآن"
                  : "I'll log them now"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={acknowledge}
                disabled={dismissLoading}
                className="h-11 text-base"
              >
                {isRtl
                  ? "سأدخل الفواتير الآن"
                  : "I'll log them now"}
              </Button>
              <Button
                onClick={acknowledge}
                disabled={dismissLoading}
                className="h-11 text-base bg-slate-900 hover:bg-slate-800 text-white"
              >
                <CheckCircle2 className="h-5 w-5 me-2" />
                {isRtl
                  ? "تم إدخال كل الفواتير"
                  : "All invoices entered"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClosingTimeReminder;
