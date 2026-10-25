# API.md - PawnPawn Backend API Documentation

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

This section is authoritative. Anything marked **Planned** is a documented contract only — no route file exists under `src/api/` yet.

| Area | Route / capability | Status |
|------|--------------------|--------|
| Admin auth | `POST /auth/user/emailpass`, `POST /auth/session` | Implemented |
| Customer auth | `POST /auth/customer/emailpass`, `POST /auth/customer/emailpass/register` | Implemented |
| Store catalog | `GET /store/products`, `GET /store/products/:id` | Implemented (Medusa core) |
| Store customers | `POST /store/customers` | Implemented (Medusa core) |
| Admin core | Regions, products, customers, orders, API keys | Implemented (Medusa core) |
| Seller module | `SellerModuleService` (CRUD + trust/category methods) | Implemented (service only) |
| Lineage module | `LineageModuleService` (`recordTransfer`, `getLineageHistory`, `getCurrentOwner`) | Implemented (service only) |
| Seller onboarding | `POST /store/seller/onboard`, `GET/PATCH /store/seller/me` | **Planned** |
| Seller listings | `POST/PATCH /store/products`, `GET /store/products?listing_type=` | **Planned** |
| Auctions | `POST /store/products/:id/auction/start`, `POST /store/products/:id/bid` | **Planned** |
| Purchase + lineage REST | `POST /store/purchase`, `GET /store/products/:id/lineage` | **Planned** |
| Admin seller read API | `GET /admin/seller`, `GET /admin/seller/:id` | Implemented |
| Admin sellers page | Admin UI route `/app/sellers` | Implemented |
| Admin seller mutations | `POST /admin/seller`, `PATCH /admin/seller/:id/{trust,category,social,bio}` | **Planned** |
| Admin lineage REST | `/admin/lineage*` | **Planned** |

Only these route files exist today:

