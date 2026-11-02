import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEFAULT_MARKETPLACE_REGION, resolveRegionalContext } from "../regional-context"
import { calculateRegionalVariantPrices } from "../regional-pricing"

describe("regional catalog pricing", () => {
  const regions = [
    { id: "medusa_eu", currency_code: "eur" },
    { id: "medusa_in", currency_code: "inr" },
  ]
  const regionContainer = {
    resolve: (name: string) => name === Modules.REGION ? {
      listRegions: jest.fn(async (filter: any) => regions.filter((region) =>
        !filter.id && !filter.currency_code || region.id === filter.id || region.currency_code === filter.currency_code
      )),
    } : undefined,
  }

  it("defaults public catalog requests to Europe and accepts India aliases", async () => {
    expect(DEFAULT_MARKETPLACE_REGION).toBe("reg_eu")
    await expect(resolveRegionalContext(regionContainer, {})).resolves.toMatchObject({ id: "medusa_eu", currency_code: "eur" })
    await expect(resolveRegionalContext(regionContainer, { region_id: "reg_in", currency_code: "inr" })).resolves.toMatchObject({ id: "medusa_in", currency_code: "inr" })
    await expect(resolveRegionalContext(regionContainer, { region_id: "reg_eu", currency_code: "inr" })).rejects.toThrow("currency_code must match")
  })

  it("only exposes strictly positive prices calculated for the active region", async () => {
    const container = {
      resolve: (name: string) => {
        if (name === ContainerRegistrationKeys.LINK) return {
          getLinkModule: () => ({ list: jest.fn(async () => [
            { variant_id: "variant_eur", price_set_id: "price_set_eur" },
            { variant_id: "variant_zero", price_set_id: "price_set_zero" },
          ]) }),
        }
        if (name === Modules.PRICING) return {
          calculatePrices: jest.fn(async (_: any, options: any) => {
            expect(options.context).toMatchObject({ currency_code: "eur", region_id: "medusa_eu", quantity: 1 })
            return [
              { id: "price_set_eur", calculated_amount: 120000 },
              { id: "price_set_zero", calculated_amount: 0 },
            ]
          }),
        }
      },
    }
    const prices = await calculateRegionalVariantPrices(container, ["variant_eur", "variant_zero"], { id: "medusa_eu", currency_code: "eur" })
    expect(prices.get("variant_eur")).toEqual({ calculated_amount: 120000, currency_code: "eur" })
    expect(prices.has("variant_zero")).toBe(false)
  })
})
