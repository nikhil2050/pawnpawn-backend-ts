import { authenticate, configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
    {
      matcher: '/store/seller*',
      methods: ['POST', 'PATCH', 'DELETE', 'GET'],
      middlewares: [authenticate('customer', ['session', 'bearer'])],
    },
  ],
})
