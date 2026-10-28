const fs = require("node:fs")
const path = require("node:path")

// Medusa v2.22's stock product form uses multi-select controls for option
// values. PawnPawn permits one value per option, so retain this patch across
// dependency installs. See documentation/AI_CONTEXT.md §4.2 and §8.4.
const dashboardRoot = path.resolve(__dirname, "../../../node_modules/@medusajs/dashboard")
const files = [
  "dist/product-create-WUZ22WMJ.mjs",
  "dist/app.js",
  "src/routes/products/product-create/components/product-create-details-form/components/product-create-details-variant-section/product-create-details-variant-section.tsx",
]

const update = (file) => {
  let source = fs.readFileSync(file, "utf8")
  const semicolon = file.endsWith(".tsx") ? "" : ";"

  if (!source.includes("const selectedValueIds = [selectedValueId]")) {
    const valueHandler = /(const handleValueChange = \(optionId, valueIds\) => \{\n)(\s*)if \(valueIds\.length === 0\) \{\n\s*return;\n\s*\}/
    const valueHandlerTs = /(const handleValueChange = \(optionId: string, valueIds: string\[\]\) => \{\n)(\s*)if \(valueIds\.length === 0\) \{\n\s*return\n\s*\}/
    const matchedHandler = source.match(valueHandler) || source.match(valueHandlerTs)
    if (!matchedHandler) throw new Error(`Unsupported dashboard bundle: ${file}`)

    const [, header, indent] = matchedHandler
    source = source.replace(matchedHandler[0], `${header}${indent}const selectedValueId = valueIds.at(-1)${semicolon}\n${indent}if (!selectedValueId) {\n${indent}  return${semicolon}\n${indent}}\n${indent}const selectedValueIds = [selectedValueId]${semicolon}`)
    source = source.replace("valueIds.forEach(", "selectedValueIds.forEach(")
    source = source.replace("value_ids: valueIds,", "value_ids: selectedValueIds,")

    const newValueHandler = /(const handleNewOptionValueChange = \(optionTitle, valueNames\) => \{\n)(\s*)const updatedOptions/
    const newValueHandlerTs = /(const handleNewOptionValueChange = \(\n\s*optionTitle: string,\n\s*valueNames: string\[\]\n\s*\) => \{\n)(\s*)const updatedOptions/
    const matchedNewHandler = source.match(newValueHandler) || source.match(newValueHandlerTs)
    if (!matchedNewHandler) throw new Error(`Unsupported dashboard bundle: ${file}`)

    const [, newHeader, newIndent] = matchedNewHandler
    source = source.replace(matchedNewHandler[0], `${newHeader}${newIndent}const selectedValueName = valueNames.at(-1)${semicolon}\n${newIndent}if (!selectedValueName) {\n${newIndent}  return${semicolon}\n${newIndent}}\n${newIndent}const updatedOptions`)
    source = source.replace("values: valueNames", "values: [selectedValueName]")
  }

  // Adding an existing option must not automatically select every stored
  // value. The admin must explicitly select its one value for this listing.
  source = source.replace(
    "newSelectedValues[option.id] = option.values?.map((v) => v.id) || []",
    "newSelectedValues[option.id] = []"
  )
  source = source.replace(
    /newSelectedValues\[option\.id\] = currentOption\.value_ids(?:\.slice\(-1\))*/g,
    "newSelectedValues[option.id] = currentOption.value_ids.slice(-1)"
  )
  // The stock example "Red, Blue, Green" is misleading for Size and other
  // option types. Use the localized neutral Select label instead.
  source = source.replaceAll(
    "products.fields.options.variantionsPlaceholder",
    "actions.select"
  )
  fs.writeFileSync(file, source)
}

for (const relativeFile of files) {
  update(path.join(dashboardRoot, relativeFile))
}

const generalSourceFile = path.join(
  dashboardRoot,
  "src/routes/products/product-create/components/product-create-details-form/components/product-create-details-general-section/product-create-general-section.tsx"
)
let generalSource = fs.readFileSync(generalSourceFile, "utf8")
if (!generalSource.includes('const title = event.target.value.replace(/-/g, "")')) {
  generalSource = generalSource.replace(
    `                      {...field}\n                      placeholder={t("products.fields.title.placeholder")}`,
    `                      {...field}\n                      // Titles cannot contain hyphens; derive the lowercase handle from the sanitized title.\n                      onChange={(event) => {\n                        const title = event.target.value.replace(/-/g, "")\n                        field.onChange(title)\n                        form.setValue(\n                          "handle",\n                          title\n                            .toLowerCase()\n                            .replace(/[^a-z0-9\\s]/g, "")\n                            .trim()\n                            .replace(/\\s+/g, "-"),\n                          { shouldDirty: true }\n                        )\n                      }}\n                      placeholder={t("products.fields.title.placeholder")}`
  )
  fs.writeFileSync(generalSourceFile, generalSource)
}

const formSourceFile = path.join(
  dashboardRoot,
  "src/routes/products/product-create/components/product-create-form/product-create-form.tsx"
)
let formSource = fs.readFileSync(formSourceFile, "utf8")
formSource = formSource.replace(
  "title: data.product.title,",
  "// Show the backend-allocated handle when duplicate handles are suffixed.\n              title: `${data.product.title} (handle: ${data.product.handle})`,"
)
fs.writeFileSync(formSourceFile, formSource)

// Keep the package's prebuilt Dashboard bundles aligned for `medusa start`.
const patchCompiledGeneral = (file) => {
  let source = fs.readFileSync(file, "utf8")
  source = source.replace(
    /(\.\.\.field,\n)(\s*)placeholder: (t(?:5)?)\("products\.fields\.title\.placeholder"\)/,
    (_, fieldSpread, indent, translate) =>
      `${fieldSpread}${indent}onChange: (event) => {\n${indent}  const title = event.target.value.replace(/-/g, "")\n${indent}  field.onChange(title)\n${indent}  form.setValue("handle", title.toLowerCase().replace(/[^a-z0-9\\s]/g, "").trim().replace(/\\s+/g, "-"), { shouldDirty: true })\n${indent}},\n${indent}placeholder: ${translate}("products.fields.title.placeholder")`
  )
  fs.writeFileSync(file, source)
}

patchCompiledGeneral(path.join(dashboardRoot, "dist/product-create-WUZ22WMJ.mjs"))
patchCompiledGeneral(path.join(dashboardRoot, "dist/app.js"))

const patchCompiledSuccessToast = (file) => {
  let source = fs.readFileSync(file, "utf8")
  source = source.replace(
    "title: data.product.title",
    "title: `${data.product.title} (handle: ${data.product.handle})`"
  )
  fs.writeFileSync(file, source)
}

patchCompiledSuccessToast(path.join(dashboardRoot, "dist/product-create-WUZ22WMJ.mjs"))
patchCompiledSuccessToast(path.join(dashboardRoot, "dist/app.js"))

// The Dashboard currently has no supported extension point for adding a
// column to its native Products table. PawnPawn needs the Listing-backed
// Seller mapping in that exact table, so preserve a small, version-checked
// dashboard patch alongside the existing product-form patch. The backend
// supplies `marketplace_listing` from Listing -> Seller; this UI never reads
// product metadata. See documentation/AI_CONTEXT.md §8.11.
const sellerColumnMarker = 'id: "pawnpawn-seller-after-product"'
const legacySellerColumnPattern = /\s*columnHelper(?:2)?\.display\(\{\s*id: "pawnpawn-seller",[\s\S]*?\n\s*\}\),\n(?=\s*columnHelper(?:2)?\.display\(\{\s*id: "actions")/
const sellerColumnSource = `      columnHelper.display({
        id: "pawnpawn-seller-after-product",
        header: "Seller",
        cell: ({ row }) => {
          const seller = (row.original as HttpTypes.AdminProduct & {
            marketplace_listing?: { seller?: { store_name?: string; handle?: string } | null }
          }).marketplace_listing?.seller
          if (!seller) return "—"
          return (
            <Link to={\`/sellers?q=\${encodeURIComponent(seller.handle ?? "")}\`}>
              <div>{seller.store_name ?? "—"}</div>
              <div className="text-ui-fg-subtle text-xs">@{seller.handle ?? "—"}</div>
            </Link>
          )
        },
      }),
`

const sellerColumnMjs = `      columnHelper.display({
        id: "pawnpawn-seller-after-product",
        header: "Seller",
        cell: ({ row }) => {
          const seller = row.original.marketplace_listing?.seller;
          if (!seller) return "—";
          return /* @__PURE__ */ jsx2(Link, { to: \`/sellers?q=\${encodeURIComponent(seller.handle || "")}\`, children: /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx2("div", { children: seller.store_name || "—" }),
            /* @__PURE__ */ jsx2("div", { className: "text-ui-fg-subtle text-xs", children: \`@\${seller.handle || "—"}\` })
          ] }) });
        }
      }),
`

const sellerColumnApp = `          columnHelper2.display({
            id: "pawnpawn-seller-after-product",
            header: "Seller",
            cell: ({ row }) => {
              const seller = row.original.marketplace_listing?.seller;
              if (!seller) return "—";
              return /* @__PURE__ */ (0, import_jsx_runtime66.jsx)(import_react_router_dom26.Link, { to: \`/sellers?q=\${encodeURIComponent(seller.handle || "")}\`, children: /* @__PURE__ */ (0, import_jsx_runtime66.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime66.jsx)("div", { children: seller.store_name || "—" }),
                /* @__PURE__ */ (0, import_jsx_runtime66.jsx)("div", { className: "text-ui-fg-subtle text-xs", children: \`@\${seller.handle || "—"}\` })
              ] }) });
            }
          }),
`

const patchProductListSellerColumn = (file, column) => {
  let source = fs.readFileSync(file, "utf8")
  // Remove the earlier append-before-actions patch, if this dependency tree
  // was already patched by a previous version of this script.
  source = source.replace(legacySellerColumnPattern, "\n")
  if (source.includes(sellerColumnMarker)) return

  // The native Product column is the first base column. Insert Seller after
  // it so Collection remains the third visible column.
  const anchor = file.endsWith("app.js") ? "          ...base,\n" : "      ...base,\n"
  if (!source.includes(anchor)) {
    throw new Error(`Unsupported Dashboard product list bundle: ${file}`)
  }
  const baseIndent = file.endsWith("app.js") ? "          " : "      "
  source = source.replace(anchor, `${baseIndent}base[0],\n${column}${baseIndent}...base.slice(1),\n`)
  fs.writeFileSync(file, source)
}

patchProductListSellerColumn(
  path.join(dashboardRoot, "src/routes/products/product-list/components/product-list-table/product-list-table.tsx"),
  sellerColumnSource
)
patchProductListSellerColumn(
  path.join(dashboardRoot, "dist/product-list-UKJVYCMV.mjs"),
  sellerColumnMjs
)
patchProductListSellerColumn(path.join(dashboardRoot, "dist/app.js"), sellerColumnApp)

// Add the Listing lifecycle alongside the Listing-backed Seller in the native
// Products table. Product stays a Medusa record; this status is read only
// from the custom Listing module. See documentation/AI_CONTEXT.md §8.11.
const listingStatusMarker = 'id: "pawnpawn-listing-status"'
const listingStatusSource = `      columnHelper.display({
        id: "pawnpawn-listing-status",
        header: "Listing Status",
        cell: ({ row }) => {
          const status = (row.original as HttpTypes.AdminProduct & {
            marketplace_listing?: { listing_status?: string } | null
          }).marketplace_listing?.listing_status
          if (!status) return "—"
          const colors: Record<string, string> = {
            // Medusa's orange tag token is the yellow attention badge.
            PENDING_APPROVAL: "bg-ui-tag-orange-bg text-ui-tag-orange-text",
            AVAILABLE: "bg-ui-tag-green-bg text-ui-tag-green-text",
            SOLD: "bg-ui-tag-blue-bg text-ui-tag-blue-text",
            REJECTED: "bg-ui-tag-red-bg text-ui-tag-red-text",
          }
          return <span className={\`rounded-full px-2 py-0.5 text-xs font-medium \${colors[status] ?? "bg-ui-bg-base"}\`}>{status}</span>
        },
      }),
`

const listingStatusMjs = `      columnHelper.display({
        id: "pawnpawn-listing-status",
        header: "Listing Status",
        cell: ({ row }) => {
          const status = row.original.marketplace_listing?.listing_status;
          if (!status) return "—";
          const colors = {
            PENDING_APPROVAL: "bg-ui-tag-orange-bg text-ui-tag-orange-text",
            AVAILABLE: "bg-ui-tag-green-bg text-ui-tag-green-text",
            SOLD: "bg-ui-tag-blue-bg text-ui-tag-blue-text",
            REJECTED: "bg-ui-tag-red-bg text-ui-tag-red-text"
          };
          return /* @__PURE__ */ jsx2("span", { className: \`rounded-full px-2 py-0.5 text-xs font-medium \${colors[status] || "bg-ui-bg-base"}\`, children: status });
        }
      }),
`

const listingStatusApp = `          columnHelper2.display({
            id: "pawnpawn-listing-status",
            header: "Listing Status",
            cell: ({ row }) => {
              const status = row.original.marketplace_listing?.listing_status;
              if (!status) return "—";
              const colors = {
                PENDING_APPROVAL: "bg-ui-tag-orange-bg text-ui-tag-orange-text",
                AVAILABLE: "bg-ui-tag-green-bg text-ui-tag-green-text",
                SOLD: "bg-ui-tag-blue-bg text-ui-tag-blue-text",
                REJECTED: "bg-ui-tag-red-bg text-ui-tag-red-text"
              };
              return /* @__PURE__ */ (0, import_jsx_runtime66.jsx)("span", { className: \`rounded-full px-2 py-0.5 text-xs font-medium \${colors[status] || "bg-ui-bg-base"}\`, children: status });
            }
          }),
`

const patchProductListListingStatus = (file, column) => {
  let source = fs.readFileSync(file, "utf8")
  if (source.includes(listingStatusMarker)) return

  // Seller is inserted after Product by the preceding patch. Keep Collection
  // third, then expose the marketplace-only Listing Status as the fourth.
  const anchor = file.endsWith("app.js") ? "          ...base.slice(1),\n" : "      ...base.slice(1),\n"
  if (!source.includes(anchor)) {
    throw new Error(`Unsupported Dashboard product list status bundle: ${file}`)
  }
  const baseIndent = file.endsWith("app.js") ? "          " : "      "
  source = source.replace(anchor, `${baseIndent}base[1],\n${column}${baseIndent}...base.slice(2),\n`)
  fs.writeFileSync(file, source)
}

patchProductListListingStatus(
  path.join(dashboardRoot, "src/routes/products/product-list/components/product-list-table/product-list-table.tsx"),
  listingStatusSource
)
patchProductListListingStatus(
  path.join(dashboardRoot, "dist/product-list-UKJVYCMV.mjs"),
  listingStatusMjs
)
patchProductListListingStatus(path.join(dashboardRoot, "dist/app.js"), listingStatusApp)

// Preserve listing_status from the Product-screen URL and send it to the
// extended Admin API. The custom filter never changes Medusa core schemas.
const patchProductListQuery = (file) => {
  let source = fs.readFileSync(file, "utf8")
  source = source.replace(
    "const searchParams: HttpTypes.AdminProductListParams = {",
    "const searchParams: HttpTypes.AdminProductListParams & { listing_status?: string; include_archived?: boolean } = {"
  )
  source = source.replace(
    "const searchParams: HttpTypes.AdminProductListParams & { listing_status?: string } = {",
    "const searchParams: HttpTypes.AdminProductListParams & { listing_status?: string; include_archived?: boolean } = {"
  )
  source = source.replace('      "status",\n      "id",', '      "status",\n      "listing_status",\n      "id",')
  source = source.replace('          "status",\n          "id"', '          "status",\n          "listing_status",\n          "id"')
  source = source.replace(/"status",\n(\s*)"id"/, '"status",\n$1"listing_status",\n$1"id"')
  source = source.replace('    status,\n    order,', '    status,\n    listing_status,\n    order,')
  source = source.replace('        status,\n        order,', '        status,\n        listing_status,\n        order,')
  source = source.replace(
    '    q,\n    fields: DEFAULT_FIELDS,',
    '    q,\n    listing_status: listing_status || undefined,\n    fields: DEFAULT_FIELDS,'
  )
  source = source.replace(
    '        q,\n        fields: DEFAULT_FIELDS',
    '        q,\n        listing_status: listing_status || void 0,\n        fields: DEFAULT_FIELDS'
  )
  source = source.replace(
    '    q,\n    fields: DEFAULT_FIELDS',
    '    q,\n    listing_status: listing_status || void 0,\n    fields: DEFAULT_FIELDS'
  )
  fs.writeFileSync(file, source)
}

patchProductListQuery(path.join(dashboardRoot, "src/hooks/table/query/use-product-table-query.tsx"))
patchProductListQuery(path.join(dashboardRoot, "dist/chunk-R65S6ZZV.mjs"))
patchProductListQuery(path.join(dashboardRoot, "dist/app.js"))

// Native Products has no public slot above its data table. Add compact links
// there, backed by the Listing filter in the extended Admin endpoint.
const marketplaceFilterSource = `  const selectedListingStatus = new URLSearchParams(location.search).get("listing_status") ?? ""
  const listingStatusPath = (status: string) => {
    const params = new URLSearchParams(location.search)
    if (status) params.set("listing_status", status)
    else params.delete("listing_status")
    params.delete("offset")
    return \`?\${params.toString()}\`
  }
`

const marketplaceFilterMjs = `  const selectedListingStatus = (new URLSearchParams(location.search)).get("listing_status") || "";
  const listingStatusPath = (status) => {
    const params = new URLSearchParams(location.search);
    if (status) params.set("listing_status", status);
    else params.delete("listing_status");
    params.delete("offset");
    return \`?\${params.toString()}\`;
  };
`

const marketplaceFilterApp = `      const selectedListingStatus = (new URLSearchParams(location.search)).get("listing_status") || "";
      const listingStatusPath = (status) => {
        const params = new URLSearchParams(location.search);
        if (status) params.set("listing_status", status);
        else params.delete("listing_status");
        params.delete("offset");
        return \`?\${params.toString()}\`;
      };
`

const marketplaceFilterTabsSource = `      <div className="border-t border-ui-border-base px-6 py-3">
        <div className="flex flex-wrap gap-2" aria-label="Marketplace listing status filters">
          {[
            ["", "All"],
            ["PENDING_APPROVAL", "Pending Approval"],
            ["AVAILABLE", "Available"],
            ["SOLD", "Sold"],
            ["REJECTED", "Rejected"],
          ].map(([status, label]) => (
            <Link
              key={status}
              to={listingStatusPath(status)}
              className={\`rounded-md px-3 py-1.5 text-sm \${selectedListingStatus === status ? "bg-ui-bg-interactive text-ui-fg-on-color" : "bg-ui-bg-subtle text-ui-fg-base"}\`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
`

const marketplaceFilterTabsMjs = `    /* @__PURE__ */ jsx2("div", { className: "border-t border-ui-border-base px-6 py-3", children: /* @__PURE__ */ jsx2("div", { className: "flex flex-wrap gap-2", "aria-label": "Marketplace listing status filters", children: [["", "All"], ["PENDING_APPROVAL", "Pending Approval"], ["AVAILABLE", "Available"], ["SOLD", "Sold"], ["REJECTED", "Rejected"]].map(([status, label]) => /* @__PURE__ */ jsx2(Link, { to: listingStatusPath(status), className: \`rounded-md px-3 py-1.5 text-sm \${selectedListingStatus === status ? "bg-ui-bg-interactive text-ui-fg-on-color" : "bg-ui-bg-subtle text-ui-fg-base"}\`, children: label }, status)) }) }),
`

const marketplaceFilterTabsApp = `        /* @__PURE__ */ (0, import_jsx_runtime66.jsx)("div", { className: "border-t border-ui-border-base px-6 py-3", children: /* @__PURE__ */ (0, import_jsx_runtime66.jsx)("div", { className: "flex flex-wrap gap-2", "aria-label": "Marketplace listing status filters", children: [["", "All"], ["PENDING_APPROVAL", "Pending Approval"], ["AVAILABLE", "Available"], ["SOLD", "Sold"], ["REJECTED", "Rejected"]].map(([status, label]) => /* @__PURE__ */ (0, import_jsx_runtime66.jsx)(import_react_router_dom26.Link, { to: listingStatusPath(status), className: \`rounded-md px-3 py-1.5 text-sm \${selectedListingStatus === status ? "bg-ui-bg-interactive text-ui-fg-on-color" : "bg-ui-bg-subtle text-ui-fg-base"}\`, children: label }, status)) }) }),
`

const patchProductListMarketplaceFilters = (file, setup, tabs) => {
  let source = fs.readFileSync(file, "utf8")
  if (source.includes("Marketplace listing status filters")) return
  const locationAnchor = file.endsWith("app.js")
    ? "      const location = (0, import_react_router_dom26.useLocation)();\n"
    : file.endsWith(".mjs")
      ? "  const location = useLocation();\n"
      : "  const location = useLocation()\n"
  if (!source.includes(locationAnchor)) {
    throw new Error(`Unsupported Dashboard product list filters bundle: ${file}`)
  }
  source = source.replace(locationAnchor, `${locationAnchor}${setup}`)

  const dataTableAnchor = file.endsWith("app.js")
    ? "        /* @__PURE__ */ (0, import_jsx_runtime66.jsx)(\n          _DataTable,"
    : file.endsWith(".mjs")
      ? "    /* @__PURE__ */ jsx2(\n      _DataTable,"
      : "      <_DataTable"
  if (!source.includes(dataTableAnchor)) {
    throw new Error(`Unsupported Dashboard product list table bundle: ${file}`)
  }
  source = source.replace(dataTableAnchor, `${tabs}${dataTableAnchor}`)
  fs.writeFileSync(file, source)
}

patchProductListMarketplaceFilters(
  path.join(dashboardRoot, "src/routes/products/product-list/components/product-list-table/product-list-table.tsx"),
  marketplaceFilterSource,
  marketplaceFilterTabsSource
)
patchProductListMarketplaceFilters(
  path.join(dashboardRoot, "dist/product-list-UKJVYCMV.mjs"),
  marketplaceFilterMjs,
  marketplaceFilterTabsMjs
)
patchProductListMarketplaceFilters(
  path.join(dashboardRoot, "dist/app.js"),
  marketplaceFilterApp,
  marketplaceFilterTabsApp
)

// Add the one-of-one SKU and inventory fields that matter for marketplace
// moderation. They are native Product Variant fields; Listing remains the
// only source for seller ownership and lifecycle state. See AI_CONTEXT.md §8.11.
const marketplaceSkuColumnSource = `      columnHelper.display({
        id: "pawnpawn-sku",
        header: "SKU",
        cell: ({ row }) => {
          const skuSummary = (row.original as HttpTypes.AdminProduct & {
            marketplace_skus?: { primary_sku?: string | null; additional_count?: number }
          }).marketplace_skus
          const sku = skuSummary?.primary_sku ?? row.original.variants?.[0]?.sku
          if (!sku) return "—"
          return skuSummary?.additional_count
            ? \`\${sku} (+\${skuSummary.additional_count} more)\`
            : sku
        },
      }),
`
const marketplaceInventoryColumnSource = `      columnHelper.display({
        id: "pawnpawn-inventory",
        header: "Inventory",
        cell: ({ row }) => {
          const quantity = row.original.variants?.[0]?.inventory_quantity
          return quantity ?? "—"
        },
      }),
`
const marketplaceSkuColumnMjs = `      columnHelper.display({
        id: "pawnpawn-sku",
        header: "SKU",
        cell: ({ row }) => {
          const skuSummary = row.original.marketplace_skus;
          const sku = skuSummary?.primary_sku || row.original.variants?.[0]?.sku;
          if (!sku) return "—";
          return skuSummary?.additional_count ? \`\${sku} (+\${skuSummary.additional_count} more)\` : sku;
        }
      }),
`
const marketplaceInventoryColumnMjs = `      columnHelper.display({
        id: "pawnpawn-inventory",
        header: "Inventory",
        cell: ({ row }) => {
          const quantity = row.original.variants?.[0]?.inventory_quantity;
          return quantity ?? "—";
        }
      }),
`
const marketplaceSkuColumnApp = `          columnHelper2.display({
            id: "pawnpawn-sku",
            header: "SKU",
            cell: ({ row }) => {
              const skuSummary = row.original.marketplace_skus;
              const sku = skuSummary?.primary_sku || row.original.variants?.[0]?.sku;
              if (!sku) return "—";
              return skuSummary?.additional_count ? \`\${sku} (+\${skuSummary.additional_count} more)\` : sku;
            }
          }),
`
const marketplaceInventoryColumnApp = `          columnHelper2.display({
            id: "pawnpawn-inventory",
            header: "Inventory",
            cell: ({ row }) => {
              const quantity = row.original.variants?.[0]?.inventory_quantity;
              return quantity ?? "—";
            }
          }),
`
const patchProductListMarketplaceColumns = (file, skuColumn, inventoryColumn) => {
  let source = fs.readFileSync(file, "utf8")
  const statusAnchor = file.endsWith("app.js")
    ? '          columnHelper2.display({\n            id: "pawnpawn-listing-status",'
    : '      columnHelper.display({\n        id: "pawnpawn-listing-status",'
  if (!source.includes(statusAnchor)) {
    throw new Error(`Unsupported Dashboard product marketplace columns bundle: ${file}`)
  }

  // Replace the complete PawnPawn SKU/Inventory section before Listing
  // Status. This makes the patch idempotent and repairs dashboard bundles
  // written by older script versions that inserted the columns twice.
  const skuMarker = 'id: "pawnpawn-sku"'
  if (source.includes(skuMarker)) {
    const firstSku = source.indexOf(skuMarker)
    const baseIndex = source.lastIndexOf("base[1],", firstSku)
    const columnStart = source.indexOf("\n", baseIndex) + 1
    const statusStart = source.indexOf(statusAnchor)
    source = `${source.slice(0, columnStart)}${skuColumn}${inventoryColumn}${source.slice(statusStart)}`
  } else {
    source = source.replace(statusAnchor, `${skuColumn}${inventoryColumn}${statusAnchor}`)
  }
  source = source.replace(
    "variants.id,thumbnail",
    "variants.id,variants.sku,variants.inventory_quantity,thumbnail"
  )
  fs.writeFileSync(file, source)
}

patchProductListMarketplaceColumns(
  path.join(dashboardRoot, "src/routes/products/product-list/components/product-list-table/product-list-table.tsx"),
  marketplaceSkuColumnSource,
  marketplaceInventoryColumnSource
)
patchProductListMarketplaceColumns(
  path.join(dashboardRoot, "dist/product-list-UKJVYCMV.mjs"),
  marketplaceSkuColumnMjs,
  marketplaceInventoryColumnMjs
)
patchProductListMarketplaceColumns(
  path.join(dashboardRoot, "dist/app.js"),
  marketplaceSkuColumnApp,
  marketplaceInventoryColumnApp
)

// Archived means Medusa's soft-deleted Product. Keep it separate from the
// Listing lifecycle tabs and request archived records explicitly.
const patchProductListArchivedFilter = (file) => {
  let source = fs.readFileSync(file, "utf8")
  source = source.replace(
    'const selectedListingStatus = new URLSearchParams(location.search).get("listing_status") ?? ""',
    'const productSearchParams = new URLSearchParams(location.search)\n  const selectedListingStatus = productSearchParams.get("include_archived") === "true" ? "ARCHIVED" : productSearchParams.get("listing_status") ?? ""'
  )
  source = source.replace(
    'const selectedListingStatus = (new URLSearchParams(location.search)).get("listing_status") || "";',
    'const productSearchParams = new URLSearchParams(location.search);\n  const selectedListingStatus = productSearchParams.get("include_archived") === "true" ? "ARCHIVED" : productSearchParams.get("listing_status") || "";'
  )
  source = source.replace(
    'const selectedListingStatus = (new URLSearchParams(location.search)).get("listing_status") || "";',
    'const productSearchParams = new URLSearchParams(location.search);\n      const selectedListingStatus = productSearchParams.get("include_archived") === "true" ? "ARCHIVED" : productSearchParams.get("listing_status") || "";'
  )
  source = source.replace(
    '    if (status) params.set("listing_status", status)\n    else params.delete("listing_status")\n    params.delete("offset")',
    '    if (status === "ARCHIVED") {\n      params.set("include_archived", "true")\n      params.delete("listing_status")\n    } else {\n      if (status) params.set("listing_status", status)\n      else params.delete("listing_status")\n      params.delete("include_archived")\n    }\n    params.delete("offset")'
  )
  source = source.replace(
    '    if (status) params.set("listing_status", status);\n    else params.delete("listing_status");\n    params.delete("offset");',
    '    if (status === "ARCHIVED") {\n      params.set("include_archived", "true");\n      params.delete("listing_status");\n    } else {\n      if (status) params.set("listing_status", status);\n      else params.delete("listing_status");\n      params.delete("include_archived");\n    }\n    params.delete("offset");'
  )
  source = source.replace(
    '["REJECTED", "Rejected"],\n          ].map',
    '["REJECTED", "Rejected"],\n            ["ARCHIVED", "Archived"],\n          ].map'
  )
  source = source.replace(
    '[["", "All"], ["PENDING_APPROVAL", "Pending Approval"], ["AVAILABLE", "Available"], ["SOLD", "Sold"], ["REJECTED", "Rejected"]].map',
    '[["", "All"], ["PENDING_APPROVAL", "Pending Approval"], ["AVAILABLE", "Available"], ["SOLD", "Sold"], ["REJECTED", "Rejected"], ["ARCHIVED", "Archived"]].map'
  )
  source = source.replace(/"listing_status",\n(\s*)"id"/, '"listing_status",\n$1"include_archived",\n$1"id"')
  source = source.replace(
    '    listing_status,\n    order,',
    '    listing_status,\n    include_archived,\n    order,'
  )
  source = source.replace(
    '        listing_status,\n        order,',
    '        listing_status,\n        include_archived,\n        order,'
  )
  source = source.replace(
    '    listing_status: listing_status || undefined,\n    fields: DEFAULT_FIELDS,',
    '    listing_status: listing_status || undefined,\n    include_archived: include_archived === "true" || undefined,\n    fields: DEFAULT_FIELDS,'
  )
  source = source.replace(
    '        listing_status: listing_status || void 0,\n        fields: DEFAULT_FIELDS',
    '        listing_status: listing_status || void 0,\n        include_archived: include_archived === "true" || void 0,\n        fields: DEFAULT_FIELDS'
  )
  source = source.replace(
    '    listing_status: listing_status || void 0,\n    fields: DEFAULT_FIELDS',
    '    listing_status: listing_status || void 0,\n    include_archived: include_archived === "true" || void 0,\n    fields: DEFAULT_FIELDS'
  )
  fs.writeFileSync(file, source)
}

patchProductListArchivedFilter(path.join(dashboardRoot, "src/hooks/table/query/use-product-table-query.tsx"))
patchProductListArchivedFilter(path.join(dashboardRoot, "dist/chunk-R65S6ZZV.mjs"))
patchProductListArchivedFilter(path.join(dashboardRoot, "dist/app.js"))
patchProductListArchivedFilter(path.join(dashboardRoot, "src/routes/products/product-list/components/product-list-table/product-list-table.tsx"))
patchProductListArchivedFilter(path.join(dashboardRoot, "dist/product-list-UKJVYCMV.mjs"))

// Include Medusa's soft-delete timestamp and render it as INACTIVE regardless
// of the historical Listing state retained for lineage and audit records.
const patchProductListInactiveStatus = (file) => {
  let source = fs.readFileSync(file, "utf8")
  source = source.replace(
    "id,title,handle,status,*collection",
    "id,title,handle,status,deleted_at,*collection"
  )
  // Clear prior generated forms so rerunning this version remains idempotent.
  source = source.replace(/^\s*if \(row\.original\.deleted_at\) return .*\n/gm, "")
  if (file.endsWith("app.js")) {
    source = source.replace(
      '              if (!status) return "—";',
      '              if (row.original.deleted_at) return /* @__PURE__ */ (0, import_jsx_runtime66.jsx)("span", { className: "rounded-full bg-ui-tag-neutral-bg px-2 py-0.5 text-xs font-medium text-ui-tag-neutral-text", children: "INACTIVE" });\n              if (!status) return "—";'
    )
  } else if (file.endsWith(".mjs")) {
    source = source.replace(
      '          if (!status) return "—";',
      '          if (row.original.deleted_at) return /* @__PURE__ */ jsx2("span", { className: "rounded-full bg-ui-tag-neutral-bg px-2 py-0.5 text-xs font-medium text-ui-tag-neutral-text", children: "INACTIVE" });\n          if (!status) return "—";'
    )
  } else {
    source = source.replace(
      '          if (!status) return "—"',
      '          if (row.original.deleted_at) return <span className="rounded-full bg-ui-tag-neutral-bg px-2 py-0.5 text-xs font-medium text-ui-tag-neutral-text">INACTIVE</span>\n          if (!status) return "—"'
    )
  }
  fs.writeFileSync(file, source)
}

patchProductListInactiveStatus(path.join(dashboardRoot, "src/routes/products/product-list/components/product-list-table/product-list-table.tsx"))
patchProductListInactiveStatus(path.join(dashboardRoot, "dist/product-list-UKJVYCMV.mjs"))
patchProductListInactiveStatus(path.join(dashboardRoot, "dist/app.js"))

// Vite prebundles Dashboard dependencies under the backend's node_modules.
// Remove that disposable cache before starting so `entry.jsx` is rebuilt from
// the patched Dashboard files instead of serving the former select-all code.
const viteCache = path.resolve(__dirname, "../node_modules/.vite")
if (fs.existsSync(viteCache)) {
  fs.rmSync(viteCache, { recursive: true, force: true })
}

// `medusa develop` serves its generated Admin files from `.medusa`, and does
// not rebuild an existing bundle after a dependency patch. Keep the served
// product-create asset aligned with the Dashboard package patch above.
const generatedAssets = path.resolve(
  __dirname,
  "../.medusa/server/public/admin/assets"
)

if (fs.existsSync(generatedAssets)) {
  for (const name of fs.readdirSync(generatedAssets)) {
    if (!/^product-create-[^.]+\.js$/.test(name)) continue

    const file = path.join(generatedAssets, name)
    let source = fs.readFileSync(file, "utf8")

    // Existing Medusa Admin bundles are minified. These replacements make an
    // existing option begin empty, then keep the latest value only.
    source = source.replace(
      /V\?\.value_ids\?C\[f\.id\]=V\.value_ids:C\[f\.id\]=f\.values\?\.map\(y=>y\.id\)\|\|\[\]/g,
      "C[f.id]=V?.value_ids?.slice(-1)||[]"
    )
    source = source.replace(
      /z=\(r,d\)=>\{if\(d\.length===0\|\|!n\.find\(y=>y\.id===r\)\)return;/g,
      "z=(r,d)=>{d=d.slice(-1);if(d.length===0||!n.find(y=>y.id===r))return;"
    )
    source = source.replace(
      /T=\(r,d\)=>\{const u=n\.map/g,
      "T=(r,d)=>{d=d.slice(-1);const u=n.map"
    )
    source = source.replaceAll(
      "products.fields.options.variantionsPlaceholder",
      "actions.select"
    )
    source = source.replaceAll(
      "title:data.product.title",
      "title:`${data.product.title} (handle: ${data.product.handle})`"
    )
    source = source.replaceAll(
      "title: data.product.title",
      "title: `${data.product.title} (handle: ${data.product.handle})`"
    )

    fs.writeFileSync(file, source)

    // Give the patched route asset a new URL. This prevents the browser from
    // reusing a cached product-create module with Medusa's old select-all
    // implementation after the server restarts.
    if (
      name.startsWith("product-create-WUZ22WMJ-") &&
      !name.includes("-pawnpawn-single-option")
    ) {
      const patchedName = name.replace(".js", "-pawnpawn-single-option.js")
      fs.writeFileSync(path.join(generatedAssets, patchedName), source)

      for (const entryName of fs.readdirSync(generatedAssets)) {
        if (!/^index-.*\.js$/.test(entryName)) continue

        const entryFile = path.join(generatedAssets, entryName)
        const entry = fs.readFileSync(entryFile, "utf8")
        const updatedEntry = entry.replaceAll(
          `assets/${name}`,
          `assets/${patchedName}`
        )

        if (updatedEntry !== entry) {
          fs.writeFileSync(entryFile, updatedEntry)
        }
      }
    }
  }

  // Keep the generated Product-list route aligned with the source/bundle
  // status hierarchy after Medusa has emitted hashed Admin assets. See
  // documentation/AI_CONTEXT.md §8.11.
  for (const name of fs.readdirSync(generatedAssets)) {
    if (!/^product-list-.*\.js$/.test(name)) continue
    const file = path.join(generatedAssets, name)
    const source = fs.readFileSync(file, "utf8")
    const updated = source.replaceAll(
      "bg-ui-tag-neutral-bg text-ui-tag-neutral-text",
      "bg-ui-tag-blue-bg text-ui-tag-blue-text"
    )
    if (updated !== source) fs.writeFileSync(file, updated)
  }
}
