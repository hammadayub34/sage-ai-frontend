'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';

  // Check authentication for protected routes
  useEffect(() => {
    if (!isLoginPage && typeof window !== 'undefined') {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      const user = localStorage.getItem('user');
      
      if (!isLoggedIn || !user) {
        // User not logged in, redirect to login
        router.push('/login');
      }
    }
  }, [pathname, isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Slim top bar */}
      <div className="h-8 bg-dark-panel border-b border-dark-border flex items-center justify-center">
        <span className="heading-inter text-sm text-white">sage</span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

