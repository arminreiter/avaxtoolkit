"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Download, FileCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ContractSource } from "@/lib/services/verification"
import type { Highlighter } from "shiki"

interface SourceViewerProps {
  source: ContractSource | null
}

export function SourceViewer({ source }: SourceViewerProps) {
  const fileNames = source ? Object.keys(source.files) : []
  const [selectedFile, setSelectedFile] = useState<string>(fileNames[0] ?? "")
  const [highlightedHtml, setHighlightedHtml] = useState<string>("")
  const highlighterRef = useRef<Highlighter | null>(null)
  const codeContainerRef = useRef<HTMLDivElement>(null)

  // Initialize shiki highlighter once
  useEffect(() => {
    let cancelled = false

    async function init() {
      if (highlighterRef.current) return
      const { createHighlighter } = await import("shiki")
      const hl = await createHighlighter({
        themes: ["github-dark"],
        langs: ["solidity"],
      })
      if (!cancelled) {
        highlighterRef.current = hl
        // Trigger a re-highlight if we already have a selected file
        if (selectedFile && source?.files[selectedFile]) {
          const html = hl.codeToHtml(source.files[selectedFile], {
            lang: "solidity",
            theme: "github-dark",
          })
          setHighlightedHtml(html)
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Highlight on file change
  useEffect(() => {
    if (!source || !selectedFile || !source.files[selectedFile]) {
      setHighlightedHtml("")
      return
    }

    const hl = highlighterRef.current
    if (!hl) return

    const html = hl.codeToHtml(source.files[selectedFile], {
      lang: "solidity",
      theme: "github-dark",
    })
    setHighlightedHtml(html)
  }, [selectedFile, source])

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

  // Reset selected file when source changes
  useEffect(() => {
    const names = source ? Object.keys(source.files) : []
    setSelectedFile(names[0] ?? "")
  }, [source])

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
    a.download = "source.zip"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [source])

  if (!source) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileCode className="h-10 w-10 mb-3" />
        <p className="text-sm">No source code available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Download button */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={downloadSource}>
          <Download className="h-4 w-4" />
          Download Source
        </Button>
      </div>

      {/* Two-column layout: file list + source viewer */}
      <div className="flex gap-4 rounded-lg border">
        {/* File list */}
        <div className="w-1/4 min-w-[180px] border-r">
          <ScrollArea className="h-[500px]">
            <div className="p-2 space-y-0.5">
              {fileNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedFile(name)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-mono truncate transition-colors ${
                    selectedFile === name
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                  title={name}
                >
                  <FileCode className="inline-block h-3.5 w-3.5 mr-2 shrink-0" />
                  {name.split("/").pop()}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Source code viewer */}
        <div className="flex-1 overflow-x-auto">
          <ScrollArea className="h-[500px]">
            <div
              ref={codeContainerRef}
              className="bg-muted/50 rounded-lg p-4 text-sm [&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:text-sm"
            />
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
