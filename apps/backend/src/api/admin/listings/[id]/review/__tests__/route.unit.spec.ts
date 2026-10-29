import { POST } from "../route"

// Minimal HTTP response double for route-level lifecycle assertions.
// See documentation/AI_CONTEXT.md §8.7 and §11.
const response = () => {
  const res: any = {
    status: jest.fn(),
    json: jest.fn(),
  }
  res.status.mockReturnValue(res)
  return res
}

const request = (action: string, listingStatus = "PENDING_APPROVAL", edits?: Record<string, unknown>) => {
  const listing = {
    id: "listing_test",
    product_id: "product_test",
    listing_status: listingStatus,
  }
  const listingService = {
    retrieveListing: jest.fn().mockResolvedValue(listing),
    reviewListing: jest.fn().mockResolvedValue({ ...listing, listing_status: action === "REJECT" ? "REJECTED" : "AVAILABLE" }),
  }
  const productService = { updateProducts: jest.fn() }
  const scope = {
    resolve: jest.fn((key: string) => key === "listing" ? listingService : productService),
  }
  return {
    req: {
      body: { action, feedback: "review note", edited_data: edits },
      params: { id: "listing_test" },
      auth_context: { actor_id: "user_admin" },
      scope,
    } as any,
    listingService,
    productService,
  }
}

describe("POST /admin/listings/:id/review", () => {
  it("rejects a listing and drafts its native product", async () => {
    const test = request("REJECT")
    const res = response()

    await POST(test.req, res)

    expect(test.productService.updateProducts).toHaveBeenCalledWith("product_test", { status: "draft" })
    expect(test.listingService.reviewListing).toHaveBeenCalledWith(
      "listing_test", "REJECTED", "user_admin", "review note"
    )
  })

  it("applies corrections and publishes an approved listing", async () => {
    const test = request("EDIT_AND_APPROVE", "REJECTED", { title: "Corrected title" })
    const res = response()

    await POST(test.req, res)

    expect(test.productService.updateProducts).toHaveBeenNthCalledWith(1, "product_test", {
      title: "Corrected title",
    })
    expect(test.productService.updateProducts).toHaveBeenNthCalledWith(2, "product_test", {
      status: "published",
    })
    expect(test.listingService.reviewListing).toHaveBeenCalledWith(
      "listing_test", "AVAILABLE", "user_admin", "review note"
    )
  })
})
