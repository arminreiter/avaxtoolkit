"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  const pathname = usePathname()
  return (
    <div className="max-w-xl mx-auto mt-16 terminal-chrome border border-border bg-card">
      <div className="terminal-chrome-header">
        <span className="text-primary/40">$</span>
        <span>error_404</span>
      </div>
      <div className="p-6 font-mono space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="text-primary">$</span> cd {pathname}
        </p>
        <p className="text-sm text-destructive">bash: cd: {pathname}: No such file or directory</p>
        <h1 className="text-3xl font-bold font-display uppercase tracking-wider">
          404<span className="text-primary">_</span>Not Found<span className="cursor-blink text-primary">_</span>
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/"><Home className="h-3.5 w-3.5" />Dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/explorer"><Search className="h-3.5 w-3.5" />Explorer</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