```text
apps/backend/src/api/admin/custom/route.ts
apps/backend/src/api/admin/seller/route.ts
apps/backend/src/api/admin/seller/[id]/route.ts
apps/backend/src/api/store/custom/route.ts
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

const trusted = await sellerService.findTrustedSellers()
const history = await lineageService.getLineageHistory("prod_snoop_001")
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
| Customer (Buyer) | `customer` | Store API (`/store/*`) |
| Seller | *(no separate auth actor yet)* | Sellers are customers linked via `seller.customer_id`; seller-only routes are planned |
| Admin | `admin` | Admin API (`/admin/*`) |

> There is no Medusa `seller` auth actor. A seller account is currently a normal customer plus a `seller` row referencing it through `customer_id`.

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

> **Coverage note:** this spec describes the full intended contract. Only the auth paths, core store/admin routes, `GET /store/products/{id}`, and the admin seller read paths (`GET /admin/seller`, `GET /admin/seller/{id}`) are actually served today. `/store/seller/*`, custom `POST/PATCH /store/products`, auction, purchase, lineage, admin seller mutations, and `/admin/lineage*` paths are **Planned** — see [Current Implementation Status](#current-implementation-status).

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
          description: Stored in the custom `product.listing_type` column; not returned by the core store API yet
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
            required: [product_id, buyer_id]
            properties:
              product_id:
                type: string
              buyer_id:
                type: string
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
      summary: Onboard a new seller
      requestBody:
        $ref: '#/components/requestBodies/SellerOnboardRequest'
      responses:
        '201':
          description: Seller created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Seller'

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
                $ref: '#/components/schemas/Seller'

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
      responses:
        '200':
          description: Updated seller profile
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Seller'

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
        - name: listing_type
          in: query
          schema:
            type: string
            enum: [FIXED_PRICE, AUCTION]
        - name: seller_id
          in: query
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
                  lineage:
                    $ref: '#/components/schemas/ProductLineage'

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
| POST | `/store/seller/onboard` | No | Register a new seller | `201 Created` | Planned |
| GET | `/store/seller/me` | Bearer/Cookie | Get current seller profile | `200 OK` | Planned |
| PATCH | `/store/seller/me` | Bearer/Cookie | Update seller profile | `200 OK` | Planned |

### Product APIs

| Method | Endpoint | Auth | Description | Success Status | Status |
|--------|----------|------|-------------|----------------|--------|
| GET | `/store/products` | Publishable key | List products with filters | `200 OK` | Implemented (core) |
| GET | `/store/products/:id` | Publishable key | Get product details | `200 OK` | Implemented (core) |
| POST | `/store/products` | Bearer/Cookie | Create seller listing (FIXED_PRICE or AUCTION) | `201 Created` | Planned |
| PATCH | `/store/products/:id` | Bearer/Cookie | Update seller listing | `200 OK` | Planned |
| POST | `/store/products/:id/auction/start` | Bearer/Cookie | Start auction | `200 OK` | Planned |
| POST | `/store/products/:id/bid` | Bearer/Cookie | Place bid on auction | `200 OK` | Planned |

> The core product endpoints return Medusa fields. The custom `listing_type` column is stored in PostgreSQL but is not part of Medusa's product model, so it is not returned by `GET /store/products` until a custom route/serializer is added.

### Purchase & Lineage APIs

| Method | Endpoint | Auth | Description | Success Status | Status |
|--------|----------|------|-------------|----------------|--------|
| POST | `/store/purchase` | Bearer/Cookie | Purchase fixed-price product | `201 Created` | Planned |
| GET | `/store/products/:id/lineage` | No | Get ownership history | `200 OK` | Planned |

### Custom Module Admin APIs

| Method | Endpoint | Auth | Description | Success Status | Status |
|--------|----------|------|-------------|----------------|--------|
| GET | `/admin/seller` | Bearer | List sellers (search/filter/paginate) | `200 OK` | Implemented |
| GET | `/admin/seller/:id` | Bearer | Get seller by ID | `200 OK` | Implemented |
| POST | `/admin/seller` | Bearer | Create seller | `201 Created` | Planned |
| PATCH | `/admin/seller/:id/trust` | Bearer | Update trust status (trusted/untrusted) | `200 OK` | Planned |
| PATCH | `/admin/seller/:id/category` | Bearer | Update seller category | `200 OK` | Planned |
| PATCH | `/admin/seller/:id/social` | Bearer | Update social media handle | `200 OK` | Planned |
| PATCH | `/admin/seller/:id/bio` | Bearer | Update seller bio | `200 OK` | Planned |
| GET | `/admin/lineage` | Bearer | List all lineage entries | `200 OK` | Planned |
| GET | `/admin/lineage/:id` | Bearer | Get lineage by ID | `200 OK` | Planned |
| POST | `/admin/lineage` | Bearer | Record lineage transfer | `201 Created` | Planned |

> **Implemented seller reads:** `GET /admin/seller` and `GET /admin/seller/:id` are live. The same data is rendered in the Medusa Admin at **Sellers** (`http://localhost:9000/app/sellers`). Seller mutations remain **Planned**; use the module service or SQL until those routes exist.

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

**Generated CRUD methods** (provided by `MedusaService`, model-suffixed):

| Model | List | Retrieve | Create | Update | Delete |
|-------|------|----------|--------|--------|--------|
| `Seller` | `listSellers` | `retrieveSeller` | `createSellers` | `updateSellers` | `deleteSellers` |
| `ProductLineage` | `listProductLineages` | `retrieveProductLineage` | `createProductLineages` | `updateProductLineages` | `deleteProductLineages` |

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

> **Status: PLANNED** — `/store/seller/onboard` is not implemented yet. The contract below documents the intended behaviour. Until then, create sellers through `sellerService.createSellers(...)` in a script or SQL.

**Request:**
```http
POST /store/seller/onboard
Content-Type: application/json

{
  "handle": "rajesh_jewelers",
  "store_name": "Rajesh Jewelers",
  "avatar_url": "https://cdn.pawnpawn.com/avatars/rajesh.jpg",
  "seller_trust": "untrusted",
  "seller_category": "other",
  "social_media_handle": "@rajeshjewelers",
  "bio": "Family jeweler reselling authenticated pieces."
}
```

**Response (201):**
```json
{
  "id": "seller_01JABCDEF123",
  "customer_id": "cus_01JXYZ789",
  "handle": "rajesh_jewelers",
  "store_name": "Rajesh Jewelers",
  "avatar_url": "https://cdn.pawnpawn.com/avatars/rajesh.jpg",
  "razorpay_account_id": "ra_connect_rajesh_001",
  "seller_trust": "untrusted",
  "seller_category": "other",
  "social_media_handle": "@rajeshjewelers",
  "bio": "Family jeweler reselling authenticated pieces.",
  "verification_status": "PENDING",
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

### 6.3 Create Product (Fixed Price)

> **Status: PLANNED** — custom `POST /store/products` is not implemented. Use the Medusa Admin API or a seed script until the seller listing route exists.

**Request:**
```http
POST /store/products
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "title": "Vintage Gold Watch",
  "description": "1980s Rolex Submariner, excellent condition",
  "listing_type": "FIXED_PRICE",
  "price": 2500.00
}
```

**Response (201):**
```json
{
  "id": "prod_01JABCDEF123",
  "title": "Vintage Gold Watch",
  "description": "1980s Rolex Submariner, excellent condition",
  "listing_type": "FIXED_PRICE",
  "price": 2500.00,
  "seller_id": "seller_01JABCDEF123",
  "created_at": "2026-01-15T11:00:00Z"
}
```

### 6.4 Purchase Product

> **Status: PLANNED** — `/store/purchase` is not implemented. Lineage is currently recorded with `lineageService.recordTransfer(...)` or SQL.

**Request:**
```http
POST /store/purchase
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "product_id": "prod_01JABCDEF123",
  "buyer_id": "cust_01JXYZ789"
}
```

**Response (201):**
```json
{
  "order": {
    "id": "order_01JABCDEF789",
    "status": "completed",
    "total": 2500.00,
    "customer_id": "cust_01JXYZ789"
  },
  "lineage": {
    "id": "lineage_01JABCDEF789",
    "product_id": "prod_01JABCDEF123",
    "seller_id": "seller_01JABCDEF123",
    "buyer_id": "cust_01JXYZ789",
    "price": 2500.00,
    "transacted_at": "2026-01-15T12:00:00Z"
  }
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

> **Status: IMPLEMENTED** — `GET /admin/seller` and `GET /admin/seller/:id` read the custom seller module. The Medusa Admin UI page is at `http://localhost:9000/app/sellers`.

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

**Admin read API:** `GET /admin/seller` (filters: `q`, `trust`, `category`, `limit`, `offset`) and `GET /admin/seller/:id`. The Medusa Admin **Sellers** page (`/app/sellers`) consumes the list endpoint. Write routes remain planned.

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