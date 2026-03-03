"use client"

import { useState } from "react"
import { Braces } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { JsonPanel } from "@/components/tools/JsonPanel"

interface ToolCardProps {
  title: string
  description: string
  children: React.ReactNode
  rawJson?: unknown
}

export function ToolCard({ title, description, children, rawJson }: ToolCardProps) {
  const [showJson, setShowJson] = useState(false)
  const hasJson = rawJson != null && (typeof rawJson !== "object" || Object.keys(rawJson as object).length > 0)

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-primary font-mono text-sm select-none">$</span>
        <h1 className="text-2xl font-bold font-display tracking-wider uppercase">{title}</h1>
        <span className="cursor-blink text-primary text-lg leading-none">_</span>
      </div>
      <p className="text-xs text-muted-foreground font-mono mb-4 pl-5">
        <span className="text-muted-foreground/40">{"//"} </span>{description}
      </p>
      <div className={showJson && hasJson ? "flex flex-col lg:flex-row gap-4" : ""}>
        <Card className={showJson && hasJson ? "flex-1 min-w-0" : ""}>
          <div className="terminal-chrome-header">
            <span className="text-primary/40">$</span>
            <span className="flex-1">{title.toLowerCase().replace(/\s+/g, "_")}</span>
            {hasJson && (
              <button
                onClick={() => setShowJson(!showJson)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-sm transition-colors ${
                  showJson
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Braces className="h-3 w-3" />
                <span>json</span>
              </button>
            )}
          </div>
          <CardContent className="pt-4">{children}</CardContent>
        </Card>
        {showJson && hasJson && (
          <Card className="flex-1 min-w-0 max-h-[80vh] flex flex-col">
            <JsonPanel data={rawJson} />
          </Card>
        )}
      </div>
    </div>
  )
}
