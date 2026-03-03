import type { MetadataRoute } from "next"
import { navigation } from "@/lib/navigation"

export const dynamic = "force-static"

const BASE = "https://avaxtoolkit.com"

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: string[] = []
  for (const section of navigation) {
    routes.push(section.href)
    if (section.children) {
      for (const child of section.children) {
        if (!routes.includes(child.href)) routes.push(child.href)
      }
    }
  }

  return routes.map((route) => ({
    url: `${BASE}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.8,
  }))
}
