# API.md - PawnPawn Backend API Documentation

The celebrity-to-fan lifecycle, seller identity, Listing module boundary, mixed-seller checkout, HQ states, and payout timing are defined in [`AI_CONTEXT.md`](./AI_CONTEXT.md#marketplace-architecture-decision-record).

> **Project**: PawnPawn Backend (Medusa v2)  
> **Location**: `/documentation/API.md`  
> **Authors**: Backend Engineering Team  
> **Last Updated**: Oct 2026  

---

## Table of Contents

1. [Overview](#1-overview)
   - [Current Implementation Status](#current-implementation-status)
2. [Base URLs & Authentication](#2-base-urls--authentication)
3. [Admin Login](#3-admin-login)
4. [OpenAPI 3.0 Specification](#4-openapi-30-specification)
5. [Markdown Endpoint Summary](#5-markdown-endpoint-summary)
   - [Auth APIs](#auth-apis)
   - [Seller APIs](#seller-apis)
   - [Product APIs](#product-apis)
   - [Purchase & Lineage APIs](#purchase--lineage-apis)
   - [Custom Module Admin APIs](#custom-module-admin-apis)
   - [Custom Module Service Methods](#custom-module-service-methods)
6. [Request/Response Examples](#6-requestresponse-examples)
7. [Error Codes](#7-error-codes)
8. [CORS & Cookie Configuration](#8-cors--cookie-configuration)
9. [Medusa Config Notes](#9-medusa-config-notes)
10. [Custom Modules](#10-custom-modules)

---

## 1. Overview

PawnPawn is a peer-to-peer marketplace backend built on **Medusa v2** (Node.js/TypeScript). It serves two frontend applications:

| Frontend | Purpose | Port | CORS Origin |
|----------|---------|------|-------------|
| Buyer App | Browse & buy products | 3000 | `http://localhost:3000` |
| Seller App | List & manage products | 3001 | `http://localhost:3001` |

**API Base URL**: `http://localhost:9000`  
**Auth Method**: JWT Bearer token + HTTP-only session cookie  
**Content-Type**: `application/json`

### 🍵 Java Developer Notes — Understanding This API

If you're coming from Java/Spring Boot, here's how to read this API documentation:

| Java/Spring Concept | This API | Notes |
|---------------------|----------|-------|
| `@RestController` + `@RequestMapping("/api/store")` | `src/api/store/<path>/route.ts` | File-based routing (Medusa convention) |
| `@GetMapping`, `@PostMapping`, etc. | Exported `GET`, `POST` functions in route.ts | HTTP method handlers |
| `@RequestBody` | Request body parsed automatically | JSON body from `curl -d` |
| `@PathVariable` | URL path parameter (`:id`) | e.g., `/store/products/:id` |
| `@RequestParam` | Query string parameter (`?listing_type=...`) | e.g., `?limit=20&offset=0` |
| `ResponseEntity<T>` | HTTP status code + JSON body | 200 OK, 201 Created, 400 Bad Request, etc. |
| `@CrossOrigin` | `storeCors` / `adminCors` in medusa-config.js | CORS configuration |
| `@PreAuthorize` / SecurityContext | JWT Bearer token or `connect.sid` cookie | Authentication via header or cookie |
| `ObjectMapper` / Jackson | `JSON.stringify()` / `JSON.parse()` | JSON serialization |
| `pom.xml` dependencies | `package.json` dependencies | `@medusajs/framework`, `pg`, etc. |

### Current Implementation Status

<!-- Status entries below distinguish implemented routes from documented future
     contracts, including the new seller product onboarding alias. See
     AI_CONTEXT.md §5.4 and §10. -->

This section is authoritative. Anything marked **Planned** is a documented contract only — no route file exists under `src/api/` yet.

| Area | Route / capability | Status |
|------|--------------------|--------|
| Admin auth | `POST /auth/user/emailpass`, `POST /auth/session` | Implemented |
| Customer auth | `POST /auth/customer/emailpass`, `POST /auth/customer/emailpass/register` | Implemented |
| Store catalog | `GET /store/products`, `GET /store/products/:id` | Marketplace filtering implemented; detail remains Medusa core |
| Store customers | `POST /store/customers` | Implemented (Medusa core) |
| Admin core | Regions, products, customers, orders, API keys | Implemented (Medusa core) |
| Product-created marketplace provisioning | `product.created` subscriber | Implemented |
| Seller module | `SellerModuleService` (CRUD + trust/category methods) | Implemented (service only) |
| Lineage module | `LineageModuleService` (`recordTransfer`, `getLineageHistory`, `getCurrentOwner`) | Implemented |
| Listing module | `ListingModuleService` (`reviewListing`) | Implemented (service only) |
| HQ Fulfillment module | `HqFulfillmentModuleService` | Implemented (service only) |
| Seller onboarding | `POST /store/seller/onboard` | Implemented |
| Seller profile | `GET /store/sellers/:handle`, `GET/PATCH /store/seller/me` | Implemented |
| Seller listings | `GET/POST /store/seller/listings`, `POST /store/seller/products`, `PATCH /store/seller/listings/:id` | Implemented |
| Seller listings (core) | `POST/PATCH /store/products`, `GET /store/products?listing_type=` | **Planned** (use `/store/seller/products`) |
| Auctions | `POST /store/products/:id/auction/start`, `POST /store/products/:id/bid` | **Planned** |
| Purchase + lineage REST | `POST /store/purchase`, `GET /store/products/:id/lineage` | Implemented |
| Admin seller CRUD | `GET/POST /admin/seller`, `GET/PATCH/DELETE /admin/seller/:id` | Implemented |
| Admin listings | `GET /admin/listings`, `POST /admin/listings/:id/review` | Implemented |
| Seller admin listings | `GET /admin/seller/:id/listings` | Implemented |
| Admin HQ fulfillments | `POST /admin/hq-fulfillments/:id`, `POST /admin/hq-fulfillments/:id/exception` | Implemented |
| Admin lineage REST | `/admin/lineage*` | **Planned** |

Only these route files exist today:

```text
apps/backend/src/api/admin/custom/route.ts
apps/backend/src/api/admin/hq-fulfillments/[id]/route.ts     # POST /admin/hq-fulfillments/:id
apps/backend/src/api/admin/listings/route.ts               # GET /admin/listings
apps/backend/src/api/admin/listings/[id]/review/route.ts   # POST /admin/listings/:id/review
apps/backend/src/api/admin/seller/route.ts                 # GET/POST /admin/seller
apps/backend/src/api/admin/seller/[id]/route.ts            # GET/PATCH/DELETE /admin/seller/:id
apps/backend/src/api/admin/seller/[id]/listings/route.ts   # GET /admin/seller/:id/listings
apps/backend/src/api/store/custom/route.ts
apps/backend/src/api/store/seller/onboard/route.ts          # POST /store/seller/onboard
apps/backend/src/api/store/seller/me/route.ts               # GET/PATCH /store/seller/me
apps/backend/src/api/store/seller/listings/route.ts         # GET/POST /store/seller/listings
apps/backend/src/api/store/seller/listings/[id]/route.ts    # PATCH /store/seller/listings/:id
apps/backend/src/api/store/sellers/[handle]/route.ts        # GET /store/sellers/:handle
apps/backend/src/api/store/products/route.ts                # GET /store/products (AVAILABLE catalog + filters)
apps/backend/src/api/store/products/[id]/lineage/route.ts   # GET /store/products/:id/lineage
apps/backend/src/api/store/purchase/route.ts                # POST /store/purchase (dummy checkout)
apps/backend/src/api/middlewares.ts
```

The admin sellers page lives at:

```text
apps/backend/src/admin/routes/sellers/page.tsx
```

Most custom-module operations still run through services rather than REST. The seller read routes are the exception:

```ts
const sellerService = container.resolve("seller")   // not "sellerModuleService"
const lineageService = container.resolve("lineage") // not "lineageModuleService"
const listingService = container.resolve("listing")
const hqFulfillmentService = container.resolve("hq_fulfillment")
```

A runnable check lives in `apps/backend/src/scripts/verify-sample-data.ts`:

```bash
cd apps/backend
../../node_modules/.bin/medusa exec ./src/scripts/verify-sample-data.ts
```

---

## 2. Base URLs & Authentication

### Base URLs

| Environment | Base URL |
|-------------|----------|
| Local Development | `http://localhost:9000` |
| Production | `https://api.pawnpawn.com` |

### Authentication

| Header | Value | Description |
|--------|-------|-------------|
| `Authorization` | `Bearer <jwt_token>` | For stateless API calls |
| `Cookie` | `connect.sid=<session_id>` | For browser-based calls (HTTP-only) |
| `x-publishable-api-key` | `<publishable_key>` | For store API (buyer/seller frontends) |

### Actor Types

| Actor | Claim Value | Access Scope |
|-------|-------------|--------------|
| Customer (Buyer) | `customer` | Store API (`/store/*`); also acts as a Seller once onboarded |
| Seller | `customer` (same actor) | Seller-scoped routes under `/store/seller/*` |
| Admin | `admin` | Admin API (`/admin/*`) |

> A seller account is a customer with an associated `seller` row (`seller.customer_id`). Seller-only routes (`/store/seller/*`) require a customer auth actor whose `customer_id` resolves to an active (non-deactivated) seller profile. The `authenticate('customer', ['session', 'bearer'])` middleware is applied to `/store/seller*`.

Publishable keys live in the `api_key` table:

```bash
psql -h localhost -U postgres -d pawnpawn_db -tAc \
  "SELECT token FROM api_key WHERE type='publishable' LIMIT 1;"
```

---

## 3. Admin Login

### Admin Credentials

| Field | Value |
|-------|-------|
| Email | `admin@pawnpawn.com` |
| Password | `supersecret` |

### Login Endpoint

**`POST /auth/user/emailpass`** — Authenticates with email/password and returns a JWT token.

```bash
curl -X POST http://localhost:9000/auth/user/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pawnpawn.com","password":"supersecret"}'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Using the JWT Token

Include the token in the `Authorization` header for authenticated requests:

```bash
TOKEN="<your-jwt-token>"

# Verify authentication
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:9000/auth/user/providers

# Create session
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:9000/auth/session
```

---

## 4. OpenAPI 3.0 Specification

> **Coverage note:** this spec describes the full intended contract. Actually served today: auth paths, core store/admin routes, `GET /store/products/{id}`, the admin seller paths (`GET/POST /admin/seller`, `GET/PATCH/DELETE /admin/seller/{id}`), the admin listing/HQ paths (`GET /admin/listings`, `POST /admin/listings/{id}/review`, `POST /admin/hq-fulfillments/{id}`), the storefront seller paths (`POST /store/seller/onboard`, `GET /store/sellers/{handle}`, `GET/POST /store/seller/listings`, `POST /store/seller/products`, `PATCH /store/seller/listings/{id}`), and the MVP purchase path (`POST /store/purchase`). `POST/PATCH /store/products`, auctions, `/store/products/{id}/lineage`, `/store/seller/me`, and `/admin/lineage*` paths are **Planned** — see [Current Implementation Status](#current-implementation-status).

Product creation normalizes the handle and allocates a unique value server-side. When `abc` already exists, the backend tries `abc-2`, then `abc-3`, and so on before invoking Medusa's native product create handler. The Admin success notification includes the final persisted handle.

```yaml
openapi: 3.0.3
info:
  title: PawnPawn Backend API
  description: |
    Peer-to-peer marketplace backend built on Medusa v2.
    Supports buyer and seller frontends with product listing
    (fixed price & auction), purchase, and ownership lineage tracking.
  version: 1.0.0
  contact:
    name: PawnPawn Engineering
    email: engineering@pawnpawn.com
servers:
  - url: http://localhost:9000
    description: Local Development
  - url: https://api.pawnpawn.com
    description: Production

tags:
  - name: Auth
    description: Authentication (login, session, providers)
  - name: Seller
    description: Seller onboarding, profile management, verification
  - name: Products
    description: Product CRUD, auction bidding, listing type management
  - name: Purchase
    description: Buy products, transfer ownership, lineage queries
  - name: Custom Modules
    description: Custom PawnPawn modules (seller, lineage)

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    cookieAuth:
      type: apiKey
      in: cookie
      name: connect.sid
    apiKeyAuth:
      type: apiKey
      in: header
      name: x-publishable-api-key

  schemas:
    Seller:
      type: object
      properties:
        id:
          type: string
          description: Medusa-generated text ID
        customer_id:
          type: string
          nullable: true
          description: Optional link to the Medusa customer account
        handle:
          type: string
        store_name:
          type: string
        avatar_url:
          type: string
          nullable: true
        razorpay_account_id:
          type: string
          nullable: true
        seller_trust:
          type: string
          enum: [trusted, untrusted]
          default: trusted
        seller_category:
          type: string
          enum: [celebrity, influencer, musician, athlete, other]
          default: celebrity
        social_media_handle:
          type: string
          nullable: true
        bio:
          type: string
          nullable: true
        verification_status:
          type: string
          enum: [PENDING, VERIFIED]
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
        deleted_at:
          type: string
          format: date-time
          nullable: true

    Product:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        description:
          type: string
        listing_type:
          type: string
          enum: [FIXED_PRICE, AUCTION]
          default: FIXED_PRICE
          description: Stored on the custom Listing module; not a native Medusa product column
        price:
          type: number
          format: decimal
          description: Derived from the variant's calculated price (requires `region_id`), not a product column
        seller_id:
          type: string
          description: Read from `product.metadata.seller_id`; there is no product.seller_id column
        created_at:
          type: string
          format: date-time

    ProductLineage:
      type: object
      properties:
        id:
          type: string
          description: Medusa-generated text ID
        product_id:
          type: string
        seller_id:
          type: string
          nullable: true
          description: Null for buyer-to-buyer resale
        buyer_id:
          type: string
        price:
          type: number
          format: decimal
        transacted_at:
          type: string
          format: date-time

    Listing:
      type: object
      properties:
        id:
          type: string
        seller_id:
          type: string
        product_id:
          type: string
        listing_status:
          type: string
          enum: [PENDING_APPROVAL, AVAILABLE, SOLD, REJECTED]
          default: PENDING_APPROVAL
        listing_type:
          type: string
          enum: [FIXED_PRICE, AUCTION]
          default: FIXED_PRICE
        item_condition:
          type: string
          nullable: true
        rejection_feedback:
          type: string
          nullable: true
        reviewed_by:
          type: string
          nullable: true
        reviewed_at:
          type: string
          format: date-time
          nullable: true
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
        deleted_at:
          type: string
          format: date-time
          nullable: true

    HqFulfillment:
      type: object
      properties:
        id:
          type: string
        order_id:
          type: string
        order_line_item_id:
          type: string
        listing_id:
          type: string
        product_id:
          type: string
        seller_id:
          type: string
        buyer_id:
          type: string
          nullable: true
        hq_status:
          type: string
          enum: [WAITING_FOR_ARRIVAL, ARRIVED_AT_HQ, AUTHENTICATED_AND_PACKED, DISPATCHED, DELIVERED]
          default: WAITING_FOR_ARRIVAL
        certificate_url:
          type: string
          nullable: true
        payout_released_at:
          type: string
          format: date-time
          nullable: true
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
        deleted_at:
          type: string
          format: date-time
          nullable: true

    Error:
      type: object
      properties:
        error:
          type: string
        message:
          type: string
        code:
          type: string
        statusCode:
          type: integer

  requestBodies:
    AuthLoginRequest:
      content:
        application/json:
          schema:
            type: object
            required: [email, password]
            properties:
              email:
                type: string
              password:
                type: string
    SellerOnboardRequest:
      content:
        application/json:
          schema:
            type: object
            required: [handle, store_name]
            properties:
              handle:
                type: string
              store_name:
                type: string
              avatar_url:
                type: string
                nullable: true
    ProductCreateRequest:
      content:
        application/json:
          schema:
            type: object
            required: [title, listing_type]
            properties:
              title:
                type: string
              description:
                type: string
              listing_type:
                type: string
                enum: [FIXED_PRICE, AUCTION]
                default: FIXED_PRICE
              price:
                type: number
                format: decimal
    PurchaseRequest:
      content:
        application/json:
          schema:
            type: object
            required: [items]
            properties:
              items:
                type: array
                minItems: 1
                items:
                  type: object
                  required: [variant_id]
                  properties:
                    variant_id:
                      type: string
                    quantity:
                      type: integer
                      enum: [1]
              region_id:
                type: string
              sales_channel_id:
                type: string
              shipping_address:
                type: object
    RecordTransferRequest:
      content:
        application/json:
          schema:
            type: object
            required: [product_id, seller_id, buyer_id, price]
            properties:
              product_id:
                type: string
              seller_id:
                type: string
              buyer_id:
                type: string
              price:
                type: number
                format: decimal
              transacted_at:
                type: string
                format: date-time

  responses:
    Error:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

paths:
  /auth/user/emailpass:
    post:
      tags: [Auth]
      summary: Admin login with email/password
      requestBody:
        $ref: '#/components/requestBodies/AuthLoginRequest'
      responses:
        '200':
          description: Login successful, returns JWT token
          content:
            application/json:
              schema:
                type: object
                properties:
                  token:
                    type: string
        '401':
          $ref: '#/components/responses/Error'

  /auth/session:
    post:
      tags: [Auth]
      summary: Create session from JWT
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Session created
          content:
            application/json:
              schema:
                type: object
                properties:
                  user:
                    type: object

  /auth/user/providers:
    get:
      tags: [Auth]
      summary: List available auth providers
      security:
        - bearerAuth: []
      responses:
        '200':
          description: List of providers
          content:
            application/json:
              schema:
                type: object
                properties:
                  providers:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                        identifier:
                          type: string
                        display_name:
                          type: string
                        flow:
                          type: string

  /store/seller/onboard:
    post:
      tags: [Seller]
      summary: Onboard the authenticated customer as a seller
      security:
        - bearerAuth: []
        - cookieAuth: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [handle, store_name]
              properties:
                handle:
                  type: string
                store_name:
                  type: string
                avatar_url:
                  type: string
                  nullable: true
      responses:
        '200':
          description: Seller created
          content:
            application/json:
              schema:
                type: object
                properties:
                  seller:
                    $ref: '#/components/schemas/Seller'
        '400':
          description: Missing handle or store_name
        '401':
          description: Customer authentication required
        '409':
          description: A seller profile already exists for this customer

  /store/sellers/{handle}:
    get:
      tags: [Seller]
      summary: Public seller profile and available products
      parameters:
        - name: handle
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Seller profile + published products
          content:
            application/json:
              schema:
                type: object
                properties:
                  seller:
                    type: object
                    properties:
                      id:
                        type: string
                      handle:
                        type: string
                      store_name:
                        type: string
                      avatar_url:
                        type: string
                        nullable: true
                      bio:
                        type: string
                        nullable: true
                  products:
                    type: array
                    items:
                      $ref: '#/components/schemas/Product'
        '404':
          description: Seller not found or deactivated

  /store/seller/listings:
    get:
      tags: [Seller]
      summary: List the authenticated seller's listings
      security:
        - bearerAuth: []
        - cookieAuth: []
      responses:
        '200':
          description: Seller listings
          content:
            application/json:
              schema:
                type: object
                properties:
                  listings:
                    type: array
                    items:
                      $ref: '#/components/schemas/Listing'
        '403':
          description: An active seller profile is required

    post:
      tags: [Seller]
      summary: Create a listing (creates a draft product + Listing row)
      security:
        - bearerAuth: []
        - cookieAuth: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [title, price, condition]
              properties:
                title:
                  type: string
                description:
                  type: string
                handle:
                  type: string
                price:
                  type: number
                  format: decimal
                currency_code:
                  type: string
                  default: usd
                condition:
                  type: string
                listing_type:
                  type: string
                  enum: [FIXED_PRICE, AUCTION]
                  default: FIXED_PRICE
                images:
                  type: array
                  items:
                    type: string
      responses:
        '201':
          description: Listing created
          content:
            application/json:
              schema:
                type: object
                properties:
                  listing:
                    $ref: '#/components/schemas/Listing'
                  product:
                    $ref: '#/components/schemas/Product'
        '400':
          description: Missing title, price, or condition
        '403':
          description: An active seller profile is required

  /store/seller/listings/{id}:
    patch:
      tags: [Seller]
      summary: Update the authenticated seller's own listing
      security:
        - bearerAuth: []
        - cookieAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                title:
                  type: string
                description:
                  type: string
                handle:
                  type: string
                condition:
                  type: string
                listing_type:
                  type: string
                  enum: [FIXED_PRICE, AUCTION]
      responses:
        '200':
          description: Updated listing
          content:
            application/json:
              schema:
                type: object
                properties:
                  listing:
                    $ref: '#/components/schemas/Listing'
        '403':
          description: Not the listing owner, or no active seller profile
        '409':
          description: Sold listings cannot be edited

  /store/seller/me:
    get:
      tags: [Seller]
      summary: Get current seller profile
      security:
        - bearerAuth: []
        - cookieAuth: []
      responses:
        '200':
          description: Seller profile
          content:
            application/json:
              schema:
                type: object
                properties:
                  seller:
                    allOf:
                      - $ref: '#/components/schemas/Seller'
                      - type: object
                        properties:
                          stats:
                            type: object

    patch:
      tags: [Seller]
      summary: Update seller profile
      security:
        - bearerAuth: []
        - cookieAuth: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                store_name:
                  type: string
                avatar_url:
                  type: string
                  nullable: true
                bio:
                  type: string
                  nullable: true
                social_media_handle:
                  type: string
                  nullable: true
      responses:
        '200':
          description: Updated seller profile with listing statistics
          content:
            application/json:
              schema:
                type: object
                properties:
                  seller:
                    allOf:
                      - $ref: '#/components/schemas/Seller'
                      - type: object
                        properties:
                          stats:
                            type: object
        '403':
          description: Authenticated customer has no active seller profile

  /store/products/{id}/lineage:
    get:
      tags: [Products]
      summary: Get public ownership provenance for a product
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Chronological transfers. Buyer data is limited to opaque customer IDs.
          content:
            application/json:
              schema:
                type: object
                properties:
                  product_id:
                    type: string
                  lineage:
                    type: array

  /store/products:
    post:
      tags: [Products]
      summary: Create a new product
      security:
        - bearerAuth: []
        - cookieAuth: []
      requestBody:
        $ref: '#/components/requestBodies/ProductCreateRequest'
      responses:
        '201':
          description: Product created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'

    get:
      tags: [Products]
      summary: List products with filters
      parameters:
        - name: category_id
          in: query
          description: Native Medusa category ID; comma-separated values are accepted
          schema:
            type: string
        - name: collection_id
          in: query
          description: Native Medusa collection ID; comma-separated values are accepted
          schema:
            type: string
        - name: options
          in: query
          description: Option filter such as Size:M or Condition:Like New; comma-separated values are accepted
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: List of products
          content:
            application/json:
              schema:
                type: object
                properties:
                  products:
                    type: array
                    items:
                      $ref: '#/components/schemas/Product'
                  count:
                    type: integer

  /store/products/{id}:
    get:
      tags: [Products]
      summary: Get product by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          $ref: '#/components/schemas/Product'
        '404':
          $ref: '#/components/responses/Error'

    patch:
      tags: [Products]
      summary: Update product
      security:
        - bearerAuth: []
        - cookieAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        $ref: '#/components/requestBodies/ProductCreateRequest'
      responses:
        '200':
          $ref: '#/components/schemas/Product'

  /store/products/{id}/auction/start:
    post:
      tags: [Products]
      summary: Start an auction for a product
      security:
        - bearerAuth: []
        - cookieAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Auction started

  /store/products/{id}/bid:
    post:
      tags: [Products]
      summary: Place a bid on an auction product
      security:
        - bearerAuth: []
        - cookieAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [amount]
              properties:
                amount:
                  type: number
                  format: decimal
      responses:
        '200':
          description: Bid placed

  /store/purchase:
    post:
      tags: [Purchase]
      summary: Purchase a fixed-price product
      security:
        - bearerAuth: []
        - cookieAuth: []
      requestBody:
        $ref: '#/components/requestBodies/PurchaseRequest'
      responses:
        '201':
          description: Purchase completed
          content:
            application/json:
              schema:
                type: object
                properties:
                  order:
                    type: object
                  payment:
                    type: object
                    example: { status: CAPTURED, provider: dummy }
                  fulfillment:
                    type: object
                    example: { status: WAITING_FOR_ARRIVAL, per_line_item: true }

  /store/products/{id}/lineage:
    get:
      tags: [Purchase]
      summary: Get ownership lineage for a product
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Lineage history
          content:
            application/json:
              schema:
                type: object
                properties:
                  lineage:
                    type: array
                    items:
                      $ref: '#/components/schemas/ProductLineage'

  /admin/seller:
    get:
      tags: [Seller]
      summary: List marketplace sellers
      description: Returns seller profiles with optional search and filters. Requires an authenticated admin.
      security:
        - bearerAuth: []
        - cookieAuth: []
      parameters:
        - name: q
          in: query
          required: false
          description: Case-insensitive search across handle, store name, and social media handle
          schema:
            type: string
        - name: trust
          in: query
          required: false
          schema:
            type: string
            enum: [trusted, untrusted]
        - name: category
          in: query
          required: false
          schema:
            type: string
            enum: [celebrity, influencer, musician, athlete, other]
        - name: status
          in: query
          required: false
          schema:
            type: string
            enum: [active, inactive]
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 50
        - name: offset
          in: query
          required: false
          schema:
            type: integer
            minimum: 0
            default: 0
      responses:
        '200':
          description: Seller list
          content:
            application/json:
              schema:
                type: object
                properties:
                  sellers:
                    type: array
                    items:
                      $ref: '#/components/schemas/Seller'
                  count:
                    type: integer
                  limit:
                    type: integer
                  offset:
                    type: integer
        '401':
          description: Missing or invalid admin authentication

    post:
      tags: [Seller]
      summary: Create a new seller
      security:
        - bearerAuth: []
        - cookieAuth: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [handle, store_name]
              properties:
                handle:
                  type: string
                store_name:
                  type: string
                avatar_url:
                  type: string
                  nullable: true
                razorpay_account_id:
                  type: string
                  nullable: true
                seller_trust:
                  type: string
                  enum: [trusted, untrusted]
                  default: trusted
                seller_category:
                  type: string
                  enum: [celebrity, influencer, musician, athlete, other]
                  default: celebrity
                social_media_handle:
                  type: string
                  nullable: true
                bio:
                  type: string
                  nullable: true
                verification_status:
                  type: string
                  enum: [PENDING, VERIFIED]
                  default: PENDING
                is_deactivated:
                  type: boolean
                  default: false
      responses:
        '201':
          description: Seller created
          content:
            application/json:
              schema:
                type: object
                properties:
                  seller:
                    $ref: '#/components/schemas/Seller'
        '400':
          description: Missing handle or store_name
        '401':
          description: Missing or invalid admin authentication

  /admin/seller/{id}:
    get:
      tags: [Seller]
      summary: Get a seller by ID
      security:
        - bearerAuth: []
        - cookieAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Seller profile
          content:
            application/json:
              schema:
                type: object
                properties:
                  seller:
                    $ref: '#/components/schemas/Seller'
        '401':
          description: Missing or invalid admin authentication
        '404':
          description: Seller not found

    patch:
      tags: [Seller]
      summary: Update a seller (any field)
      security:
        - bearerAuth: []
        - cookieAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                handle:
                  type: string
                store_name:
                  type: string
                avatar_url:
                  type: string
                  nullable: true
                razorpay_account_id:
                  type: string
                  nullable: true
                seller_trust:
                  type: string
                  enum: [trusted, untrusted]
                seller_category:
                  type: string
                  enum: [celebrity, influencer, musician, athlete, other]
                social_media_handle:
                  type: string
                  nullable: true
                bio:
                  type: string
                  nullable: true
                verification_status:
                  type: string
                  enum: [PENDING, VERIFIED]
                is_deactivated:
                  type: boolean
      responses:
        '200':
          description: Updated seller profile
          content:
            application/json:
              schema:
                type: object
                properties:
                  seller:
                    $ref: '#/components/schemas/Seller'
        '401':
          description: Missing or invalid admin authentication
        '404':
          description: Seller not found

    delete:
      tags: [Seller]
      summary: Deactivate a seller (soft-delete via is_deactivated)
      security:
        - bearerAuth: []
        - cookieAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Seller deactivated
          content:
            application/json:
              schema:
                type: object
                properties:
                  seller:
                    $ref: '#/components/schemas/Seller'
        '401':
          description: Missing or invalid admin authentication
        '404':
          description: Seller not found
```

---

## 5. Markdown Endpoint Summary

**Status legend:** `Implemented` = route exists and has been exercised; `Planned` = documented contract only (no route file yet). See [Current Implementation Status](#current-implementation-status).

### Auth APIs

| Method | Endpoint | Auth | Description | Success Status | Status |
|--------|----------|------|-------------|----------------|--------|
| POST | `/auth/user/emailpass` | No | Admin login (email/password) | `200 OK` + JWT token | Implemented |
| POST | `/auth/session` | Bearer | Create session from JWT | `200 OK` | Implemented |
| GET | `/auth/user/providers` | Bearer | List auth providers | `200 OK` | Implemented |
| POST | `/auth/customer/emailpass` | No | Customer login | `200 OK` + JWT token | Implemented |
| POST | `/auth/customer/emailpass/register` | No | Register customer auth identity | `200 OK` + JWT token | Implemented |

### Seller APIs

| Method | Endpoint | Auth | Description | Success Status | Status |
|--------|----------|------|-------------|----------------|--------|
| POST | `/store/seller/onboard` | Bearer/Cookie (customer) | Onboard the authenticated customer as a seller | `201 Created` | Implemented |
| GET | `/store/sellers/:handle` | No | Public seller profile + available products | `200 OK` | Implemented |
| GET | `/store/seller/listings` | Bearer/Cookie (customer) | List the authenticated seller's listings | `200 OK` | Implemented |
| POST | `/store/seller/listings` / `/store/seller/products` | Bearer/Cookie (customer) | Create a listing (draft product + Listing row) | `201 Created` | Implemented |
| PATCH | `/store/seller/listings/:id` | Bearer/Cookie (customer) | Update the authenticated seller's own listing | `200 OK` | Implemented |
| GET | `/store/seller/me` | Bearer/Cookie (customer) | Current seller profile plus Listing status counts | `200 OK` | Implemented |
| PATCH | `/store/seller/me` | Bearer/Cookie (customer) | Update store name, bio, avatar, or social handle | `200 OK` | Implemented |

### Listing APIs

| Method | Endpoint | Auth | Description | Success Status | Status |
|--------|----------|------|-------------|----------------|--------|
| GET | `/admin/listings` | Bearer | List all listings (with seller/product joins) | `200 OK` | Implemented |
| POST | `/admin/listings/:id/review` | Bearer | Approve, edit-and-approve, or reject a listing | `200 OK` | Implemented |
| GET | `/admin/seller/:id/listings` | Bearer | Listings + HQ fulfillments for a seller | `200 OK` | Implemented |

### HQ Fulfillment APIs

| Method | Endpoint | Auth | Description | Success Status | Status |
|--------|----------|------|-------------|----------------|--------|
| POST | `/admin/hq-fulfillments/:id` | Bearer | Advance an HQ fulfillment through its lifecycle | `200 OK` | Implemented |

### Product APIs

| GET | `/store/products` | Publishable key | AVAILABLE listings only; category, collection, and option filters | `200 OK` | Implemented |
| GET | `/store/products/:id/lineage` | Publishable key | Chronological public ownership provenance | `200 OK` | Implemented |

| Method | Endpoint | Auth | Description | Success Status | Status |
|--------|----------|------|-------------|----------------|--------|
| GET | `/store/products` | Publishable key | List only `AVAILABLE` marketplace products in the key's sales channels; filter by category, collection, and options | `200 OK` | Implemented |
| GET | `/store/products/:id` | Publishable key | Get product details | `200 OK` | Implemented (core) |
| POST | `/store/products` | Bearer/Cookie | Create seller listing (FIXED_PRICE or AUCTION) | `201 Created` | Planned |
| PATCH | `/store/products/:id` | Bearer/Cookie | Update seller listing | `200 OK` | Planned |
| POST | `/store/products/:id/auction/start` | Bearer/Cookie | Start auction | `200 OK` | Planned |
| POST | `/store/products/:id/bid` | Bearer/Cookie | Place bid on auction | `200 OK` | Planned |

> `GET /store/products` uses a custom marketplace serializer. It filters by custom Listing status, while category, collection, option values, variants, and pricing remain native Medusa product data.

### Purchase & Lineage APIs

| Method | Endpoint | Auth | Description | Success Status | Status |
|--------|----------|------|-------------|----------------|--------|
| POST | `/store/purchase` | Bearer/Cookie (customer) | Dummy checkout for unique variants; creates per-line HQ and lineage records | `201 Created` | Implemented |
| GET | `/store/products/:id/lineage` | No | Public ownership history (opaque buyer IDs) | `200 OK` | Implemented |

### Custom Module Admin APIs

| Method | Endpoint | Auth | Description | Success Status | Status |
|--------|----------|------|-------------|----------------|--------|
| GET | `/admin/seller` | Bearer | List sellers (search/filter/paginate) | `200 OK` | Implemented |
| GET | `/admin/seller/:id` | Bearer | Get seller by ID | `200 OK` | Implemented |
| POST | `/admin/seller` | Bearer | Create seller | `201 Created` | Implemented |
| PATCH | `/admin/seller/:id` | Bearer | Update any seller field | `200 OK` | Implemented |
| DELETE | `/admin/seller/:id` | Bearer | Deactivate seller (soft-delete) | `200 OK` | Implemented |
| GET | `/admin/listings` | Bearer | List all listings (with seller/product) | `200 OK` | Implemented |
| POST | `/admin/listings/:id/review` | Bearer | Approve, edit-and-approve, or reject a listing | `200 OK` | Implemented |
| GET | `/admin/seller/:id/listings` | Bearer | Listings + HQ fulfillments for a seller | `200 OK` | Implemented |
| POST | `/admin/hq-fulfillments/:id` | Bearer | Advance an HQ fulfillment lifecycle | `200 OK` | Implemented |
| GET | `/admin/lineage` | Bearer | List all lineage entries | `200 OK` | Planned |
| GET | `/admin/lineage/:id` | Bearer | Get lineage by ID | `200 OK` | Planned |
| POST | `/admin/lineage` | Bearer | Record lineage transfer | `201 Created` | Planned |

> **Implemented seller CRUD:** `GET /admin/seller`, `GET /admin/seller/:id`, `POST /admin/seller`, `PATCH /admin/seller/:id`, and `DELETE /admin/seller/:id` (soft-delete via `is_deactivated`) are live. Listing review, per-seller listings, and HQ fulfillment transitions are also live. Lineage REST remains **Planned**; use the module service or SQL until those routes exist.

### Custom Module Service Methods

Resolve the services with the module key (not a `ModuleService` suffix):

```ts
const sellerService = container.resolve("seller")
const lineageService = container.resolve("lineage")
```

**SellerModuleService** (custom methods):

| Method | Description |
|--------|-------------|
| `findByHandle(handle)` | Find seller by public handle |
| `findTrustedSellers()` | List all trusted sellers |
| `findSellersByCategory(category)` | List sellers by category (celebrity, influencer, musician, athlete, other) |
| `verifySeller(sellerId)` | Set verification_status to VERIFIED |
| `updateTrustStatus(sellerId, trust)` | Update trust status (trusted/untrusted) |
| `updateCategory(sellerId, category)` | Update seller category |
| `updateRazorpayAccount(sellerId, accountId)` | Update Razorpay Connect account ID |
| `updateSocialMedia(sellerId, handle)` | Update social media handle |
| `updateBio(sellerId, bio)` | Update seller biography |

**LineageModuleService** (custom methods):

| Method | Description |
|--------|-------------|
| `recordTransfer(data)` | Create a lineage entry (`product_id`, optional `seller_id`, `buyer_id`, `price`, optional `transacted_at`) |
| `getLineageHistory(productId)` | Transfers for a product, ascending |
| `getCurrentOwner(productId)` | Most recent `buyer_id`, or `null` |

**ListingModuleService** (custom methods):

| Method | Description |
|--------|-------------|
| `reviewListing(id, status, userId, feedback?)` | Set a non-sold Listing to `PENDING_APPROVAL`, `AVAILABLE`, or `REJECTED`; record reviewer and timestamp; preserve earlier feedback when no new note is supplied |

**HqFulfillmentModuleService**: no custom methods beyond generated CRUD (`listHqFulfillments`, `retrieveHqFulfillment`, `createHqFulfillments`, `updateHqFulfillments`, `deleteHqFulfillments`).

**Generated CRUD methods** (provided by `MedusaService`, model-suffixed):

| Model | List | Retrieve | Create | Update | Delete |
|-------|------|----------|--------|--------|--------|
| `Seller` | `listSellers` | `retrieveSeller` | `createSellers` | `updateSellers` | `deleteSellers` |
| `ProductLineage` | `listProductLineages` | `retrieveProductLineage` | `createProductLineages` | `updateProductLineages` | `deleteProductLineages` |
| `Listing` | `listListings` | `retrieveListing` | `createListings` | `updateListings` | `deleteListings` |
| `HqFulfillment` | `listHqFulfillments` | `retrieveHqFulfillment` | `createHqFulfillments` | `updateHqFulfillments` | `deleteHqFulfillments` |

> There is no generic `this.list()` / `this.update()` in a `MedusaService` subclass. Calling them throws `this.list is not a function`. `updateSellers` takes `{ id, ...fields }` or `{ selector, data }`.

---

## 6. Request/Response Examples

### 6.1 Admin Login

**Request:**
```http
POST /auth/user/emailpass
Content-Type: application/json

{
  "email": "admin@pawnpawn.com",
  "password": "supersecret"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 6.2 Seller Onboard

> **Status: IMPLEMENTED** — `POST /store/seller/onboard` requires an authenticated customer (Bearer/session). It creates a `seller` row linked to that customer with `seller_trust: "untrusted"`, `seller_category: "other"`, `verification_status: "PENDING"`, and returns 409 if a profile already exists.

**Request:**
```http
POST /store/seller/onboard
Authorization: Bearer <customer_token>
Content-Type: application/json

{
  "handle": "rajesh_jewelers",
  "store_name": "Rajesh Jewelers",
  "avatar_url": "https://cdn.pawnpawn.com/avatars/rajesh.jpg"
}
```

**Response (201):**
```json
{
  "seller": {
    "id": "01M5SVK...",
    "customer_id": "cus_01M5...",
    "handle": "rajesh_jewelers",
    "store_name": "Rajesh Jewelers",
    "avatar_url": "https://cdn.pawnpawn.com/avatars/rajesh.jpg",
    "razorpay_account_id": null,
    "seller_trust": "untrusted",
    "seller_category": "other",
    "social_media_handle": null,
    "bio": null,
    "verification_status": "PENDING",
    "is_deactivated": false,
    "created_at": "2026-10-26T10:30:00.000Z",
    "updated_at": "2026-10-26T10:30:00.000Z",
    "deleted_at": null
  }
}
```

### 6.3 Create a Listing (Implemented)

> **Status: IMPLEMENTED** — sellers create listings through `POST /store/seller/products` (the existing `/store/seller/listings` route is an alias). The route resolves the Seller from the authenticated customer session and uses Medusa's `createProductsWorkflow` with native category/collection/options. The `product.created` subscriber then standardizes every product created through the Seller API or native Admin UI: it assigns a canonical SKU, enables one-unit inventory, and creates an idempotent `PENDING_APPROVAL` Listing. Admin-created products without seller metadata use the `system` Seller and `CELEB-SYSTEM-GEN-[SHORT_UUID]`. Direct `POST /store/products` is **Planned**.

Product creation accepts one value per option type. In Admin, adding Size, Colour, Authenticity, or another existing option starts with no selected value; any retained legacy selection is reduced to its latest value. Choose one value, and choosing another replaces the prior choice. Its value control shows the neutral localized `Select` placeholder. The local Admin bundle receives the same patch before development and production starts, with a new route-asset URL and a cleared Vite dependency cache to prevent reuse of an earlier cached bundle. Repeating an option title or supplying multiple values is rejected, so a product creates exactly one variant.

The Admin Title field removes hyphens as they are entered and derives a lowercase Handle using hyphens between words. Direct Admin and Seller product requests containing a hyphen in `title` return `400`.

**Request:**
```http
POST /store/seller/listings
Authorization: Bearer <seller_token>
Content-Type: application/json

{
  "title": "Vintage Gold Watch",
  "description": "1980s Rolex Submariner, excellent condition",
  "price": 2500.00,
  "condition": "excellent",
  "listing_type": "FIXED_PRICE",
  "currency_code": "usd",
  "images": ["https://cdn.pawnpawn.com/listings/vintage-watch.jpg"]
}
```

**Response (201):**
```json
{
  "listing": {
    "id": "listing_01M...",
    "seller_id": "01M5SVK...",
    "product_id": "prod_01M...",
    "listing_status": "PENDING_APPROVAL",
    "listing_type": "FIXED_PRICE",
    "item_condition": "excellent",
    "rejection_feedback": null,
    "reviewed_by": null,
    "reviewed_at": null,
    "created_at": "2026-10-26T11:00:00.000Z",
    "updated_at": "2026-10-26T11:00:00.000Z"
  },
  "product": {
    "id": "prod_01M...",
    "title": "Vintage Gold Watch",
    "status": "draft"
  }
}
```

### 6.4 Purchase Product

> **Status: IMPLEMENTED (MVP)** — `/store/purchase` requires an authenticated customer and accepts one or more unique variants. The server calculates each price from the Medusa price set in the requested region; clients cannot set a line price. It locks all requested Listings, revalidates `AVAILABLE` status and stock, creates a Medusa order through `createOrderWorkflow`, performs a successful dummy capture, and invokes the shared idempotent post-order handler. That handler marks each Listing `SOLD`, drafts its product, locks inventory at zero, creates one `hq_fulfillment` row per order line in `WAITING_FOR_ARRIVAL`, and records lineage keyed by the order-line ID. A real payment provider, durable reservation transaction, and public lineage route remain follow-up work.

**Request:**
```http
POST /store/purchase
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "items": [
    { "variant_id": "variant_01JABCDEF123", "quantity": 1 }
  ],
  "region_id": "reg_01M5SSC7P6CPJDG955B1564RQT",
  "sales_channel_id": "sc_01M5J0TH4TCBFJ4NJD3T1TEZZ2",
  "shipping_address": {
    "first_name": "Sarah",
    "last_name": "Johnson",
    "address_1": "100 Market Street",
    "city": "Los Angeles",
    "country_code": "us",
    "postal_code": "90001"
  }
}
```

**Response (201):**
```json
{
  "order": {
    "id": "order_01JABCDEF789",
    "status": "pending",
    "customer_id": "cust_01JXYZ789"
  },
  "payment": { "status": "CAPTURED", "provider": "dummy" },
  "fulfillment": { "status": "WAITING_FOR_ARRIVAL", "per_line_item": true }
}
```

### 6.5 Browse Seeded Products (Working Today)

> **Status: IMPLEMENTED** — Medusa core route. Requires the publishable key from the `api_key` table.

```bash
PK=$(psql -h localhost -U postgres -d pawnpawn_db -tAc \
  "SELECT token FROM api_key WHERE type='publishable' LIMIT 1;")
US=$(psql -h localhost -U postgres -d pawnpawn_db -tAc \
  "SELECT id FROM region WHERE name='United States';")

curl -s -H "x-publishable-api-key: $PK" \
  "http://localhost:9000/store/products?limit=100&region_id=$US&fields=id,title,metadata,*variants,*variants.calculated_price"
```

Returns the 17 seeded listings. `metadata` contains `seller_id`, `seller_handle`, `seller_name`, `event`, `condition`, and `provenance`.

Buyer login (implemented):

```bash
curl -s -X POST http://localhost:9000/auth/customer/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.johnson@gmail.com","password":"buyer1234"}'
```

### 6.6 List Sellers in the Admin API (Working Today)

> **Status: IMPLEMENTED** — `GET /admin/seller`, `GET /admin/seller/:id`, `POST /admin/seller`, `PATCH /admin/seller/:id`, and `DELETE /admin/seller/:id` read and mutate the custom seller module. The Medusa Admin UI page is at `http://localhost:9000/app/sellers`.

Get an admin JWT, then call the endpoint:

```bash
TOKEN=$(curl -s -X POST http://localhost:9000/auth/user/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pawnpawn.com","password":"supersecret"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9000/admin/seller?limit=50"
```

Optional query parameters:

| Parameter | Values | Description |
|-----------|--------|-------------|
| `q` | text | Case-insensitive match on `handle`, `store_name`, or `social_media_handle` |
| `trust` | `trusted` \| `untrusted` | Filter by trust level |
| `category` | `celebrity` \| `influencer` \| `musician` \| `athlete` \| `other` | Filter by category |
| `limit` | 1-100 (default 50) | Page size |
| `offset` | integer (default 0) | Page offset |

**Response (200):**
```json
{
  "sellers": [
    {
      "id": "77830a3e-468f-4b01-b39a-e92699ab8f97",
      "customer_id": null,
      "handle": "snoopdogg",
      "store_name": "Snoop Dogg Shop",
      "avatar_url": "https://picsum.photos/seed/snoopdogg/400/400",
      "razorpay_account_id": "ra_connect_snoop_001",
      "seller_trust": "trusted",
      "seller_category": "musician",
      "social_media_handle": "@snoopdogg",
      "bio": "Legendary rapper and entrepreneur. Selling items from music videos, studio sessions and world tours.",
      "verification_status": "VERIFIED",
      "created_at": "2026-10-25T14:30:11.858Z",
      "updated_at": "2026-10-25T15:42:51.916Z",
      "deleted_at": null
    }
  ],
  "count": 7,
  "limit": 50,
  "offset": 0
}
```

Single seller:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9000/admin/seller/<seller_id>"
# → { "seller": { ... } }
```

The endpoint requires admin authentication (401 without a token). Use `q=snoop`, `trust=untrusted`, and `category=musician` to exercise the filters.

The Admin UI page uses the same API and shows store, handle, category, trust, verification, bio, social handle, and whether a customer account is linked.

### 6.7 Create, Update, and Deactivate Sellers (Working Today)

> **Status: IMPLEMENTED** — `POST /admin/seller`, `PATCH /admin/seller/:id`, and `DELETE /admin/seller/:id` (soft-delete via `is_deactivated`).

**Create a seller:**

```http
POST /admin/seller
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "handle": "rajesh_jewelers",
  "store_name": "Rajesh Jewelers",
  "avatar_url": "https://cdn.pawnpawn.com/avatars/rajesh.jpg",
  "razorpay_account_id": "ra_connect_rajesh_001",
  "seller_trust": "untrusted",
  "seller_category": "other",
  "social_media_handle": "@rajeshjewelers",
  "bio": "Family jeweler reselling authenticated pieces."
}
```

**Response (201):**
```json
{
  "seller": {
    "id": "01M5SVK...",
    "customer_id": null,
    "handle": "rajesh_jewelers",
    "store_name": "Rajesh Jewelers",
    "avatar_url": "https://cdn.pawnpawn.com/avatars/rajesh.jpg",
    "razorpay_account_id": "ra_connect_rajesh_001",
    "seller_trust": "untrusted",
    "seller_category": "other",
    "social_media_handle": "@rajeshjewelers",
    "bio": "Family jeweler reselling authenticated pieces.",
    "verification_status": "PENDING",
    "is_deactivated": false,
    "created_at": "2026-10-25T14:30:11.858Z",
    "updated_at": "2026-10-25T14:30:11.858Z",
    "deleted_at": null
  }
}
```

**Update any seller field** (`PATCH /admin/seller/:id` accepts `handle`, `store_name`, `avatar_url`, `razorpay_account_id`, `seller_trust`, `seller_category`, `social_media_handle`, `bio`, `verification_status`, `is_deactivated`):

```http
PATCH /admin/seller/01M5SVK...
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "seller_trust": "trusted",
  "seller_category": "musician",
  "verification_status": "VERIFIED"
}
```

**Deactivate a seller** (`DELETE /admin/seller/:id` sets `is_deactivated = true` and returns the updated seller):

```http
DELETE /admin/seller/01M5SVK...
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
{
  "seller": {
    "id": "01M5SVK...",
    "is_deactivated": true,
    ...
  }
}
```

### 6.8 Review a Listing (Working Today)

> **Status: IMPLEMENTED** — `POST /admin/listings/:id/review` re-reviews any non-sold Listing. `APPROVE` and `EDIT_AND_APPROVE` publish the product and set the Listing to `AVAILABLE`; `REJECT` sets it to `REJECTED` and drafts the product. Legacy `RETURN` resets it to `PENDING_APPROVAL` and drafts the product. Each action records the reviewer, timestamp, and supplied feedback. A dedicated Admin UI review screen is still pending.

```http
POST /admin/listings/listing_01M.../review
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "action": "APPROVE"
}
```

```http
POST /admin/listings/listing_01M.../review
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "action": "RETURN",
  "feedback": "Please provide a clearer certificate image"
}
```

`RETURN` is retained for backwards compatibility and sets the Listing to
`PENDING_APPROVAL`; it is useful when an available or rejected Listing needs
another seller revision. `SOLD` Listings return `409 Conflict` and cannot be
re-reviewed.

```http
POST /admin/listings/listing_01M.../review
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "action": "EDIT_AND_APPROVE",
  "edited_data": { "title": "Authenticated vintage jacket" },
  "feedback": "Title corrected during review"
}
```

```http
POST /admin/listings/listing_01M.../review
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "action": "REJECT",
  "feedback": "Missing certificate of authenticity"
}
```

**Response (200):**
```json
{
  "listing": {
    "id": "listing_01M...",
    "listing_status": "AVAILABLE",
    "reviewed_by": "01M5ADMIN...",
    "reviewed_at": "2026-10-26T12:00:00.000Z",
    "rejection_feedback": null,
    "admin_feedback": "Title corrected during review"
  }
}
```

### 6.9 Advance an HQ Fulfillment (Working Today)

> **Status: IMPLEMENTED** — `POST /admin/hq-fulfillments/:id` advances an HQ fulfillment through its lifecycle. Passing `certificate_url` stores the authenticity certificate; reaching `DELIVERED` releases payout.

```http
POST /admin/hq-fulfillments/hq_01M.../review
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "action": "AUTHENTICATE_AND_PACK",
  "certificate_url": "https://cdn.pawnpawn.com/certificates/hq_01M....pdf"
}
```

Valid actions: `MARK_RECEIVED`, `AUTHENTICATE_AND_PACK`, `DISPATCH`, `MARK_DELIVERED`.

**Response (200):**
```json
{
  "fulfillment": {
    "id": "hq_01M...",
    "hq_status": "AUTHENTICATED_AND_PACKED",
    "certificate_url": "https://cdn.pawnpawn.com/certificates/hq_01M....pdf",
    "payout_released_at": null
  }
}
```

### 6.10 HQ Line-Item Exceptions

> **Status: IMPLEMENTED (MVP)** — `POST /admin/hq-fulfillments/:id/exception` operates on one order line only, so ready items in a mixed cart can be dispatched while another seller's item remains delayed.

Split dispatch:

```json
{
  "action": "SPLIT_DISPATCH",
  "target_status": "DISPATCHED",
  "reason": "Item authenticated and packed"
}
```

Cancellation and partial refund:

```json
{
  "action": "CANCEL_AND_REFUND",
  "refund_amount": 35000,
  "reason": "Seller failed to deliver the item"
}
```

Cancellation marks the line `CANCELLED_BY_SELLER`, refunds through Medusa's
Payment module when a captured payment exists (otherwise records the dummy
refund), restores inventory to one, returns the Listing to `AVAILABLE`,
republishes the product, flags the Seller as untrusted, and voids the canceled
line's lineage transfer. Repeated cancellation is idempotent.

**Exception response (200):**
```json
{
  "fulfillment": {
    "id": "hq_01M...",
    "hq_status": "CANCELLED_BY_SELLER",
    "refund_amount": 35000,
    "refund_status": "REFUNDED"
  }
}
```

### 6.11 Public Seller Profile (Working Today)

> **Status: IMPLEMENTED** — `GET /store/sellers/:handle` returns public seller details, active `AVAILABLE` products, and a `SOLD` closet archive.

```bash
curl -s "http://localhost:9000/store/sellers/snoopdogg"
```

**Response (200):**
```json
{
  "seller": {
    "id": "01M5...",
    "handle": "snoopdogg",
    "store_name": "Snoop Dogg Shop",
    "avatar_url": "https://picsum.photos/seed/snoopdogg/400/400",
    "bio": "Legendary rapper and entrepreneur."
  },
  "products": [ { "id": "prod_snoop_001", "title": "Snoop Dogg Platinum Chain", "marketplace_listing": { "listing_status": "AVAILABLE" } } ],
  "archive": [ { "id": "prod_snoop_old_001", "title": "Retired memorabilia", "marketplace_listing": { "listing_status": "SOLD" } } ]
}
```

### 6.12 Seller Workspace Profile (Working Today)

`GET /store/seller/me` returns the authenticated customer's active Seller profile,
including `seller_trust`, `seller_category`, `verification_status`, flag state, and
Listing counts (`total_listings`, `pending_approval`, `available`, `sold`, and
`rejected`). `PATCH /store/seller/me` accepts only `store_name`, `bio`,
`avatar_url`, and `social_media_handle`; marketplace moderation and payment fields
remain admin-controlled.

### 6.13 Public Product Lineage (Working Today)

`GET /store/products/:id/lineage` returns transfers in ascending transaction order.
Each transfer includes the public seller profile, opaque buyer customer ID, price,
transaction timestamp, and `voided_at` when an HQ cancellation reversed it. Customer
PII, payment data, and internal order-line identifiers are never exposed.

---

## 7. Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Malformed request body or missing fields |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Actor doesn't have permission for this action |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Duplicate handle, razorpay_account_id, etc. |
| 422 | `UNPROCESSABLE_ENTITY` | Validation error (e.g., seller not verified) |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error |

---

## 8. CORS & Cookie Configuration

### CORS Origins

| Origin | Frontend | Port | Credentials |
|--------|----------|------|-------------|
| `http://localhost:3000` | Buyer App | 3000 | ✅ Yes |
| `http://localhost:3001` | Seller App | 3001 | ✅ Yes |

### Cookie Settings

| Setting | Development | Production |
|---------|-------------|------------|
| `httpOnly` | `true` | `true` |
| `secure` | `false` | `true` |
| `sameSite` | `lax` | `strict` |
| `domain` | `localhost` | `.pawnpawn.com` |

### medusa-config.js CORS Config

```javascript
storeCors: 'http://localhost:3000,http://localhost:3001',
adminCors: 'http://localhost:9000,http://localhost:5173',
authCors: 'http://localhost:3000,http://localhost:3001,http://localhost:9000',
```

---

## 9. Medusa Config Notes

**Important**: The config file is `medusa-config.js` (NOT `.ts`). Medusa CLI's ts-node has ESM/CJS interop issues with `defineConfig()` imports from `@medusajs/framework/utils`. The config uses plain `module.exports` with manually registered essential modules.

All default core modules are registered manually to support the Admin UI:
- `auth` (with emailpass provider)
- `user`, `api_key`, `store`
- `stock_location`, `inventory`, `product`, `pricing`, `promotion`
- `customer`, `sales_channel`, `cart`, `region`, `tax`, `currency`
- `payment`, `order`, `settings`
- `fulfillment` (with manual provider)
- `notification` (with local provider)
- `search` (with postgres provider)
- `cache` (inmemory), `event_bus` (local), `locking`, `file` (local)
- `seller` (custom), `lineage` (custom)

---

## 10. Custom Modules

Both modules are registered in `medusa-config.js` under the keys `seller` and `lineage`. Resolve them with those keys:

```ts
const sellerService = container.resolve("seller")
const lineageService = container.resolve("lineage")
```

Do **not** resolve `sellerModuleService` / `lineageModuleService` — those names are not registered.

### Seller Module (`src/modules/seller`)

**Data Model:** `seller`
- `id` (PK, text) — opaque; do not assume a prefix (service-created rows are ULID-like, seed rows may be `seller_*` or UUID-shaped)
- `customer_id` (nullable unique text) — link to a Medusa Customer (buyer-turned-seller)
- `handle` (unique text)
- `store_name` (text)
- `avatar_url` (nullable text)
- `razorpay_account_id` (unique nullable text)
- `seller_trust` (text: trusted, untrusted, default trusted)
- `seller_category` (text: celebrity, influencer, musician, athlete, other, default celebrity)
- `social_media_handle` (nullable text)
- `bio` (nullable text)
- `verification_status` (enum: PENDING, VERIFIED, default PENDING)
- `created_at`, `updated_at`, `deleted_at` (timestamps)

**Custom Service Methods:**
- `findByHandle(handle)` — Find seller by handle (returns `null` if missing)
- `verifySeller(sellerId)` — Set verification_status to VERIFIED
- `updateRazorpayAccount(sellerId, razorpayAccountId)` — Update Razorpay Connect ID
- `findTrustedSellers()` — List trusted sellers
- `findSellersByCategory(category)` — Filter by category
- `updateTrustStatus(sellerId, trust)` — Set trusted/untrusted
- `updateCategory(sellerId, category)` — Update category
- `updateSocialMedia(sellerId, handle)` — Update social handle
- `updateBio(sellerId, bio)` — Update bio

**Generated CRUD:** `listSellers`, `retrieveSeller`, `createSellers`, `updateSellers`, `deleteSellers`.

**Admin CRUD API:** `GET /admin/seller` (filters: `q`, `trust`, `category`, `status`, `limit`, `offset`), `GET /admin/seller/:id`, `POST /admin/seller`, `PATCH /admin/seller/:id`, and `DELETE /admin/seller/:id` (soft-delete via `is_deactivated`). The Medusa Admin **Sellers** page (`/app/sellers`) consumes the list endpoint. Lineage REST (`/admin/lineage*`) remains planned.

### Product Lineage Module (`src/modules/lineage`)

**Data Model:** `product_lineage`
- `id` (PK, text)
- `product_id` (text) — Reference to Medusa product
- `seller_id` (nullable text) — FK to seller; null for buyer-to-buyer resale
- `buyer_id` (text) — Reference to Medusa customer
- `price` (float, nullable)
- `transacted_at` (datetime)
- `created_at`, `updated_at`, `deleted_at` (timestamps)

**Custom Service Methods:**
- `recordTransfer(data)` — Create a new lineage entry (`seller_id` optional)
- `getLineageHistory(product_id)` — Get all transfers for a product (ascending)
- `getCurrentOwner(product_id)` — Get the most recent buyer_id

**Generated CRUD:** `listProductLineages`, `retrieveProductLineage`, `createProductLineages`, `updateProductLineages`, `deleteProductLineages`.

### Module Gotchas

1. `MedusaService` generates model-suffixed methods. There is no generic `this.list()` / `this.create()` / `this.update()`; calling them throws `this.list is not a function`.
2. `updateSellers` accepts `{ id, ...fields }` or `{ selector, data }`, not `(id, data)`.
3. IDs must be `TEXT` in PostgreSQL because Medusa generates text IDs. UUID columns cause insert failures.
4. Medusa's generated queries require `created_at`, `updated_at`, and `deleted_at` columns on custom tables.
5. Verify against seeded data with:

```bash
cd apps/backend
../../node_modules/.bin/medusa exec ./src/scripts/verify-sample-data.ts
```

See [`SAMPLE_DATA.md`](./SAMPLE_DATA.md) for the seeded sellers, buyers, and products.

---

*End of API documentation. Keep in sync with code changes.*
