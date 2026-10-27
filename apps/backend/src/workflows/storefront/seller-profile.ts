/**
 * Storefront seller-profile use case. It joins the authenticated Seller to
 * Listing counts while leaving persistence to the owning Seller module.
 * See documentation/AI_CONTEXT.md §8.9.
 */
export const getCurrentSellerProfile = async (container: any, customerId: string) => {
  const seller = container.resolve("seller") as any
  const listing = container.resolve("listing") as any
  const profile = await seller.findActiveByCustomerId(customerId)
  if (!profile) return null

  const countFor = async (listingStatus?: string) => {
    const [, count] = await listing.listAndCountListings({
      seller_id: profile.id,
      ...(listingStatus ? { listing_status: listingStatus } : {}),
    })
    return count
  }
  const [total, pendingApproval, available, sold, rejected] = await Promise.all([
    countFor(),
    countFor("PENDING_APPROVAL"),
    countFor("AVAILABLE"),
    countFor("SOLD"),
    countFor("REJECTED"),
  ])

  return {
    seller: {
      id: profile.id,
      customer_id: profile.customer_id,
      handle: profile.handle,
      store_name: profile.store_name,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      social_media_handle: profile.social_media_handle,
      seller_trust: profile.seller_trust,
      seller_category: profile.seller_category,
      verification_status: profile.verification_status,
      is_flagged: profile.is_flagged,
      flag_reason: profile.flag_reason,
      stats: {
        total_listings: total,
        pending_approval: pendingApproval,
        available,
        sold,
        rejected,
      },
    },
  }
}

export const updateCurrentSellerProfile = async (
  container: any,
  customerId: string,
  data: {
    store_name?: string
    bio?: string | null
    avatar_url?: string | null
    social_media_handle?: string | null
  }
) => {
  const seller = container.resolve("seller") as any
  const profile = await seller.findActiveByCustomerId(customerId)
  if (!profile) return null

  await seller.updateStoreProfile(profile.id, data)
  return getCurrentSellerProfile(container, customerId)
}
