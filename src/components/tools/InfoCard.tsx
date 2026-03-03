import { InfoTooltip } from "@/components/tools/InfoTooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface InfoCardProps {
  label: string
  rpcMethod?: string
  children: React.ReactNode
}

export function InfoCard({ label, rpcMethod, children }: InfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
          {label}
          {rpcMethod && <InfoTooltip rpcMethod={rpcMethod} />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
}
