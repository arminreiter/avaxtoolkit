import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LoadingButtonProps extends React.ComponentProps<typeof Button> { loading?: boolean }

export function LoadingButton({ loading, children, disabled, className, ...props }: LoadingButtonProps) {
  return (
    <Button disabled={loading || disabled} className={`glow-red-sm hover:glow-red transition-shadow uppercase tracking-wider font-display font-semibold ${className ?? ""}`} {...props}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}
