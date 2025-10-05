'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ToyBrick,
  Spline,
  Circle,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const planningNavItems = [
  {
    href: '/planning/gt',
    label: 'Green Tyre Planning',
    icon: ToyBrick,
  },
  {
    href: '/planning/tread',
    label: 'Tread Planning',
    icon: Spline,
  },
  {
    href: '/planning/bead',
    label: 'Bead Planning',
    icon: Circle,
  },
  {
    href: '/planning/fabric',
    label: 'Fabric Planning',
    icon: Layers,
  },
];

export function PlanningSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-background flex-shrink-0">
      <div className="p-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Development Planning
        </h2>
      </div>
      <nav className="px-2">
        <ul>
          {planningNavItems.map((item) => (
            <li key={item.href}>
              <Button
                variant={pathname === item.href ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                asChild
              >
                <Link href={item.href}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
