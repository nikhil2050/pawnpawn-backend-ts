import { Module } from "@medusajs/framework/utils"
import { HqFulfillmentModuleService } from "./service"
export default Module("hq_fulfillment", { service: HqFulfillmentModuleService })
export { HqFulfillmentModuleService } from "./service"
