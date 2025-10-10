
'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export function useNavigation() {
  const router = useRouter();

  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  return { goBack };
}
