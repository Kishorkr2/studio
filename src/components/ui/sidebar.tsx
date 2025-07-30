
"use client"

import * as React from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Context
interface SidebarContextProps {
  isExpanded: boolean
  isMobile: boolean
  onToggle?: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | undefined>(undefined)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

// Provider
interface SidebarProviderProps {
  children: React.ReactNode
  defaultExpanded?: boolean
}

export function SidebarProvider({
  children,
  defaultExpanded = true,
}: SidebarProviderProps) {
  const isMobile = useIsMobile()
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded)

  const onToggle = React.useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  React.useEffect(() => {
    if (isMobile) {
      setIsExpanded(false)
    } else {
      setIsExpanded(defaultExpanded)
    }
  }, [isMobile, defaultExpanded])

  const value = React.useMemo(() => ({ isExpanded, isMobile, onToggle }), [isExpanded, isMobile, onToggle]);

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  )
}

// Main Components
export function Sidebar({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  const { isExpanded, isMobile, onToggle } = useSidebar()

  if (isMobile) {
    return (
      <Sheet open={isExpanded} onOpenChange={onToggle}>
        <SheetContent side="left" className="w-64 p-0">
          <aside className="flex h-full flex-col">{children}</aside>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-20 flex h-screen flex-col border-r transition-[width] duration-300 ease-in-out",
        isExpanded ? "w-64" : "w-20",
        className
      )}
    >
      {children}
    </aside>
  )
}

export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex h-16 items-center shrink-0", className)} {...props} />
))
SidebarHeader.displayName = "SidebarHeader"

export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex-1 overflow-y-auto overflow-x-hidden", className)} {...props} />
))
SidebarContent.displayName = "SidebarContent"

export const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn("space-y-1 p-4", className)} {...props} />
))
SidebarMenu.displayName = "SidebarMenu"

export const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mt-auto flex h-16 items-center shrink-0", className)}
    {...props}
  />
))
SidebarFooter.displayName = "SidebarFooter"

export const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { isExpanded, isMobile } = useSidebar()
  return (
    <div
      ref={ref}
      className={cn(
        "transition-[margin-left] duration-300 ease-in-out",
        !isMobile && (isExpanded ? "ml-64" : "ml-20"),
        className
      )}
      {...props}
    >
        {children}
    </div>
  )
})
SidebarInset.displayName = "SidebarInset"

// Button Components
export const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(({ className, children, ...props }, ref) => {
  const { onToggle } = useSidebar()
  return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className={cn(className)}
        {...props}
      >
        {children}
      </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

interface SidebarMenuButtonProps extends ButtonProps {
  isActive?: boolean
  tooltip?: string
}

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(({ className, isActive, tooltip, children, ...props }, ref) => {
  const { isExpanded } = useSidebar()

  const buttonContent = (
    <Button
      ref={ref}
      variant={isActive ? "secondary" : "ghost"}
      className={cn(
        "h-12 w-full justify-start",
        !isExpanded && "justify-center",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )

  if (!isExpanded && tooltip) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
          <TooltipContent side="right">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return buttonContent
})
SidebarMenuButton.displayName = "SidebarMenuButton"
