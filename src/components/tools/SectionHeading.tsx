import { InfoTooltip } from "@/components/tools/InfoTooltip"

export function SectionHeading({ title, rpcMethod }: { title: string; rpcMethod?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <h2 className="text-base font-semibold">{title}</h2>
      {rpcMethod && <InfoTooltip rpcMethod={rpcMethod} />}
    </div>
  )
}
