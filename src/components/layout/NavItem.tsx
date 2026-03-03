"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import type { NavSection } from "@/lib/navigation"

export function NavItem({ section }: { section: NavSection }) {
  const pathname = usePathname()
  const isActive = pathname === section.href || (section.href !== "/" && pathname.startsWith(section.href + "/"))
  const [isOpen, setIsOpen] = useState(isActive)
  const Icon = section.icon

  // Open nav section when it becomes active (React-recommended "setState during render" pattern)
  const [prevActive, setPrevActive] = useState(isActive)
  if (isActive && !prevActive) {
    setPrevActive(isActive)
    setIsOpen(true)
  } else if (prevActive !== isActive) {
    setPrevActive(isActive)
  }

  if (!section.children) {
    return (
      <Link href={section.href}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-[13px] font-mono transition-all duration-150 group border border-transparent",
          isActive
            ? "bg-primary/10 text-primary border-primary/30"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        )}>
        <span className={cn(
          "text-[10px] select-none shrink-0",
          isActive ? "text-primary" : "text-muted-foreground/40"
        )}>
          {isActive ? ">" : " "}
        </span>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive && "text-primary drop-shadow-[0_0_4px_rgba(232,65,66,0.5)]")} />
        <span className="truncate">{section.label}</span>
        {isActive && <span className="cursor-blink ml-auto text-primary text-xs">_</span>}
      </Link>
    )
  }

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-[13px] font-mono transition-all duration-150 w-full group border border-transparent",
          isActive
            ? "bg-primary/10 text-primary border-primary/30"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        )}>
        <span className={cn(
          "text-[10px] select-none shrink-0",
          isActive ? "text-primary" : "text-muted-foreground/40"
        )}>
          {isActive ? ">" : " "}
        </span>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive && "text-primary drop-shadow-[0_0_4px_rgba(232,65,66,0.5)]")} />
        <span className="flex-1 text-left truncate">{section.label}</span>
        <ChevronRight className={cn(
          "h-3 w-3 transition-transform duration-150 text-muted-foreground/40",
          isOpen && "rotate-90"
        )} />
      </button>
      <div className={cn(
        "overflow-hidden transition-all duration-200",
        isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="ml-5 mt-0.5 mb-1 space-y-0 border-l border-border pl-3">
          {section.children.map(child => {
            const isChildActive = pathname === child.href
            return (
              <Link key={child.href} href={child.href}
                className={cn(
                  "block px-2 py-1 text-[12px] font-mono transition-all duration-100 relative",
                  isChildActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}>
                <span className="text-[10px] mr-1 select-none">
                  {isChildActive ? <span className="text-primary">{">"}</span> : <span className="text-muted-foreground/30">-</span>}
                </span>
                {child.label}
                {isChildActive && <span className="cursor-blink ml-1 text-primary text-[10px]">_</span>}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
