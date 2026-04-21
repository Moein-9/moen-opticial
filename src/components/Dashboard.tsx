
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Clock, 
  RefreshCcw, 
  ArrowRight, 
  Users, 
  FileText, 
  Package, 
  CreditCard, 
  Search, 
  Calendar,
  Store,
  ScrollText,
  Eye
} from "lucide-react";
import { usePatientStore } from "@/store/patientStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MoenLogoGreen } from "@/assets/logo";
import { useLanguageStore } from "@/store/languageStore";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export const Dashboard: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { patients } = usePatientStore();
  const { frames } = useInventoryStore();
  const { t, language } = useLanguageStore();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const navigateToSection = (section: string) => {
    // Find the closest parent component with id "root" and dispatch a custom event
    const rootElement = document.getElementById('root');
    if (rootElement) {
      const event = new CustomEvent('navigate', { detail: { section } });
      rootElement.dispatchEvent(event);
    }
  };

  const navigateToEyeExam = () => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      // Create an event to navigate to createInvoice
      const navigateEvent = new CustomEvent('navigate', { 
        detail: { section: 'createInvoice' } 
      });
      rootElement.dispatchEvent(navigateEvent);
      
      // Wait a bit for the navigation to complete, then set the invoice type to exam
      setTimeout(() => {
        // Find the "exam" radio button and click it
        const examRadioButton = document.querySelector('input[value="exam"]');
        if (examRadioButton instanceof HTMLElement) {
          examRadioButton.click();
        }
      }, 100);
    }
  };

  const quickActions = [
    {
      title: language === 'ar' ? 'إنشاء عميل جديد' : 'New Patient',
      description: language === 'ar' ? 'إضافة عميل جديد إلى النظام' : 'Add a new patient to the system',
      icon: Users,
      color: 'bg-teal-500',
      onClick: () => navigateToSection('createClient')
    },
    {
      title: language === 'ar' ? 'إنشاء فاتورة' : 'New Invoice',
      description: language === 'ar' ? 'إنشاء فاتورة جديدة' : 'Create a new invoice',
      icon: FileText,
      color: 'bg-teal-500',
      onClick: () => navigateToSection('createInvoice')
    },
    {
      title: language === 'ar' ? 'فحص العين' : 'Eye Exam',
      description: language === 'ar' ? 'إنشاء فاتورة فحص عين' : 'Create an eye exam invoice',
      icon: Eye,
      color: 'bg-teal-500',
      onClick: navigateToEyeExam
    },
    {
      title: language === 'ar' ? 'المدفوعات المتبقية' : 'Remaining Payments',
      description: language === 'ar' ? 'عرض المدفوعات المتبقية' : 'View remaining payments',
      icon: CreditCard,
      color: 'bg-teal-500',
      onClick: () => navigateToSection('remainingPayments')
    },
    {
      title: language === 'ar' ? 'الاسترداد والاستبدال' : 'Refunds & Exchanges',
      description: language === 'ar' ? 'معالجة استرداد الأموال واستبدال المنتجات' : 'Process refunds and exchanges',
      icon: RefreshCcw,
      color: 'bg-teal-500',
      onClick: () => navigateToSection('refundManager')
    },
  ];

  const rtlClass = language === 'ar' ? 'rtl' : 'ltr';
  const welcomeMessage = language === 'ar' ? 'مرحباً بكم في متجرنا' : 'Welcome to Our Store';
  const dateFormatted =
    language === 'ar'
      ? format(currentTime, 'EEEE، d MMMM yyyy', { locale: ar })
      : format(currentTime, 'EEEE, MMMM do, yyyy');
  const timeFormatted =
    language === 'ar'
      ? format(currentTime, 'h:mm:ss a', { locale: ar })
      : format(currentTime, 'h:mm:ss a');

  return (
    <div className={`py-4 space-y-6 ${rtlClass}`}>
      <Card className="mb-6 overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-teal-500 to-teal-700 p-6 text-white">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <MoenLogoGreen className="w-16 h-16 bg-white rounded-full p-2" />
                <div>
                  <h2 className="text-2xl font-bold">{welcomeMessage}</h2>
                  <p className="text-teal-100">
                    {language === 'ar' ? 'نظارات المعين - فرع العربيد' : 'Moen Optician - Al Arbid location'}
                  </p>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span className="text-xl font-mono force-ltr-numbers">{timeFormatted}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-5 w-5" />
                  <span className="text-sm">{dateFormatted}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <CollapsibleCard 
        title={language === 'ar' ? 'الإجراءات السريعة' : 'Quick Actions'} 
        defaultOpen={true}
        className="mb-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 p-4">
          {quickActions.map((action, index) => (
            <Card 
              key={index} 
              className="hover:shadow-md transition-shadow duration-300 cursor-pointer border-2 border-transparent hover:border-teal-100"
              onClick={action.onClick}
            >
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className={`${action.color} p-3 rounded-full mb-4 text-white`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-1">{action.title}</h3>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CollapsibleCard>
    </div>
  );
};
