import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Select, Text, Textarea } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"

type MarketplaceListing = {
  id: string
  seller_id: string
  listing_status: "PENDING_APPROVAL" | "AVAILABLE" | "SOLD" | "REJECTED"
  admin_feedback: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  reviewer: { id: string; name: string; email: string | null } | null
  seller: {
    id: string
    store_name: string
    handle: string
    avatar_url: string | null
  } | null
}

type MarketplaceMappingResponse = {
  marketplace_listing: MarketplaceListing | null
  archived: boolean
}

type Seller = {
  id: string
  store_name: string
  handle: string
  is_deactivated: boolean
}

const statusColor: Record<MarketplaceListing["listing_status"], "grey" | "green" | "orange" | "red" | "blue"> = {
  // Medusa UI exposes orange as its yellow attention token.
  PENDING_APPROVAL: "orange",
  AVAILABLE: "green",
  SOLD: "blue",
  REJECTED: "red",
}

const statusLabel: Record<MarketplaceListing["listing_status"], string> = {
  PENDING_APPROVAL: "🟡 PENDING_APPROVAL",
  AVAILABLE: "🟢 AVAILABLE",
  SOLD: "🔵 SOLD",
  REJECTED: "🔴 REJECTED",
}

const fetchJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, { credentials: "include", ...init })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || `Request failed (${response.status})`)
  }
  return response.json()
}

