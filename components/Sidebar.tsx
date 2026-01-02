'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardIcon, ChatIcon, CalendarIcon, AlarmEventsIcon, WorkflowIcon, ShopfloorsIcon, SignOutIcon } from './Icons';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('user');
      router.push('/login');
    }
  };

  const navItems = [
    {
      name: 'Dashboard',
      href: '/',
      icon: <DashboardIcon className="w-6 h-6" />,
    },
    {
      name: 'Chat Assistant',
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
      name: 'Events',
      href: '/alarm-events',
      icon: <AlarmEventsIcon className="w-6 h-6" />,
    },
    {
      name: 'Workflows',
      href: '/workflows',
      icon: <WorkflowIcon className="w-6 h-6" />,
    },
  ];

  return (
    <div className="w-20 bg-dark-panel border-r border-dark-border h-full flex flex-col">
      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center justify-center px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-midnight-500 text-white'
                      : 'text-gray-400 hover:bg-dark-border hover:text-white'
                  }`}
                  title={item.name}
                >
                  {typeof item.icon === 'string' ? (
                    <span className="text-2xl">{item.icon}</span>
                  ) : (
                    item.icon
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* Sign Out Button - Bottom Corner */}
      <div className="p-4 border-t border-dark-border">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center px-4 py-3 rounded-lg transition-colors text-gray-400 hover:bg-dark-border hover:text-white"
          title="Sign Out"
        >
          <SignOutIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

