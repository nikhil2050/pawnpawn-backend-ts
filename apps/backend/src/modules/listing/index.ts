import { Module } from "@medusajs/framework/utils"
import { ListingModuleService } from "./service"
export default Module("listing", { service: ListingModuleService })
export { ListingModuleService } from "./service"
