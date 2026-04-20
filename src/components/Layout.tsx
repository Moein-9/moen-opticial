
import React from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { InventoryInitializer } from './InventoryInitializer';
import { ClosingTimeReminder } from './ClosingTimeReminder';

interface LayoutProps {
  children: React.ReactNode;
  activeSection?: string;
  onNavigate?: (section: string) => void;
}

export const Layout = ({ children, activeSection = "dashboard", onNavigate = () => {} }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <InventoryInitializer />
      <DashboardSidebar activeSection={activeSection} onNavigate={onNavigate}>
        {children}
      </DashboardSidebar>
      {/* End-of-day closing reminders — fire at 9:00 PM and 9:30 PM
          Kuwait time so staff don't forget to log invoices before the
          store closes at 10 PM. Lives in Layout so it's visible on
          every page (dashboard, reports, etc.) */}
      <ClosingTimeReminder />
    </div>
  );
};
