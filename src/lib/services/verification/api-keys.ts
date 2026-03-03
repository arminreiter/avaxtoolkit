const STORAGE_KEY = "avax-toolkit-etherscan-api-key"

export function getEtherscanApiKey(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) || undefined
  } catch {
    return undefined
  }
}

export function setEtherscanApiKey(key: string | undefined): void {
  try {
    if (key) {
      localStorage.setItem(STORAGE_KEY, key)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // localStorage not available
  }
}
