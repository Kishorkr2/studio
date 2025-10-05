'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from '@/components/ui/loader';

export default function PlanningPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/planning/gt');
  }, [router]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Loader />
    </div>
  );
}
