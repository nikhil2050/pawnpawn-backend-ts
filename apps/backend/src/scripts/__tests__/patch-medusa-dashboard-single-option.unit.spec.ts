import fs from "node:fs"
import path from "node:path"

// Guard the repeatable Dashboard patch described in documentation/AI_CONTEXT.md
// §8.11: future dependency updates must retain Marketplace table fields.
describe("Admin Products dashboard patch", () => {
  const script = fs.readFileSync(
    path.resolve(__dirname, "../../../scripts/patch-medusa-dashboard-single-option.cjs"),
    "utf8"
  )

  it("requests and renders native Variant price alongside marketplace fields", () => {
    expect(script).toContain('id: "pawnpawn-price"')
    expect(script).toContain("variants.prices")
    expect(script).toContain('header: "Price"')
  })

  it("keeps archival behavior discoverable and distinct from listing lifecycle", () => {
    expect(script).toContain("Archived products information")
    expect(script).toContain("INACTIVE")
    expect(script).toContain("include_archived")
  })

  it("repairs an earlier duplicate dashboard column injection", () => {
    expect(script).toContain("A previous patch revision could leave the outer display call")
    expect(script).toContain("columnHelper(?:2)?")
  })
})
