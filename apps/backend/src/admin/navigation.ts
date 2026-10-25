import { defineNavigationConfig } from "@medusajs/admin"
import { BuildingStorefront, Users, Package, Store, Settings } from "@medusajs/icons"

export default defineNavigationConfig({
  main: [
    {
      label: "Sellers",
      icon: BuildingStorefront,
      href: "/sellers",
    },
    {
      label: "Customers",
      icon: Users,
      href: "/customers",
    },
    {
      label: "Products",
      icon: Package,
      href: "/products",
    },
    {
      label: "Orders",
      icon: Store,
      href: "/orders",
    },
    {
      label: "Settings",
      icon: Settings,
      href: "/settings",
    },
  ],
})