import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront } from "@medusajs/icons"
import {
  Alert,
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Textarea,
  Text,
} from "@medusajs/ui"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState, type FormEvent } from "react"

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
  is_deactivated: boolean
}

type SellerListResponse = {
  sellers: Seller[]
  count: number
  limit: number
  offset: number
}

type TrustFilter = "all" | "trusted" | "untrusted"
type CategoryFilter = "all" | SellerCategory
type StatusFilter = "all" | "active" | "inactive"

type SellerForm = {
  handle: string
  store_name: string
  seller_category: SellerCategory
  seller_trust: "trusted" | "untrusted"
  verification_status: "PENDING" | "VERIFIED"
  is_deactivated: boolean
  avatar_url: string
  social_media_handle: string
  bio: string
}

const emptyForm: SellerForm = {
  handle: "",
  store_name: "",
  seller_category: "other",
  seller_trust: "untrusted",
  verification_status: "PENDING",
  is_deactivated: false,
  avatar_url: "",
  social_media_handle: "",
  bio: "",
}

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
  category: CategoryFilter,
  status: StatusFilter
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
  if (status !== "all") {
    params.set("status", status)
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
  const [status, setStatus] = useState<StatusFilter>("all")
  const [formOpen, setFormOpen] = useState(false)
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null)
  const [form, setForm] = useState<SellerForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["sellers", q, trust, category, status],
    queryFn: () => fetchSellers(q, trust, category, status),
  })

  const sellers = data?.sellers ?? []
  const trustedCount = useMemo(
    () => sellers.filter((seller) => seller.seller_trust === "trusted").length,
    [sellers]
  )

  const openCreate = () => {
    setEditingSeller(null)
    setForm(emptyForm)
    setActionError(null)
    setFormOpen(true)
  }

  const openEdit = (seller: Seller) => {
    setEditingSeller(seller)
    setForm({
      handle: seller.handle,
      store_name: seller.store_name,
      seller_category: seller.seller_category,
      seller_trust: seller.seller_trust,
      verification_status: seller.verification_status,
      is_deactivated: seller.is_deactivated,
      avatar_url: seller.avatar_url ?? "",
      social_media_handle: seller.social_media_handle ?? "",
      bio: seller.bio ?? "",
    })
    setActionError(null)
    setFormOpen(true)
  }

  const saveSeller = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setActionError(null)
    try {
      const response = await fetch(
        editingSeller ? `/admin/seller/${editingSeller.id}` : "/admin/seller",
        {
          method: editingSeller ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      )
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || `Unable to save seller (${response.status})`)
      }
      setFormOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["sellers"] })
    } catch (error) {
      setActionError((error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const inactivateSeller = async (seller: Seller) => {
    if (!window.confirm(`Inactivate ${seller.store_name}?`)) return
    const response = await fetch(`/admin/seller/${seller.id}`, {
      method: "DELETE",
      credentials: "include",
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setActionError(body.message || `Unable to inactivate seller (${response.status})`)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ["sellers"] })
  }

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
          <Button size="small" onClick={openCreate}>Add Seller</Button>
        </div>
      </div>

      {actionError && (
        <div className="px-6 py-4">
          <Alert variant="error" dismissible={false}>{actionError}</Alert>
        </div>
      )}

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

        <Select size="small" value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
          <Select.Trigger className="w-[170px]"><Select.Value placeholder="Seller status" /></Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All sellers</Select.Item>
            <Select.Item value="active">Active</Select.Item>
            <Select.Item value="inactive">Inactive</Select.Item>
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
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Bio</Table.HeaderCell>
                <Table.HeaderCell>Social</Table.HeaderCell>
                <Table.HeaderCell>Customer</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
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
                    <Badge size="2xsmall" color={seller.is_deactivated ? "orange" : "green"}>
                      {seller.is_deactivated ? "inactive" : "active"}
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
                  <Table.Cell>
                    <div className="flex gap-x-2">
                      <Button size="small" variant="secondary" onClick={() => openEdit(seller)}>
                        Edit
                      </Button>
                      {seller.is_deactivated ? (
                        <Button size="small" variant="secondary" onClick={async () => {
                          await fetch(`/admin/seller/${seller.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_deactivated: false }) })
                          await queryClient.invalidateQueries({ queryKey: ["sellers"] })
                        }}>Reactivate</Button>
                      ) : (
                        <Button size="small" variant="danger" onClick={() => inactivateSeller(seller)}>Inactivate</Button>
                      )}
                    </div>
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

      <Drawer open={formOpen} onOpenChange={setFormOpen}>
        <Drawer.Content>
          <form onSubmit={saveSeller} className="flex h-full flex-col">
            <Drawer.Header>
              <Drawer.Title>{editingSeller ? "Edit Seller" : "Add Seller"}</Drawer.Title>
              <Drawer.Description>
                Maintain the seller profile shown in the marketplace.
              </Drawer.Description>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-y-4">
              <div>
                <Label htmlFor="seller-store">Store name</Label>
                <Input id="seller-store" required value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="seller-handle">Handle</Label>
                <Input id="seller-handle" required value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.seller_category} onValueChange={(value) => setForm({ ...form, seller_category: value as SellerCategory })}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    {(["celebrity", "influencer", "musician", "athlete", "other"] as SellerCategory[]).map((value) => <Select.Item key={value} value={value}>{value}</Select.Item>)}
                  </Select.Content>
                </Select>
              </div>
              <div>
                <Label>Trust</Label>
                <Select value={form.seller_trust} onValueChange={(value) => setForm({ ...form, seller_trust: value as SellerForm["seller_trust"] })}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content><Select.Item value="trusted">Trusted</Select.Item><Select.Item value="untrusted">Untrusted</Select.Item></Select.Content>
                </Select>
              </div>
              <div>
                <Label>Verification</Label>
                <Select value={form.verification_status} onValueChange={(value) => setForm({ ...form, verification_status: value as SellerForm["verification_status"] })}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content><Select.Item value="PENDING">Pending</Select.Item><Select.Item value="VERIFIED">Verified</Select.Item></Select.Content>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.is_deactivated ? "inactive" : "active"} onValueChange={(value) => setForm({ ...form, is_deactivated: value === "inactive" })}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content><Select.Item value="active">Active</Select.Item><Select.Item value="inactive">Inactive</Select.Item></Select.Content>
                </Select>
              </div>
              <div><Label htmlFor="seller-avatar">Avatar URL</Label><Input id="seller-avatar" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} /></div>
              <div><Label htmlFor="seller-social">Social media handle</Label><Input id="seller-social" value={form.social_media_handle} onChange={(e) => setForm({ ...form, social_media_handle: e.target.value })} /></div>
              <div><Label htmlFor="seller-bio">Bio</Label><Textarea id="seller-bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
            </Drawer.Body>
            <Drawer.Footer>
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={saving}>{editingSeller ? "Update Seller" : "Add Seller"}</Button>
            </Drawer.Footer>
          </form>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Sellers",
  icon: BuildingStorefront,
})

export default SellersPage
