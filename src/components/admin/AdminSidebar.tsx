'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAdminAuth } from './AdminAuthProvider';
import {
  BarChart3,
  Users,
  MessageSquare,
  Settings,
  LogOut,
  Mail,
  UserCheck,
  Clock,
  Home,
  Headphones,
  BookOpen,
  Video,
  Bell,
  DollarSign,
  Ticket,
  Link2,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  {
    title: 'Dashboard',
    href: '/mission-control',
    icon: Home,
  },
  {
    title: 'Partners',
    href: '/mission-control/partners',
    icon: UserCheck,
  },
  {
    title: 'Customers',
    href: '/mission-control/customers',
    icon: Users,
  },
  {
    title: 'Customer Relations',
    href: '/mission-control/customer-relations',
    icon: Link2,
  },
  {
    title: 'Waitlist',
    href: '/mission-control/waitlist',
    icon: Clock,
  },
  {
    title: 'Analytics',
    href: '/mission-control/analytics',
    icon: BarChart3,
  },
  {
    title: 'Credits',
    href: '/mission-control/credits',
    icon: DollarSign,
  },
  {
    title: 'Email Campaigns',
    href: '/mission-control/email',
    icon: Mail,
  },
  {
    title: 'Coupons',
    href: '/mission-control/coupons',
    icon: Ticket,
  },
  {
    title: 'Notifications',
    href: '/mission-control/notifications',
    icon: Bell,
  },
  {
    title: 'AI Agents',
    href: '/mission-control/agents',
    icon: Headphones,
  },
  {
    title: 'N8N Workflows',
    href: '/mission-control/n8n-workflows',
    icon: Workflow,
  },
  {
    title: 'Tutorials',
    href: '/mission-control/tutorials',
    icon: BookOpen,
  },
  {
    title: 'Settings',
    href: '/mission-control/settings',
    icon: Settings,
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { signOut, user } = useAdminAuth();

  return (
    <div className="flex h-screen flex-col border-r bg-white w-64">
      <div className="p-4">
        <h2 className="text-xl font-bold text-gray-800">Mission Control</h2>
        <p className="text-sm text-gray-500 mt-1">Admin Panel</p>
      </div>

      <div className="flex-1 overflow-auto py-2">
        <nav className="grid gap-1 px-2">
          {navItems.map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={index}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900",
                  isActive ? "bg-gray-100 text-gray-900 font-medium" : ""
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-4 border-t">
        {user && (
          <div className="mb-4">
            <p className="text-sm font-medium">{user.email}</p>
            <p className="text-xs text-gray-500">Administrator</p>
          </div>
        )}
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
