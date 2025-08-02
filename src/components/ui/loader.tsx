import { cn } from "@/lib/utils"

const TyreIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("animate-spin", className)}
    {...props}
  >
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 4a6 6 0 1 1-6 6 6 6 0 0 1 6-6z" />
    <path d="m12 6 2 2" />
    <path d="m12 18-2-2" />
    <path d="m6 12 2-2" />
    <path d="m18 12-2 2" />
    <path d="m8.46 8.46 2 2" />
    <path d="m15.54 15.54-2-2" />
    <path d="m8.46 15.54 2-2" />
    <path d="m15.54 8.46-2 2" />
  </svg>
)

export function Loader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="status" {...props}>
      <TyreIcon className={cn("h-8 w-8 text-primary", className)} />
      <span className="sr-only">Loading...</span>
    </div>
  )
}
