import { cn } from "@/lib/utils"

export const RalsonTyreIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 160 40"
    className={cn(className)}
    {...props}
  >
    <text
      x="0"
      y="20"
      fontFamily="Arial, sans-serif"
      fontSize="24"
      fontWeight="bold"
      fill="red"
      transform="skewX(-10)"
    >
      RALSON
    </text>
    <rect x="0" y="28" width="160" height="12" fill="white" />
    <text
      x="5"
      y="38"
      fontFamily="Arial, sans-serif"
      fontSize="10"
      fontWeight="bold"
      fill="black"
    >
      TIRES
    </text>
    <line x1="50" y1="28" x2="50" y2="40" stroke="gray" strokeWidth="1" />
    <text
      x="55"
      y="38"
      fontFamily="Arial, sans-serif"
      fontSize="8"
      fill="gray"
    >
      TREAD NEW PATHS
    </text>
  </svg>
)
