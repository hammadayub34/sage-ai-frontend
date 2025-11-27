'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Dashboard',
      href: '/',
      icon: '📊',
    },
    {
      name: 'Chat Assistant',
      href: '/chat',
      icon: '💬',
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
                  <span className="text-2xl">{item.icon}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

