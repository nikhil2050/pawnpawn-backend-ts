import { Module } from "@medusajs/framework/utils"
import { LineageModuleService } from "./service"

export default Module("lineage", {
  service: LineageModuleService,
})

export * from "./models/product-lineage"
export * from "./service"
export { LineageModuleService } from "./service"
