import {
  authenticate,
  configureStoreSearch,
  defineMiddlewares,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'

type ProductOptionInput = {
  title?: unknown
  value?: unknown
  values?: unknown
}

// A PawnPawn product represents one physical item. Each option type must have
// exactly one selected value, which produces one variant. See
// documentation/AI_CONTEXT.md §4.2 and §8.4.
const requireSingleValuePerOption = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const body = req.body as { title?: unknown; options?: unknown }
  if (typeof body.title === 'string' && body.title.includes('-')) {
    return res.status(400).json({
      message: 'Product titles cannot contain hyphens. Hyphens are generated only in the handle.',
    })
  }

  const options = body.options
  if (!Array.isArray(options) || options.length === 0) {
    return next()
  }

  const optionTitles = new Set<string>()
  const hasMultipleValues = options.some((rawOption) => {
    const option = rawOption as ProductOptionInput
    const title = typeof option.title === 'string' ? option.title.trim().toLowerCase() : ''
    if (title && optionTitles.has(title)) return true
    if (title) optionTitles.add(title)

    return Array.isArray(option.values) && option.values.length !== 1
  })

  if (hasMultipleValues) {
    return res.status(400).json({
      message: 'Each product option must have exactly one value. PawnPawn products can have only one variant.',
    })
  }

  return next()
}

// Medusa enforces a unique product handle. Allocate the next available suffix
// before the native create handler runs, so duplicate titles remain creatable.
// See documentation/AI_CONTEXT.md §4.2 and §8.4.
const ensureUniqueProductHandle = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const body = req.body as Record<string, unknown>
  const rawHandle = typeof body.handle === 'string' ? body.handle : ''
  const rawTitle = typeof body.title === 'string' ? body.title : ''
  const baseHandle = (rawHandle || rawTitle)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!baseHandle) return next()

  const productService = req.scope.resolve<any>(Modules.PRODUCT)
  let suffix = 1
  let candidate = baseHandle

  while ((await productService.listProducts({ handle: candidate }, { take: 1 })).length > 0) {
    suffix += 1
    candidate = `${baseHandle}-${suffix}`
  }

  body.handle = candidate
  return next()
}

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
    {
      // Use a wildcard because Medusa's Admin router may append a route suffix
      // while resolving the native product create handler.
      matcher: '/admin/products*',
      methods: ['POST'],
      middlewares: [requireSingleValuePerOption, ensureUniqueProductHandle],
    },
    {
      matcher: '/store/seller/products*',
      methods: ['POST'],
      middlewares: [requireSingleValuePerOption, ensureUniqueProductHandle],
    },
    {
      matcher: '/store/seller/listings*',
      methods: ['POST'],
      middlewares: [requireSingleValuePerOption, ensureUniqueProductHandle],
    },
  ],
})
