import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getCurrentSellerProfile,
  updateCurrentSellerProfile,
} from "../../../../workflows/storefront/seller-profile"

type ProfileUpdate = {
  store_name?: unknown
  bio?: unknown
  avatar_url?: unknown
  social_media_handle?: unknown
}

const customerIdFrom = (req: MedusaRequest) =>
  (req as any).auth_context?.actor_id as string | undefined

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = customerIdFrom(req)
  if (!customerId) return res.status(401).json({ message: "Customer authentication is required" })

  const result = await getCurrentSellerProfile(req.scope, customerId)
  if (!result) return res.status(403).json({ message: "An active seller profile is required" })
  res.json(result)
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const customerId = customerIdFrom(req)
  if (!customerId) return res.status(401).json({ message: "Customer authentication is required" })

  const body = req.body as ProfileUpdate
  const updates: Record<string, string | null> = {}
  for (const field of ["store_name", "bio", "avatar_url", "social_media_handle"] as const) {
    const value = body[field]
    if (value === undefined) continue
    if (value !== null && typeof value !== "string") {
      return res.status(400).json({ message: `${field} must be a string or null` })
    }
    const normalized = typeof value === "string" ? value.trim() : null
    if (field === "store_name" && !normalized) {
      return res.status(400).json({ message: "store_name cannot be empty" })
    }
    updates[field] = normalized
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: "Provide store_name, bio, avatar_url, or social_media_handle" })
  }

  const result = await updateCurrentSellerProfile(req.scope, customerId, updates)
  if (!result) return res.status(403).json({ message: "An active seller profile is required" })
  res.json(result)
}
