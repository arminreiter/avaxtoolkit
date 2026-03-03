"use client"

import { useEffect, useState } from "react"
import { Terminal, ShieldCheck, Github, Cpu, Lock, Braces } from "lucide-react"

const HEX_NOISE = "4156 4158 544f 4f4c 4b49 54 2f2f 6c6f 63 616c 686f 7374 3a39 3635 30"

function useTyped(text: string, speed = 40, delay = 0) {
  const [displayed, setDisplayed] = useState("")
  useEffect(() => {
    let i = 0
    let intervalId: ReturnType<typeof setInterval> | null = null
    const timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        if (i < text.length) {
          setDisplayed(text.slice(0, i + 1))
          i++
        } else if (intervalId) {
          clearInterval(intervalId)
        }
      }, speed)
    }, delay)
    return () => {
      clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [text, speed, delay])
  return displayed
}

function TerminalBlock({
  id,
  path,
  icon: Icon,
  iconColor,
  children,
  delay,
}: {
  id: string
  path: string
  icon: React.ElementType
  iconColor: string
  children: React.ReactNode
  delay: number
}) {
  return (
    <div
      className="about-terminal group"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-muted/30">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <span className="ml-2 font-mono text-[11px] text-muted-foreground/70 tracking-wider uppercase">
          {path}
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground/40">
          {id}
        </span>
      </div>
      <div className="px-5 py-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-md ${iconColor}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground/40 tracking-widest">
            {id}
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}

function CodePrompt({ children, comment }: { children: string; comment?: string }) {
  return (
    <div className="font-mono text-xs leading-relaxed">
      <span className="text-green-400/80 select-none">$</span>{" "}
      <span className="text-foreground/90">{children}</span>
      {comment && (
        <span className="text-muted-foreground/40 ml-2">{`# ${comment}`}</span>
      )}
    </div>
  )
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/10 text-[11px] font-mono text-primary/90">
      {children}
    </code>
  )
}

