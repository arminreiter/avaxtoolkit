"use client"

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

interface VerificationInstructionsProps {
  address: string
  chainId: number
}

export function VerificationInstructions({ address, chainId }: VerificationInstructionsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-base font-semibold">How to Verify This Contract</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a method below to verify your contract source code.
        </p>
      </div>

      <Accordion type="multiple">
        <AccordionItem value="hardhat">
          <AccordionTrigger>Hardhat</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Use the Hardhat verification plugin to verify your contract on Snowtrace (Routescan).
              </p>
              <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto">
{`npx hardhat verify --network avalanche ${address}`}
              </pre>
              <p className="text-sm text-muted-foreground">
                Make sure your <code className="text-xs bg-muted px-1 py-0.5 rounded">hardhat.config.ts</code> includes the Avalanche network configuration:
              </p>
              <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto">
{`import "@nomicfoundation/hardhat-verify";

const config: HardhatUserConfig = {
  networks: {
    avalanche: {
      url: "https://api.avax.network/ext/bc/C/rpc",
      chainId: 43114,
    },
  },
  etherscan: {
    apiKey: {
      avalanche: "YOUR_SNOWTRACE_API_KEY",
    },
  },
};`}
              </pre>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="foundry">
          <AccordionTrigger>Foundry</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Use Foundry&apos;s <code className="text-xs bg-muted px-1 py-0.5 rounded">forge verify-contract</code> command to verify your contract.
              </p>
              <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto">
{`forge verify-contract \\
  ${address} \\
  src/MyContract.sol:MyContract \\
  --chain-id ${chainId} \\
  --verifier sourcify`}
              </pre>
              <p className="text-sm text-muted-foreground">
                Replace <code className="text-xs bg-muted px-1 py-0.5 rounded">src/MyContract.sol:MyContract</code> with the path and name of your contract.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  )
}
