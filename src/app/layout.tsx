import type { Metadata } from "next"
import dynamic from "next/dynamic"
import { Exo_2, Rajdhani, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/ThemeProvider"
import { NetworkProvider } from "@/lib/contexts/network-context"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { WalletProvider } from "@/lib/contexts/wallet-context"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const WalletDialog = dynamic(() => import("@/components/wallet/WalletDialog").then(m => ({ default: m.WalletDialog })))

const exo2 = Exo_2({ subsets: ["latin"], variable: "--font-sans" })
const rajdhani = Rajdhani({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-display" })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: {
    default: "AVAX Toolkit",
    template: "%s | AVAX Toolkit",
  },
  description: "A local-first, open-source toolkit for the Avalanche ecosystem - chain explorer, validator dashboards, wallet tools, contract verification, and transaction utilities.",
  keywords: ["avalanche", "avax", "blockchain", "toolkit", "explorer", "validator", "wallet", "smart contracts"],
  authors: [{ name: "AVAX Toolkit" }],
  metadataBase: new URL("https://avaxtoolkit.com"),
  openGraph: {
    title: "AVAX Toolkit",
    description: "A local-first, open-source toolkit for the Avalanche ecosystem - chain explorer, validator dashboards, wallet tools, contract verification, and transaction utilities.",
    type: "website",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "AVAX Toolkit Dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AVAX Toolkit",
    description: "A local-first, open-source toolkit for the Avalanche ecosystem - chain explorer, validator dashboards, wallet tools, contract verification, and transaction utilities.",
    images: ["/opengraph-image.png"],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${exo2.variable} ${rajdhani.variable} ${jetbrainsMono.variable} font-mono antialiased bg-background text-foreground`}>
        <ThemeProvider>
          <NetworkProvider>
            <WalletProvider>
            <TooltipProvider>
              <WalletDialog />
              <Sidebar />
              <div className="md:ml-64 min-h-screen flex flex-col">
                <div className="mt-12 md:mt-0 sticky top-0 z-30 bg-card/80 backdrop-blur-sm">
                  <Header />
                </div>
                <main className="flex-1 p-4 md:p-6">
                  {children}
                </main>
              </div>
            </TooltipProvider>
            </WalletProvider>
          </NetworkProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
