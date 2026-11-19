"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { navigation } from "@/lib/navigation"
import { ToolCard } from "@/components/tools/ToolCard"

/** Index page for a navigation section: heading + links to its children. */
export function SectionIndex({ href, description }: { href: string; description: string }) {
  const section = navigation.find(s => s.href === href)
  if (!section) throw new Error(`No navigation section for ${href}`)

  return (
    <ToolCard title={section.label} description={description}>
      <nav aria-label={section.label} className="grid gap-2 sm:grid-cols-2">
        {section.children?.filter(c => c.href !== href).map(child => (
          <Link
            key={child.href}
            href={child.href}
            className="flex items-center justify-between border border-border px-4 py-3 font-mono text-sm hover:border-primary/40 hover:text-primary transition-colors"
          >
            <span><span className="text-muted-foreground/50 mr-2">&gt;</span>{child.label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </nav>
    </ToolCard>
  )
}
