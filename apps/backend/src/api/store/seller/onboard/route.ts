import { randomUUID } from "node:crypto"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) return res.status(401).json({ message: "Customer authentication is required" })
  const seller = req.scope.resolve<any>("seller")
  const existing = await seller.listSellers({ customer_id: customerId }, { take: 1 })
  if (existing[0]) return res.status(409).json({ message: "A seller profile already exists" })
  const { handle, store_name, avatar_url } = req.body as Record<string, string>
  if (!handle?.trim() || !store_name?.trim()) return res.status(400).json({ message: "handle and store_name are required" })
  const created = await seller.createSellers({ id: randomUUID(), customer_id: customerId, handle: handle.trim(), store_name: store_name.trim(), avatar_url: avatar_url?.trim() || null, seller_trust: "untrusted", seller_category: "other", verification_status: "PENDING", is_deactivated: false })
  res.status(201).json({ seller: created })
}