const ProductMarketplaceListing = ({ data }: { data: { id: string } }) => {
  const queryClient = useQueryClient()
  const mappingQuery = useQuery({
    queryKey: ["product-marketplace-listing", data.id],
    queryFn: () => fetchJson<MarketplaceMappingResponse>(
      `/admin/products/${data.id}/marketplace-listing`
    ),
  })
  const sellersQuery = useQuery({
    queryKey: ["active-sellers-for-listing"],
    queryFn: () => fetchJson<{ sellers: Seller[] }>("/admin/seller?limit=100&status=active"),
  })
  const reassign = useMutation({
    mutationFn: (sellerId: string) => fetchJson<{ marketplace_listing: MarketplaceListing }>(
      `/admin/products/${data.id}/marketplace-listing`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seller_id: sellerId }),
      }
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product-marketplace-listing", data.id] })
    },
  })
  const listing = mappingQuery.data?.marketplace_listing
  const archived = mappingQuery.data?.archived ?? false
  const [feedback, setFeedback] = useState("")
  // Review state stays in Listing; native Product edits are saved through the
  // normal product form before EDIT_AND_APPROVE. See AI_CONTEXT.md §8.11.
  const review = useMutation({
    mutationFn: (action: "APPROVE" | "EDIT_AND_APPROVE" | "REJECT" | "RETURN") => fetchJson<{ listing: MarketplaceListing }>(
      `/admin/listings/${listing?.id ?? ""}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, feedback }),
      }
    ),
    onSuccess: async () => {
      setFeedback("")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["product-marketplace-listing", data.id] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ])
    },
  })
  const archive = useMutation({
    mutationFn: (action: "ARCHIVE" | "RESTORE") => fetchJson<{ archived: boolean }>(
      `/admin/products/${data.id}/marketplace-archive`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["product-marketplace-listing", data.id] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ])
    },
  })

  if (mappingQuery.isLoading) {
    return <Container className="p-6"><Text size="small">Loading marketplace mapping…</Text></Container>
  }
  if (mappingQuery.isError) {
    return <Container className="p-6"><Text size="small">Unable to load marketplace mapping.</Text></Container>
  }
  if (!listing) {
    return (
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">Marketplace & Seller Governance</Heading>
        </div>
        <div className="px-6 py-4">
          {archived && <Badge size="2xsmall" color="grey">🔘 INACTIVE</Badge>}
          <Text size="small" className="mt-2 text-ui-fg-subtle">
            No marketplace Listing is linked to this product.
          </Text>
        </div>
        <div className="px-6 py-4">
          <Button
            size="small"
            variant="secondary"
            className="border border-gray-600 bg-gray-700 text-white hover:bg-gray-600"
            disabled={archive.isPending}
            onClick={() => archive.mutate(archived ? "RESTORE" : "ARCHIVE")}
          >
            {archived ? "Restore item" : "Archive item"}
          </Button>
          {archive.isError && <Text size="small" className="mt-2 text-ui-fg-error">{archive.error.message}</Text>}
        </div>
      </Container>
    )
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Marketplace & Seller Governance</Heading>
      </div>
      <div className="flex flex-col gap-y-3 px-6 py-4">
        <div>
          <Text size="small" className="text-ui-fg-subtle">Seller</Text>
          {listing.seller ? (
            <Link className="block text-ui-fg-interactive" to={`/sellers?q=${encodeURIComponent(listing.seller.handle)}`}>
              {listing.seller.store_name} <span className="text-ui-fg-subtle">@{listing.seller.handle}</span>
            </Link>
          ) : <Text size="small">Seller record unavailable</Text>}
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">Latest admin feedback</Text>
          <Text size="small">{listing.admin_feedback || "—"}</Text>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">Listing status</Text>
          <Badge size="2xsmall" color={archived ? "grey" : statusColor[listing.listing_status]}>{archived ? "🔘 INACTIVE" : statusLabel[listing.listing_status]}</Badge>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">Last reviewer</Text>
          <Text size="small">{listing.reviewer?.name || listing.reviewed_by || "—"}</Text>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">Reassign seller</Text>
          <Select
            value={listing.seller_id}
            onValueChange={(sellerId) => reassign.mutate(sellerId)}
            disabled={archived || reassign.isPending || sellersQuery.isLoading}
          >
            <Select.Trigger className="mt-1 w-full"><Select.Value /></Select.Trigger>
            <Select.Content>
              {(sellersQuery.data?.sellers ?? []).map((seller) => (
                <Select.Item key={seller.id} value={seller.id}>
                  {seller.store_name} (@{seller.handle})
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          {reassign.isError && <Text size="small" className="mt-1 text-ui-fg-error">{reassign.error.message}</Text>}
        </div>
      </div>
      <div className="flex gap-x-2 px-6 py-4">
        <Textarea
          className="min-h-16 flex-1"
          placeholder="Review feedback (optional)"
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          disabled={archived || listing.listing_status === "SOLD" || review.isPending}
        />
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-2 px-6 py-4">
        <Button size="small" variant="secondary" 
          className="border border-green-600 bg-green-800 text-white hover:bg-green-700"
          disabled={archived || listing.listing_status === "SOLD" || review.isPending} onClick={() => review.mutate("APPROVE")}>Approve</Button>
        <Button size="small" variant="secondary" 
          className="border border-green-600 bg-green-800 text-white hover:bg-green-700"
          disabled={archived || listing.listing_status === "SOLD" || review.isPending} onClick={() => review.mutate("EDIT_AND_APPROVE")}>Edit & Approve</Button>
        <Button size="small" variant="danger" disabled={archived || listing.listing_status === "SOLD" || review.isPending} onClick={() => review.mutate("REJECT")}>Reject</Button>
        <Button
          size="small"
          variant="secondary"
          className="border border-gray-600 bg-gray-700 text-white hover:bg-gray-600"
          disabled={archive.isPending}
          onClick={() => archive.mutate(archived ? "RESTORE" : "ARCHIVE")}
        >
          {archived ? "Restore Item" : "Archive Item"}
        </Button>
        <Button size="small" variant="secondary" 
          className="border border-yellow-600 bg-yellow-700 text-white hover:bg-yellow-600"
          disabled={archived || listing.listing_status === "SOLD" || review.isPending} onClick={() => review.mutate("RETURN")}>Pending approval</Button>
      </div>
      {review.isError && <Text size="small" className="px-6 pb-4 text-ui-fg-error">{review.error.message}</Text>}
      {archive.isError && <Text size="small" className="px-6 pb-4 text-ui-fg-error">{archive.error.message}</Text>}
    </Container>
  )
}

export const config = defineWidgetConfig({
  id: "pawnpawn.product-marketplace-listing",
  // Main detail zone lets admins place governance at the top via Customize layout.
  zone: "product.details",
})

export default ProductMarketplaceListing
