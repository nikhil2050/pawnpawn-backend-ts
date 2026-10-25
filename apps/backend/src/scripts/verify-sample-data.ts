import { ExecArgs } from "@medusajs/framework/types"

/**
 * Verifies the custom seller and lineage modules against the seeded sample data.
 * Run from apps/backend:
 *   ../../node_modules/.bin/medusa exec ./src/scripts/verify-sample-data.ts
 */
export default async function verifySampleData({ container }: ExecArgs) {
  const seller = container.resolve<any>("seller")
  const lineage = container.resolve<any>("lineage")

  // Read seeded data through the generated service methods
  const all = await seller.listSellers({})
  const trusted = await seller.findTrustedSellers()
  const musicians = await seller.findSellersByCategory("musician")
  const snoop = await seller.findByHandle("snoopdogg")

  console.log(
    `[seller] total=${all.length} trusted=${trusted.length} musicians=${musicians.length}`
  )
  console.log(`[seller] handles=${all.map((s: any) => s.handle).join(", ")}`)
  console.log(`[seller] findByHandle(snoopdogg)=${snoop?.store_name}`)

  // Exercise create -> update -> find -> delete
  const handle = `temp_verify_${Date.now()}`
  const created = await seller.createSellers({
    handle,
    store_name: "Temp Verification Store",
    razorpay_account_id: `ra_${handle}`,
    seller_trust: "trusted",
    seller_category: "other",
    verification_status: "PENDING",
  })
  const updated = await seller.updateTrustStatus(created.id, "untrusted")
  const found = await seller.findByHandle(handle)
  console.log(
    `[seller] create/update ok: id=${created.id} trust=${updated.seller_trust} found=${!!found}`
  )
  await seller.deleteSellers(created.id)

  // Lineage history + current owner
  const history = await lineage.getLineageHistory("prod_snoop_001")
  const owner = await lineage.getCurrentOwner("prod_snoop_001")
  console.log(
    `[lineage] prod_snoop_001 history=${history.length} currentOwner=${owner}`
  )

  // Exercise recordTransfer -> read -> delete
  const transfer = await lineage.recordTransfer({
    product_id: "prod_snoop_001",
    seller_id: snoop?.id ?? null,
    buyer_id: "cust_verify_temp",
    price: 1,
  })
  const verifyHistory = await lineage.getLineageHistory("prod_snoop_001")
  console.log(
    `[lineage] recordTransfer ok: id=${transfer.id} historyNow=${verifyHistory.length}`
  )
  await lineage.deleteProductLineages(transfer.id)
}
