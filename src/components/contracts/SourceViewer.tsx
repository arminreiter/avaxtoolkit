"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useTheme } from "next-themes"
import { Braces, Check, Copy, Download, FileCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
import type { ABIEntry, ContractSource } from "@/lib/services/verification"
import type { HighlighterCore } from "shiki/core"

interface SourceViewerProps {
  source: ContractSource | null
  /** ABI to show in the "ABI" view; falls back to source.abi. */
  abi?: ABIEntry[] | null
  /** Used to name the downloaded zip. */
  contractName?: string
  address?: string
}

const ABI_KEY = "\0abi"

export function SourceViewer({ source, abi, contractName, address }: SourceViewerProps) {
  const fileNames = useMemo(() => source ? Object.keys(source.files) : [], [source])
  const abiEntries = abi ?? source?.abi
  const [selected, setSelected] = useState("")
  // Derived so a new source falls back to its first file without a reset effect
  const selectedFile = (selected === ABI_KEY && abiEntries?.length) || (source && selected in source.files)
    ? selected
    : fileNames[0] ?? ""
  const isAbi = selectedFile === ABI_KEY
  const content = isAbi ? JSON.stringify(abiEntries, null, 2) : source?.files[selectedFile] ?? ""

  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme === "light" ? "github-light" : "github-dark"
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null)
  const codeContainerRef = useRef<HTMLDivElement>(null)
  const { copied, copy } = useCopyToClipboard()

  // Initialize shiki highlighter once
  useEffect(() => {
    let cancelled = false

    async function init() {
      // Fine-grained imports: only the Solidity grammar + two themes get bundled,
      // and the JS regex engine avoids shipping the Oniguruma WASM.
      const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
        import("shiki/core"),
        import("shiki/engine/javascript"),
      ])
      const hl = await createHighlighterCore({
        themes: [import("shiki/themes/github-dark.mjs"), import("shiki/themes/github-light.mjs")],
        langs: [import("shiki/langs/solidity.mjs")],
        engine: createJavaScriptRegexEngine(),
      })
      if (!cancelled) setHighlighter(hl)
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  const highlightedHtml = useMemo(
    () => highlighter && !isAbi && content ? highlighter.codeToHtml(content, { lang: "solidity", theme }) : "",
    [highlighter, isAbi, content, theme],
  )

  // Sanitize shiki output: only allow pre, code, span tags with style/class attributes.
  // This provides defense-in-depth against supply chain or API-driven XSS.
  function sanitizeShikiHtml(html: string): string {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")
    const allowed = new Set(["PRE", "CODE", "SPAN"])
    const allowedAttrs = new Set(["style", "class"])

    function walk(node: Node) {
      const children = Array.from(node.childNodes)
      for (const child of children) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as Element
          if (!allowed.has(el.tagName)) {
            el.replaceWith(document.createTextNode(el.textContent ?? ""))
            continue
          }
          for (const attr of Array.from(el.attributes)) {
            if (!allowedAttrs.has(attr.name)) {
              el.removeAttribute(attr.name)
            } else if (attr.name === "style" && /url\s*\(|expression\s*\(/i.test(attr.value)) {
              el.removeAttribute(attr.name)
            }
          }
          walk(el)
        }
      }
    }

    walk(doc.body)
    return doc.body.innerHTML
  }

  useEffect(() => {
    if (codeContainerRef.current) {
      // Safe: sanitizeShikiHtml strips all tags except pre/code/span with style/class
      codeContainerRef.current.textContent = ""
      if (highlightedHtml) {
        const sanitized = sanitizeShikiHtml(highlightedHtml)
        const template = document.createElement("template")
        template.innerHTML = sanitized
        codeContainerRef.current.appendChild(template.content)
      }
    }
  }, [highlightedHtml])

  const downloadSource = useCallback(async () => {
    if (!source) return
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()

    for (const [name, content] of Object.entries(source.files)) {
      zip.file(name.endsWith(".sol") ? name : `${name}.sol`, content)
    }

    const blob = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${contractName || address || "contract"}-source.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [source, contractName, address])

  if (!source) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileCode className="h-10 w-10 mb-3" />
        <p className="text-sm">No source code available</p>
      </div>
    )
  }

  const fileButton = (key: string, label: string, title: string, Icon: typeof FileCode) => (
    <button
      key={key}
      type="button"
      onClick={() => setSelected(key)}
      aria-current={selectedFile === key ? "true" : undefined}
      className={`w-full text-left px-3 py-2 rounded-md text-sm font-mono truncate transition-colors ${
        selectedFile === key
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      }`}
      title={title}
    >
      <Icon className="inline-block h-3.5 w-3.5 mr-2 shrink-0" />
      {label}
    </button>
  )

  const currentLabel = isAbi ? "ABI" : selectedFile.split("/").pop()

  return (
    <div className="space-y-4">
      {/* Download button */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={downloadSource}>
          <Download className="h-4 w-4" />
          Download Source
        </Button>
      </div>

      {/* File list + source viewer: stacked on mobile, two columns from md */}
      <div className="flex flex-col md:flex-row rounded-lg border">
        {/* File list */}
        <div className="w-full md:w-1/4 md:min-w-[180px] border-b md:border-b-0 md:border-r">
          <ScrollArea className="h-40 md:h-[500px]">
            <div className="p-2 space-y-0.5">
              {fileNames.map((name) => fileButton(name, name.split("/").pop() ?? name, name, FileCode))}
              {abiEntries?.length ? fileButton(ABI_KEY, "ABI", "Contract ABI (JSON)", Braces) : null}
            </div>
          </ScrollArea>
        </div>

        {/* Source code viewer */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-1.5">
            <span className="truncate font-mono text-xs text-muted-foreground" title={isAbi ? undefined : selectedFile}>
              {currentLabel}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(content)}
              aria-label={`Copy ${currentLabel}`}
              title={`Copy ${currentLabel}`}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <ScrollArea className="h-[500px]">
            {isAbi ? (
              <pre className="bg-muted/50 p-4 text-sm font-mono w-max min-w-full">{content}</pre>
            ) : (
              <div
                ref={codeContainerRef}
                className="bg-muted/50 p-4 text-sm w-max min-w-full [&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:text-sm [&_code]:[counter-reset:line] [&_.line]:before:[counter-increment:line] [&_.line]:before:content-[counter(line)] [&_.line]:before:inline-block [&_.line]:before:w-8 [&_.line]:before:mr-4 [&_.line]:before:text-right [&_.line]:before:text-muted-foreground/50 [&_.line]:before:select-none"
              />
            )}
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
