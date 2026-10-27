import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const listings = await req.scope.resolve<any>("listing").listListings({ seller_id: req.params.id })
  const fulfillments = await req.scope.resolve<any>("hq_fulfillment").listHqFulfillments({ seller_id: req.params.id })
  res.json({ listings, fulfillments })
}
