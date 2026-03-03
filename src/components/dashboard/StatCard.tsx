import { Card, CardContent } from "@/components/ui/card"
import { type LucideIcon } from "lucide-react"
import { InfoTooltip } from "@/components/tools/InfoTooltip"

const iconColorMap: Record<string, { text: string; bg: string; border: string }> = {
  red: { text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30" },
  amber: { text: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  cyan: { text: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/30" },
  purple: { text: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/30" },
  green: { text: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/30" },
  blue: { text: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/30" },
}

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  loading?: boolean
  rpcInfo?: string
  iconColor?: keyof typeof iconColorMap
  delay?: number
}

export function StatCard({ label, value, icon: Icon, loading, rpcInfo, iconColor, delay = 0 }: StatCardProps) {
  const colors = iconColor ? iconColorMap[iconColor] : null

  return (
    <Card
      className="group animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="pt-3 pb-3 relative">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-muted-foreground/40 select-none">{"//"}</span>
              <p className="text-[11px] text-muted-foreground uppercase tracking-[0.12em] font-mono">{label}</p>
              {rpcInfo && <InfoTooltip rpcMethod={rpcInfo} />}
            </div>
            {loading ? (
              <div className="h-6 w-20 shimmer mt-1.5" />
            ) : (
              <p className="text-lg font-bold mt-1 leading-tight font-display tracking-tight">{value}</p>
            )}
          </div>
          <div className={`h-8 w-8 ${colors?.bg ?? "bg-primary/10"} border ${colors?.border ?? "border-primary/30"} flex items-center justify-center shrink-0`}>
            <Icon className={`h-4 w-4 ${colors?.text ?? "text-primary"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
