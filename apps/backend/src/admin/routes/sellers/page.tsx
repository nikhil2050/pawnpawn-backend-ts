import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront } from "@medusajs/icons"
import {
  Alert,
  Badge,
  Container,
  Heading,
  Input,
  Select,
  Table,
  Text,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

type SellerCategory =
  | "celebrity"
  | "influencer"
  | "musician"
  | "athlete"
  | "other"

type Seller = {
  id: string
  customer_id: string | null
  handle: string
  store_name: string
  avatar_url: string | null
  razorpay_account_id: string | null
  seller_trust: "trusted" | "untrusted"
  seller_category: SellerCategory
  social_media_handle: string | null
  bio: string | null
  verification_status: "PENDING" | "VERIFIED"
  created_at: string
  updated_at: string
}

type SellerListResponse = {
  sellers: Seller[]
  count: number
  limit: number
  offset: number
}

type TrustFilter = "all" | "trusted" | "untrusted"
type CategoryFilter = "all" | SellerCategory

const categoryColors: Record<
  SellerCategory,
  "purple" | "orange" | "blue" | "green" | "grey"
> = {
  celebrity: "purple",
  influencer: "orange",
  musician: "blue",
  athlete: "green",
  other: "grey",
}

const fetchSellers = async (
  q: string,
  trust: TrustFilter,
  category: CategoryFilter
): Promise<SellerListResponse> => {
  const params = new URLSearchParams({ limit: "100" })

  if (q.trim()) {
    params.set("q", q.trim())
  }
  if (trust !== "all") {
    params.set("trust", trust)
  }
  if (category !== "all") {
    params.set("category", category)
  }

  const response = await fetch(`/admin/seller?${params.toString()}`, {
    credentials: "include",
  })

  if (!response.ok) {
    let message = `Failed to load sellers (${response.status})`
    try {
      const body = await response.json()
      message = body.message || message
    } catch {
      // Keep the status-based message for non-JSON responses.
    }
    throw new Error(message)
  }

  return response.json()
}

const SellersPage = () => {
  const [q, setQ] = useState("")
  const [trust, setTrust] = useState<TrustFilter>("all")
  const [category, setCategory] = useState<CategoryFilter>("all")

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["sellers", q, trust, category],
    queryFn: () => fetchSellers(q, trust, category),
  })

  const sellers = data?.sellers ?? []
  const trustedCount = useMemo(
    () => sellers.filter((seller) => seller.seller_trust === "trusted").length,
    [sellers]
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Heading level="h1">Sellers</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Celebrity, influencer and reseller accounts on the marketplace.
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          <Badge size="small" color="green">
            {trustedCount} trusted
          </Badge>
          <Badge size="small" color="grey">
            {data?.count ?? 0} matching
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-6 py-4">
        <Input
          type="search"
          size="small"
          placeholder="Search store, handle or social..."
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="w-full max-w-sm"
        />

        <Select
          size="small"
          value={trust}
          onValueChange={(value) => setTrust(value as TrustFilter)}
        >
          <Select.Trigger className="w-[170px]">
            <Select.Value placeholder="Trust level" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All trust levels</Select.Item>
            <Select.Item value="trusted">Trusted</Select.Item>
            <Select.Item value="untrusted">Untrusted</Select.Item>
          </Select.Content>
        </Select>

        <Select
          size="small"
          value={category}
          onValueChange={(value) => setCategory(value as CategoryFilter)}
        >
          <Select.Trigger className="w-[170px]">
            <Select.Value placeholder="Category" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All categories</Select.Item>
            <Select.Item value="celebrity">Celebrity</Select.Item>
            <Select.Item value="influencer">Influencer</Select.Item>
            <Select.Item value="musician">Musician</Select.Item>
            <Select.Item value="athlete">Athlete</Select.Item>
            <Select.Item value="other">Other</Select.Item>
          </Select.Content>
        </Select>
      </div>

      {isError ? (
        <div className="px-6 py-4">
          <Alert variant="error" dismissible={false}>
            {(error as Error)?.message ||
              "Unable to load sellers. Please sign in again."}
          </Alert>
        </div>
      ) : isLoading ? (
        <div className="px-6 py-10">
          <Text size="small" className="text-ui-fg-subtle">
            Loading sellers...
          </Text>
        </div>
      ) : sellers.length === 0 ? (
        <div className="px-6 py-10">
          <Text size="small" className="text-ui-fg-subtle">
            No sellers match the current filters.
          </Text>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Store</Table.HeaderCell>
                <Table.HeaderCell>Handle</Table.HeaderCell>
                <Table.HeaderCell>Category</Table.HeaderCell>
                <Table.HeaderCell>Trust</Table.HeaderCell>
                <Table.HeaderCell>Verification</Table.HeaderCell>
                <Table.HeaderCell>Bio</Table.HeaderCell>
                <Table.HeaderCell>Social</Table.HeaderCell>
                <Table.HeaderCell>Customer</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sellers.map((seller) => (
                <Table.Row key={seller.id}>
                  <Table.Cell>
                    <div className="flex items-center gap-x-3">
                      {seller.avatar_url ? (
                        <img
                          src={seller.avatar_url}
                          alt={seller.store_name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
                          <BuildingStorefront className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <Text size="small" leading="compact" weight="plus">
                          {seller.store_name}
                        </Text>
                        <Text
                          size="small"
                          leading="compact"
                          className="text-ui-fg-subtle"
                        >
                          {seller.id}
                        </Text>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small">@{seller.handle}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      size="2xsmall"
                      color={categoryColors[seller.seller_category] ?? "grey"}
                    >
                      {seller.seller_category}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      size="2xsmall"
                      color={
                        seller.seller_trust === "trusted" ? "green" : "orange"
                      }
                    >
                      {seller.seller_trust}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      size="2xsmall"
                      color={
                        seller.verification_status === "VERIFIED"
                          ? "green"
                          : "orange"
                      }
                    >
                      {seller.verification_status.toLowerCase()}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text
                      size="small"
                      className="text-ui-fg-subtle max-w-[220px] truncate"
                      title={seller.bio ?? undefined}
                    >
                      {seller.bio ?? "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {seller.social_media_handle ?? "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {seller.customer_id ? "Linked" : "—"}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}

      {!isError && (
        <div className="flex items-center justify-between px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Showing {sellers.length} of {data?.count ?? 0} sellers
          </Text>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Sellers",
  icon: BuildingStorefront,
})

export default SellersPage
