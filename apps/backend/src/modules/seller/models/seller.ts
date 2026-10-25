import { model } from "@medusajs/framework/utils"

export const Seller = model.define("seller", {
  id: model.id().primaryKey(),
  customer_id: model.text().nullable(),
  handle: model.text().unique(),
  store_name: model.text(),
  avatar_url: model.text().nullable(),
  razorpay_account_id: model.text().unique().nullable(),
  
  // Trust & Category Fields
  seller_trust: model.enum([
    "trusted", "untrusted"
  ]).default("trusted"),
  
  seller_category: model.enum([
    "celebrity", "influencer", "musician", "athlete", "other"
  ]).default("celebrity"),
  
  social_media_handle: model.text().nullable(),
  
  bio: model.text().nullable(),
  
  verification_status: model.enum(["PENDING", "VERIFIED"]).default("PENDING"),
})
