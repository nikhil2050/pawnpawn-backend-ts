import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { processOrderPlaced } from "../order-placed-hq-fulfillment"

// Lightweight module-container double: validates the marketplace side effects
// without requiring a database or a live Medusa server.
// See documentation/AI_CONTEXT.md §8.5 and §11.
const createContainer = (listingStatus: "AVAILABLE" | "SOLD" = "AVAILABLE") => {
  const order = {
    retrieveOrder: jest.fn().mockResolvedValue({
      id: "order_test",
      customer_id: "customer_test",
      items: [{
        id: "line_test",
        product_id: "product_test",
        variant_id: "variant_test",
        unit_price: 85000,
      }],
    }),
  }
  const listing = {
    listListings: jest.fn().mockResolvedValue([{
      id: "listing_test",
      product_id: "product_test",
      seller_id: "seller_test",
      listing_status: listingStatus,
    }]),
    updateListings: jest.fn(),
  }
  const product = { updateProducts: jest.fn() }
  const hq = {
    listHqFulfillments: jest.fn().mockResolvedValue([]),
    createHqFulfillments: jest.fn(),
  }
  const lineage = {
    listProductLineages: jest.fn().mockResolvedValue([]),
    recordTransfer: jest.fn(),
  }
  const query = {
    graph: jest.fn().mockResolvedValue({
      data: [{ variant_id: "variant_test", inventory_item_id: "inventory_test" }],
    }),
  }
  const inventory = {
    listInventoryLevels: jest.fn().mockResolvedValue([{
      id: "level_test",
      inventory_item_id: "inventory_test",
      location_id: "location_test",
      stocked_quantity: 1,
    }]),
    updateInventoryLevels: jest.fn(),
  }

  const services = new Map<any, any>([
    [Modules.ORDER, order],
    [Modules.PRODUCT, product],
    [Modules.INVENTORY, inventory],
    [ContainerRegistrationKeys.QUERY, query],
    ["listing", listing],
    ["hq_fulfillment", hq],
    ["lineage", lineage],
  ])

  return {
    container: { resolve: (key: any) => services.get(key) },
    order,
    listing,
    product,
    hq,
    lineage,
    inventory,
  }
}

describe("processOrderPlaced", () => {
  it("marks a listing sold, drafts its product, locks inventory, and writes HQ and lineage records", async () => {
    const test = createContainer()

    await processOrderPlaced("order_test", test.container)

    expect(test.listing.updateListings).toHaveBeenCalledWith({
      id: "listing_test",
      listing_status: "SOLD",
    })
    expect(test.product.updateProducts).toHaveBeenCalledWith("product_test", { status: "draft" })
    expect(test.inventory.updateInventoryLevels).toHaveBeenCalledWith([expect.objectContaining({
      id: "level_test",
      stocked_quantity: 0,
    })])
    expect(test.hq.createHqFulfillments).toHaveBeenCalledWith(expect.objectContaining({
      order_id: "order_test",
      order_line_item_id: "line_test",
      hq_status: "WAITING_FOR_ARRIVAL",
    }))
    expect(test.lineage.recordTransfer).toHaveBeenCalledWith(expect.objectContaining({
      order_line_item_id: "line_test",
      price: 85000,
    }))
  })

  it("does not duplicate records for an event retry", async () => {
    const test = createContainer("SOLD")
    test.hq.listHqFulfillments.mockResolvedValue([{ id: "hq_existing" }])
    test.lineage.listProductLineages.mockResolvedValue([{ id: "lineage_existing" }])

    await processOrderPlaced("order_test", test.container)

    expect(test.listing.updateListings).not.toHaveBeenCalled()
    expect(test.product.updateProducts).not.toHaveBeenCalled()
    expect(test.hq.createHqFulfillments).not.toHaveBeenCalled()
    expect(test.lineage.recordTransfer).not.toHaveBeenCalled()
  })
})
