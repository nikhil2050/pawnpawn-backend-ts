import { MedusaService } from "@medusajs/framework/utils"
import { Seller } from "./models/seller"

export type SellerCategory =
  | "celebrity"
  | "influencer"
  | "musician"
  | "athlete"
  | "other"

export class SellerModuleService extends MedusaService({
  Seller,
}) {
  async findByHandle(handle: string) {
    const [seller] = await this.listSellers({ handle }, { take: 1 })
    return seller ?? null
  }

  async verifySeller(sellerId: string) {
    return this.updateSellers({
      id: sellerId,
      verification_status: "VERIFIED",
    })
  }

  async updateRazorpayAccount(
    sellerId: string,
    razorpayAccountId: string
  ) {
    return this.updateSellers({
      id: sellerId,
      razorpay_account_id: razorpayAccountId,
    })
  }

  // Find all trusted sellers (celebrities/influencers by default)
  async findTrustedSellers() {
    return this.listSellers({
      seller_trust: "trusted",
    })
  }

  // Find sellers by category (celebrity, influencer, musician, athlete, other)
  async findSellersByCategory(category: SellerCategory) {
    return this.listSellers({
      seller_category: category,
    })
  }

  // Update trust status (trusted/untrusted)
  async updateTrustStatus(sellerId: string, trust: "trusted" | "untrusted") {
    return this.updateSellers({
      id: sellerId,
      seller_trust: trust,
    })
  }

  // Update category
  async updateCategory(sellerId: string, category: SellerCategory) {
    return this.updateSellers({
      id: sellerId,
      seller_category: category,
    })
  }

  // Update social media handle
  async updateSocialMedia(sellerId: string, socialMediaHandle: string) {
    return this.updateSellers({
      id: sellerId,
      social_media_handle: socialMediaHandle,
    })
  }

  // Update bio
  async updateBio(sellerId: string, bio: string) {
    return this.updateSellers({
      id: sellerId,
      bio,
    })
  }
}
