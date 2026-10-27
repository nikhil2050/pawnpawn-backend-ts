import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getSellerCatalog } from "../../../../workflows/storefront/catalog"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const result = await getSellerCatalog(req.scope, req.params.handle)
  if (!result) return res.status(404).json({ message: "Seller not found" })
  res.json(result)
}
