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
}
