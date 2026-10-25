import { Module } from "@medusajs/framework/utils"
import { SellerModuleService } from "./service"

export default Module("seller", {
  service: SellerModuleService,
})

export * from "./models/seller"
export * from "./service"
export { SellerModuleService } from "./service"
