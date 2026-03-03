/**
 * Common 4-byte EVM function selectors mapped to human-readable names.
 * Used by the block explorer to display method names for transactions.
 */
export const SIGNATURES: Record<string, string> = {
  // ERC-20
  "0xa9059cbb": "transfer",
  "0x23b872dd": "transferFrom",
  "0x095ea7b3": "approve",
  "0x70a08231": "balanceOf",
  "0xdd62ed3e": "allowance",
  "0x18160ddd": "totalSupply",

  // ERC-721
  "0x42842e0e": "safeTransferFrom",
  "0xb88d4fde": "safeTransferFrom",
  "0x6352211e": "ownerOf",
  "0xe985e9c5": "isApprovedForAll",
  "0xa22cb465": "setApprovalForAll",

  // ERC-1155
  "0xf242432a": "safeTransferFrom",
  "0x2eb2c2d6": "safeBatchTransferFrom",

  // DEX / Uniswap-style
  "0x38ed1739": "swapExactTokensForTokens",
  "0x8803dbee": "swapTokensForExactTokens",
  "0x7ff36ab5": "swapExactAVAXForTokens",
  "0x18cbafe5": "swapExactTokensForAVAX",
  "0x5c11d795": "swapExactTokensForTokensSupportingFeeOnTransferTokens",
  "0xe8e33700": "addLiquidity",
  "0xf305d719": "addLiquidityAVAX",
  "0xbaa2abde": "removeLiquidity",
  "0x02751cec": "removeLiquidityAVAX",

  // Multicall
  "0xac9650d8": "multicall",
  "0x5ae401dc": "multicall",

  // WAVAX / WETH
  "0xd0e30db0": "deposit",
  "0x2e1a7d4d": "withdraw",

  // Common
  "0x3593564c": "execute",
  "0x12aa3caf": "swap",
  "0x2646478b": "swap",
  "0x0502b1c5": "unoswapTo",
  "0xb6f9de95": "swapExactETHForTokensSupportingFeeOnTransferTokens",
  "0x791ac947": "swapExactTokensForETHSupportingFeeOnTransferTokens",

  // Staking
  "0xa694fc3a": "stake",
  "0x2e17de78": "unstake",
  "0x3d18b912": "getReward",
  "0xe9fad8ee": "exit",

  // Proxy
  "0x3659cfe6": "upgradeTo",
  "0x4f1ef286": "upgradeToAndCall",
};

/**
 * Decode a transaction input into a human-readable method name.
 *
 * Returns "Transfer" for native AVAX transfers (null/empty/short input).
 * Looks up the 4-byte selector in the SIGNATURES map, falling back to the
 * raw hex selector if no match is found.
 */
export function decodeMethodName(input: string | null | undefined): string {
  if (!input || input === "0x" || input === "0x00" || input.length < 10) {
    return "Transfer";
  }

  const selector = input.slice(0, 10).toLowerCase();
  return SIGNATURES[selector] ?? selector;
}
