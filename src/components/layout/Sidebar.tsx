"use client"

import { Github, Menu } from "lucide-react"
import Image from "next/image"
import logoIcon from "@/app/icon.svg"
import { navigation } from "@/lib/navigation"
import { NavItem } from "./NavItem"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"

function SidebarContent() {
  return (
    <div className="flex flex-col h-full">
      {/* Logo — terminal style */}
      <div className="px-4 h-11 flex items-center border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 flex items-center justify-center">
            <Image src={logoIcon} alt="AVAX Toolkit" width={24} height={24} className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider font-display uppercase leading-none text-foreground">
              AVAX<span className="text-primary">_</span>Toolkit
            </h1>
            <p className="text-[9px] text-muted-foreground tracking-[0.25em] uppercase mt-0.5 font-mono">
              v{process.env.NEXT_PUBLIC_APP_VERSION} {"// "}{process.env.NEXT_PUBLIC_APP_ENV}
            </p>
          </div>
        </div>
      </div>

      {/* System status line */}
      <div className="px-4 py-2 border-b border-border/60 flex items-center gap-2">
        <span className="text-[9px] font-mono text-muted-foreground tracking-wider">
          <span className="text-primary/60">$</span> sys.nav --list
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {navigation.map(section => (
          <NavItem key={section.href} section={section} />
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 flex items-center justify-center gap-2">
        <a
          href="https://github.com/arminreiter/avaxtoolkit"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <Github className="h-4 w-4" />
        </a>
        <span className="text-muted-foreground/30 text-[10px]">|</span>
        <a
          href="https://avaxtoolkit.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono text-muted-foreground/50 hover:text-muted-foreground transition-colors tracking-wider"
        >
          avaxtoolkit.com
        </a>
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-sidebar h-screen fixed left-0 top-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile header bar + sheet */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar border-b border-border px-4 py-3 flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 flex items-center justify-center">
            <Image src={logoIcon} alt="AVAX Toolkit" width={20} height={20} className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold font-display tracking-wider uppercase">
            AVAX<span className="text-primary">_</span>Toolkit
          </span>
        </div>
      </div>
    </>
  )
}
