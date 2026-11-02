import { Modules } from "@medusajs/framework/utils"

/**
 * Public aliases keep browser state stable while Medusa keeps its generated
 * Region IDs. Store routes also accept a native Region ID for API clients.
 * See documentation/AI_CONTEXT.md §8.9.
 */
export const MARKETPLACE_REGIONS = {
  reg_eu: { currency_code: "eur", locale: "en-EU" },
  reg_in: { currency_code: "inr", locale: "en-IN" },
} as const

export const DEFAULT_MARKETPLACE_REGION = "reg_eu"

export type RegionalContextInput = {
  region_id?: string
  currency_code?: string
}

export class RegionalContextError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

export const resolveRegionalContext = async (container: any, input: RegionalContextInput = {}) => {
  const requestedId = input.region_id || DEFAULT_MARKETPLACE_REGION
  const alias = MARKETPLACE_REGIONS[requestedId as keyof typeof MARKETPLACE_REGIONS]
  const requestedCurrency = input.currency_code?.toLowerCase()
  const regionService = container.resolve(Modules.REGION) as any

  const regions = alias
    ? await regionService.listRegions({ currency_code: alias.currency_code }, { take: 10 })
    : await regionService.listRegions({ id: requestedId }, { take: 1 })
  const region = regions.find((entry: any) => entry.currency_code?.toLowerCase() === (alias?.currency_code ?? requestedCurrency ?? entry.currency_code?.toLowerCase()))

  if (!region) {
    throw new RegionalContextError(400, `Unknown marketplace region: ${requestedId}`)
  }
  if (requestedCurrency && requestedCurrency !== region.currency_code?.toLowerCase()) {
    throw new RegionalContextError(400, "currency_code must match the selected region")
  }

  return {
    id: region.id as string,
    currency_code: String(region.currency_code).toLowerCase(),
    locale: alias?.locale ?? (region.currency_code?.toLowerCase() === "inr" ? "en-IN" : "en-EU"),
  }
}
