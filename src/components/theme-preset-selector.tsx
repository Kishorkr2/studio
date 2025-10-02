
'use client'

import * as React from 'react'
import { Check, Palette } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export const THEMES = [
  { name: 'Classic Blue', id: 'theme-blue' },
  { name: 'Industrial Gray', id: 'theme-gray' },
  { name: 'Green Productivity', id: 'theme-green' },
  { name: 'Orange Energy', id: 'theme-orange' },
  { name: 'Minimal White', id: 'theme-white' },
] as const;

export function ThemePresetSelector() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" disabled>
        <Palette className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Palette className="h-5 w-5" />
          <span className="sr-only">Select Theme Preset</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEMES.map((preset) => (
          <DropdownMenuItem
            key={preset.id}
            onClick={() => setTheme(preset.id)}
            className="flex items-center justify-between"
          >
            {preset.name}
            {theme === preset.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
