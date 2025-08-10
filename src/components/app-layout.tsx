
'use client';

import * as React from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar';
import {Button} from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {ThemeToggle} from '@/components/theme-toggle';
import {
  BotMessageSquare,
  Cog,
  LayoutDashboard,
  LineChart,
  Wifi,
  WifiOff,
  ClipboardList,
  ListPlus,
  LogOut,
  Flame,
} from 'lucide-react';
import {useOnlineStatus} from '@/hooks/use-online-status';
import {useAuth} from './auth-provider';
import { RalsonTyreIcon } from './icons/ralson-tyre-icon';

export interface AppLayoutProps {
  children?: React.ReactNode;
  setPageActions?: (actions: React.ReactNode | null) => void;
}

const navItems = [
  {href: '/', label: 'GT Prod Entry', icon: LayoutDashboard},
  {href: '/curing', label: 'Curing', icon: Flame},
  {href: '/tread-extrusion', label: 'Tread Extrusion', icon: ClipboardList},
  {href: '/daily-tread-production', label: 'Daily Production', icon: ListPlus},
  {href: '/optimize', label: 'AI Optimizer', icon: BotMessageSquare},
  {href: '/reports', label: 'Reports', icon: LineChart},
  {href: '/admin', label: 'Admin', icon: Cog},
];

function OnlineStatusIndicator() {
  const isOnline = useOnlineStatus();

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <span>Online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-destructive" />
          <span>Offline</span>
        </>
      )}
    </div>
  );
}

export function AppLayout({children}: {children: React.ReactNode}) {
  const {isAuthenticated} = useAuth();
  const pathname = usePathname();
  const [pageActions, setPageActions] = React.useState<React.ReactNode | null>(null);

  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      if (pathname === '/' || pathname === '/curing') {
        return React.cloneElement(child as React.ReactElement<any>, { setPageActions });
      }
    }
    return child;
  });

  if (!isAuthenticated || pathname === '/login' || pathname === '/signup') {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <RalsonTyreIcon className="w-20 h-auto" />
            <span className="text-xl font-semibold hidden sm:inline-block">TyreTrack Pro</span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <OnlineStatusIndicator />
          <ThemeToggle />
          <UserMenu pageActions={pageActions} />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">{childrenWithProps}</main>
    </div>
  );
}

function UserMenu({ pageActions }: { pageActions: React.ReactNode | null }) {
  const {logout} = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full">
          <Avatar>
            <AvatarImage
              src="https://placehold.co/40x40"
              alt="User"
              data-ai-hint="user avatar"
            />
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          <span className="sr-only">Toggle user menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Admin</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {navItems.map(item => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href} className="flex items-center gap-2">
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        {(pathname === '/' || pathname === '/curing') && pageActions}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
