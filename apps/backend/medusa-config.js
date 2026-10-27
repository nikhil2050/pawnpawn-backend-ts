const dotenv = require('dotenv')
dotenv.config({ path: require('path').resolve(process.cwd(), '.env') })

module.exports = {
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/pawnpawn_db',
    http: {
      storeCors: process.env.STORE_CORS || 'http://localhost:3000,http://localhost:3001',
      adminCors: process.env.ADMIN_CORS || 'http://localhost:9000,http://localhost:5173',
      authCors: process.env.AUTH_CORS || 'http://localhost:3000,http://localhost:3001,http://localhost:9000',
      jwtSecret: process.env.JWT_SECRET || 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET || 'supersecret',
    },
    databaseLogging: process.env.NODE_ENV === 'development',
    workerMode: process.env.MEDUSA_WORKER_MODE || 'shared',
  },
  admin: {
    disable: false,
    path: '/app',
    autoRebuild: true,
    serve: true,
  },
  featureFlags: {
    product_categories_v2: true,
  },
  modules: {
    // Auth module with emailpass provider (needed for admin login)
    auth: {
      resolve: '@medusajs/medusa/auth',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/auth-emailpass',
            id: 'emailpass',
          },
        ],
      },
    },
    // User module
    user: {
      resolve: '@medusajs/medusa/user',
      options: {
        jwt_secret: process.env.JWT_SECRET || 'supersecret',
      },
    },
    // API key module
    api_key: {
      resolve: '@medusajs/medusa/api-key',
    },
    // Store module
    store: {
      resolve: '@medusajs/medusa/store',
    },
    // Core Medusa modules (required by Admin UI)
    stock_location: {
      resolve: '@medusajs/medusa/stock-location',
    },
    inventory: {
      resolve: '@medusajs/medusa/inventory',
    },
    product: {
      resolve: '@medusajs/medusa/product',
    },
    pricing: {
      resolve: '@medusajs/medusa/pricing',
    },
    promotion: {
      resolve: '@medusajs/medusa/promotion',
    },
    customer: {
      resolve: '@medusajs/medusa/customer',
    },
    sales_channel: {
      resolve: '@medusajs/medusa/sales-channel',
    },
    cart: {
      resolve: '@medusajs/medusa/cart',
    },
    region: {
      resolve: '@medusajs/medusa/region',
    },
    tax: {
      resolve: '@medusajs/medusa/tax',
    },
    currency: {
      resolve: '@medusajs/medusa/currency',
    },
    payment: {
      resolve: '@medusajs/medusa/payment',
    },
    order: {
      resolve: '@medusajs/medusa/order',
    },
    settings: {
      resolve: '@medusajs/medusa/settings',
    },
    fulfillment: {
      resolve: '@medusajs/medusa/fulfillment',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/fulfillment-manual',
            id: 'manual',
          },
        ],
      },
    },
    notification: {
      resolve: '@medusajs/medusa/notification',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/notification-local',
            id: 'local',
            options: {
              name: 'Local Notification Provider',
              channels: ['feed'],
            },
          },
        ],
      },
    },
    search: {
      resolve: '@medusajs/medusa/search',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/search-postgres',
            id: 'postgres',
            options: { engine: 'native' },
          },
        ],
      },
    },
    cache: {
      resolve: '@medusajs/medusa/cache-inmemory',
    },
    event_bus: {
      resolve: '@medusajs/medusa/event-bus-local',
    },
    locking: {
      resolve: '@medusajs/medusa/locking',
    },
    file: {
      resolve: '@medusajs/medusa/file',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/file-local',
            id: 'local',
          },
        ],
      },
    },
    // Custom PawnPawn modules. These object keys are the dependency-injection
    // names used by routes, workflows, subscribers, and verification scripts.
    // See documentation/AI_CONTEXT.md §6.1.1.
    seller: {
      resolve: './src/modules/seller',
    },
    lineage: {
      resolve: './src/modules/lineage',
    },
    listing: {
      resolve: './src/modules/listing',
    },
    hq_fulfillment: {
      resolve: './src/modules/hq-fulfillment',
    },
  },
}