export default function AboutPage() {
  const typed = useTyped("A local-first toolkit for the Avalanche ecosystem", 30, 300)

  return (
    <>
      <style>{`
        .about-terminal {
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--card);
          opacity: 0;
          transform: translateY(12px);
          animation: about-fade-up 0.5s ease forwards;
          overflow: hidden;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .dark .about-terminal:hover {
          border-color: rgba(232, 65, 66, 0.25);
          box-shadow: 0 0 30px rgba(232, 65, 66, 0.06), 0 0 8px rgba(232, 65, 66, 0.03);
        }
        .about-terminal:hover {
          border-color: rgba(232, 65, 66, 0.3);
        }
        @keyframes about-fade-up {
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes about-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .about-cursor {
          display: inline-block;
          width: 2px;
          height: 1.1em;
          background: var(--primary);
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: about-blink 1s step-end infinite;
        }
        @keyframes about-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .about-hex-scroll {
          animation: about-scroll 20s linear infinite;
        }
        .about-code-block {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border);
          border-radius: calc(var(--radius) - 2px);
          padding: 0.875rem 1rem;
          overflow-x: auto;
        }
        :root .about-code-block {
          background: rgba(0, 0, 0, 0.04);
        }
        .about-flow-line {
          border-left: 2px dashed var(--border);
        }
        .dark .about-flow-line {
          border-left-color: rgba(232, 65, 66, 0.15);
        }
      `}</style>

      <div className="space-y-5 max-w-3xl">

        {/* Hero */}
        <div
          className="about-terminal relative overflow-hidden"
          style={{ animationDelay: "0ms" }}
        >
          {/* Scrolling hex background */}
          <div className="absolute inset-0 flex items-center overflow-hidden opacity-[0.04] dark:opacity-[0.06] pointer-events-none select-none">
            <div className="about-hex-scroll whitespace-nowrap font-mono text-[10px] tracking-[0.5em]">
              {(HEX_NOISE + "  ").repeat(8)}
              {(HEX_NOISE + "  ").repeat(8)}
            </div>
          </div>

          <div className="relative px-5 py-6 sm:px-8 sm:py-8">
            <div className="font-mono text-[10px] text-muted-foreground/50 tracking-[0.3em] uppercase mb-3">
              sys.info // avax_toolkit
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold font-display tracking-tight leading-none">
              AVAX <span className="text-primary">Toolkit</span>
            </h1>
            <div className="mt-3 font-mono text-sm text-muted-foreground leading-relaxed min-h-[1.5em]">
              {typed}<span className="about-cursor" />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 font-mono text-[10px] text-muted-foreground/40 tracking-wider">
              <span>LOCAL_ONLY</span>
              <span className="text-primary/30">|</span>
              <span>ZERO_TELEMETRY</span>
              <span className="text-primary/30">|</span>
              <span>OPEN_SOURCE</span>
              <span className="text-primary/30">|</span>
              <span>STATIC_BUILD</span>
            </div>
          </div>
        </div>

        {/* [0x01] About */}
        <TerminalBlock
          id="0x01"
          path="~/about"
          icon={Cpu}
          iconColor="bg-primary/15 text-primary"
          delay={100}
        >
          <h2 className="text-lg font-semibold font-display tracking-tight">
            What is this?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A web-based toolkit for interacting with the Avalanche network.
            Explore C-Chain data, verify contracts, check validator status,
            manage wallets, inspect L1s — all through direct JSON-RPC calls to your
            node. No middlemen, no external APIs.
          </p>
        </TerminalBlock>

        {/* [0x02] Privacy */}
        <TerminalBlock
          id="0x02"
          path="~/security"
          icon={Lock}
          iconColor="bg-green-500/15 text-green-500"
          delay={200}
        >
          <h2 className="text-lg font-semibold font-display tracking-tight">
            Privacy &amp; Security
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Runs entirely on your local machine.{" "}
            <span className="text-foreground font-medium">No data is ever sent to external servers.</span>{" "}
            All RPC calls go directly from your browser to the configured node
            endpoint. No backend. No telemetry. No tracking. Your keys and
            addresses never leave your machine.
          </p>
          <div className="about-code-block font-mono text-[11px] text-muted-foreground/60 space-y-0.5">
            <div><span className="text-green-400/60">&#10003;</span> Zero outbound connections</div>
            <div><span className="text-green-400/60">&#10003;</span> No cookies, no analytics</div>
            <div><span className="text-green-400/60">&#10003;</span> Static build — runs offline after load</div>
            <div><span className="text-green-400/60">&#10003;</span> Keys never leave the browser</div>
          </div>
        </TerminalBlock>

        {/* [0x03] Quickstart */}
        <TerminalBlock
          id="0x03"
          path="~/quickstart"
          icon={Terminal}
          iconColor="bg-cyan-500/15 text-cyan-500"
          delay={300}
        >
          <h2 className="text-lg font-semibold font-display tracking-tight">
            Getting Started
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Clone, install, run. Three commands and you&apos;re in.
          </p>
          <div className="about-code-block space-y-1">
            <CodePrompt comment="clone the repo">git clone https://github.com/arminreiter/avaxtoolkit.git</CodePrompt>
            <CodePrompt>cd avaxtoolkit</CodePrompt>
            <CodePrompt comment="install deps">pnpm install</CodePrompt>
            <CodePrompt comment="start dev server">pnpm dev</CodePrompt>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Open <InlineCode>http://localhost:3000</InlineCode> and configure your
            RPC endpoint in <span className="text-foreground font-medium">Settings</span>.
          </p>
        </TerminalBlock>

        {/* [0x04] SSH Tunnel */}
        <TerminalBlock
          id="0x04"
          path="~/tunnel"
          icon={ShieldCheck}
          iconColor="bg-amber-500/15 text-amber-500"
          delay={400}
        >
          <h2 className="text-lg font-semibold font-display tracking-tight">
            Connecting to a Remote Validator
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Validator on a remote server? Use an SSH tunnel to forward the RPC port
            locally. No need to expose port 9650 to the internet.
          </p>
          <div className="about-code-block space-y-1">
            <CodePrompt comment="forward port 9650">
              ssh -N -L 9650:localhost:9650 user@your-validator-ip
            </CodePrompt>
          </div>

          {/* Flow diagram */}
          <div className="pl-4 space-y-3 my-2">
            <div className="flex items-start gap-3">
              <div className="about-flow-line pl-4 py-1">
                <div className="font-mono text-[11px] text-muted-foreground/60">
                  <span className="text-foreground/70">-N</span> — no remote shell, tunnel only
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="about-flow-line pl-4 py-1">
                <div className="font-mono text-[11px] text-muted-foreground/60">
                  <span className="text-foreground/70">-L 9650:localhost:9650</span> — bind local:remote
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Set your endpoint to <InlineCode>http://localhost:9650</InlineCode> in
            Settings. All traffic flows through the encrypted SSH tunnel directly to
            your validator.
          </p>

          {/* ASCII flow */}
          <div className="about-code-block font-mono text-[11px] text-center text-muted-foreground/70 tracking-wide py-4">
            <span className="text-cyan-400/70">[browser]</span>
            {" ──── "}
            <span className="text-muted-foreground/40">localhost:9650</span>
            {" ──── "}
            <span className="text-amber-400/70">ssh tunnel</span>
            {" ──── "}
            <span className="text-primary/70">[validator node]</span>
          </div>
        </TerminalBlock>

        {/* [0x05] Architecture */}
        <TerminalBlock
          id="0x05"
          path="~/arch"
          icon={Braces}
          iconColor="bg-purple-500/15 text-purple-500"
          delay={500}
        >
          <h2 className="text-lg font-semibold font-display tracking-tight">
            How It Works
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Makes JSON-RPC calls directly from the browser to Avalanche node APIs —
            Platform (P-Chain), Contract (C-Chain), and AVM (X-Chain).
            No intermediary server, no proxy.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Built as a static Next.js application. Once built, serve it from any
            static file server or run locally with <InlineCode>pnpm dev</InlineCode>.
          </p>
          <div className="about-code-block font-mono text-[11px] text-muted-foreground/50 space-y-0.5">
            <div><span className="text-purple-400/60">&#9656;</span> next.js &middot; static export &middot; no server runtime</div>
            <div><span className="text-purple-400/60">&#9656;</span> ethers.js &middot; direct RPC calls</div>
            <div><span className="text-purple-400/60">&#9656;</span> tailwind &middot; shadcn/ui &middot; radix primitives</div>
          </div>
        </TerminalBlock>

        {/* [0x06] Open Source */}
        <TerminalBlock
          id="0x06"
          path="~/source"
          icon={Github}
          iconColor="bg-foreground/10 text-foreground"
          delay={600}
        >
          <h2 className="text-lg font-semibold font-display tracking-tight">
            Open Source
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Fully open source. View the code, report issues, contribute.
          </p>
          <a
            href="https://github.com/arminreiter/avaxtoolkit"
            target="_blank"
            rel="noopener noreferrer"
            className="group/link inline-flex items-center gap-2 about-code-block text-sm font-mono hover:border-primary/30 transition-colors"
          >
            <Github className="h-4 w-4 text-muted-foreground group-hover/link:text-primary transition-colors" />
            <span className="text-foreground/80 group-hover/link:text-primary transition-colors">
              github.com/arminreiter/avaxtoolkit
            </span>
            <span className="text-muted-foreground/30 text-xs ml-1">&#8599;</span>
          </a>
        </TerminalBlock>

        {/* Footer hex */}
        <div
          className="about-terminal text-center py-3"
          style={{ animationDelay: "700ms" }}
        >
          <span className="font-mono text-[10px] text-muted-foreground/30 tracking-[0.4em]">
            EOF // 0x4156415854
          </span>
        </div>
      </div>
    </>
  )
}
