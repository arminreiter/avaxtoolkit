import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/tools/InfoTooltip"
import { CopyableId } from "@/components/tools/CopyableId"

interface DetailItem {
  label: string
  value: React.ReactNode
  mono?: boolean
  fullWidth?: boolean
  copyable?: boolean
}

interface DetailGridProps {
  title?: string
  rpcMethod?: string
  items: DetailItem[]
  columns?: 2 | 3 | 4
}

export function DetailGrid({ title, rpcMethod, items, columns = 2 }: DetailGridProps) {
  const gridCols =
    columns === 4
      ? "grid-cols-2 sm:grid-cols-4"
      : columns === 3
        ? "grid-cols-1 sm:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2"

  return (
    <Card>
      {title && (
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium uppercase tracking-wider">{title}</CardTitle>
            {rpcMethod && <InfoTooltip rpcMethod={rpcMethod} />}
          </div>
        </CardHeader>
      )}
      <CardContent className={title ? "" : "pt-4"}>
        <div className={`grid ${gridCols} gap-x-6 gap-y-3`}>
          {items.map((item) => (
            <div key={typeof item.label === "string" ? item.label : String(item.label)} className={item.fullWidth ? "col-span-full" : ""}>
              <p className="text-xs text-muted-foreground mb-0.5 uppercase tracking-wide">{item.label}</p>
              {typeof item.value === "string" ? (
                item.copyable ? (
                  <CopyableId
                    value={item.value}
                    className={`text-sm ${item.mono ? "font-mono" : "font-medium"}`}
                  />
                ) : (
                  <p className={`text-sm break-all ${item.mono ? "font-mono" : "font-medium"}`}>
                    {item.value}
                  </p>
                )
              ) : (
                item.value
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
