import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { VisitedTabsFooter } from './VisitedTabsFooter';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="md:ml-64">
        <Header title={title} subtitle={subtitle} />
        <main className="p-3 md:p-6 pb-16 md:pb-12">{children}</main>
      </div>
      <VisitedTabsFooter />
    </div>
  );
}
