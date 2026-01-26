'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { cloneElement } from 'react';
import { DashboardIcon, ChatIcon, CalendarIcon, NotificationIcon, WorkflowIcon, ShopfloorsIcon, SignOutIcon, SignalIcon, ChartIcon } from './Icons';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('user');
      router.push('/login');
    }
  };

  const navItems = [
    {
      name: 'Monitoring',
      href: '/',
      icon: <SignalIcon className="w-6 h-6" />,
    },
    {
      name: 'AI Insights',
      href: '/ai-insights',
      icon: <ChartIcon className="w-6 h-6" />,
    },
    {
      name: 'AI Library',
      href: '/chat',
      icon: <ChatIcon className="w-6 h-6" />,
    },
    {
      name: 'Work Orders',
      href: '/work-orders',
      icon: <CalendarIcon className="w-6 h-6" />,
    },
    {
      name: 'Equipments',
      href: '/shopfloors',
      icon: <ShopfloorsIcon className="w-6 h-6" />,
    },
    {
      name: 'Notifications',
      href: '/alarm-events',
      icon: <NotificationIcon className="w-6 h-6" />,
    },
    {
      name: 'Workflows',
      href: '/workflows',
      icon: <WorkflowIcon className="w-6 h-6" />,
    },
  ];

  return (
    <div className="w-20 bg-dark-panel border-r border-dark-border h-full flex flex-col relative">
      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href} className="relative">
                <Link
                  href={item.href}
                  className={`flex items-center justify-center px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-sage-500/20 text-sage-400'
                      : 'text-gray-400 hover:bg-dark-border hover:text-white'
                  }`}
                  onMouseEnter={() => setHoveredItem(item.href)}
                  onMouseLeave={() => setHoveredItem(null)}
                  title={item.name}
                >
                  {typeof item.icon === 'string' ? (
                    <span className="text-2xl">{item.icon}</span>
                  ) : (
                    cloneElement(item.icon as React.ReactElement, {
                      className: isActive 
                        ? `${(item.icon as React.ReactElement).props.className} text-sage-400`
                        : (item.icon as React.ReactElement).props.className
                    })
                  )}
                </Link>
                {/* Custom Tooltip */}
                {hoveredItem === item.href && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg shadow-lg z-50 whitespace-nowrap">
                    <span className="text-white text-sm">{item.name}</span>
                    {/* Arrow pointing to the icon */}
                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-dark-bg border-l border-b border-dark-border transform rotate-45"></div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* Sign Out Button - Bottom Corner */}
      <div className="p-4 border-t border-dark-border relative">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center px-4 py-3 rounded-lg transition-colors text-gray-400 hover:bg-dark-border hover:text-white"
          onMouseEnter={() => setHoveredItem('sign-out')}
          onMouseLeave={() => setHoveredItem(null)}
          title="Sign Out"
        >
          <SignOutIcon className="w-6 h-6" />
        </button>
        {/* Custom Tooltip for Sign Out */}
        {hoveredItem === 'sign-out' && (
          <div className="absolute left-full ml-2 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg shadow-lg z-50 whitespace-nowrap">
            <span className="text-white text-sm">Sign Out</span>
            {/* Arrow pointing to the icon */}
            <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-dark-bg border-l border-b border-dark-border transform rotate-45"></div>
          </div>
        )}
      </div>
    </div>
  );
}

