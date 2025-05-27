
# Agentic Commerce API

This API enables AI agents to interact with Shopify stores by exposing structured product data and allowing checkout generation.

## 🧭 API Endpoints

### GET `/products`

Fetch a list of products with optional filters.

#### Query Parameters:
- `q`: Keyword search in title or description
- `price_min`: Minimum price
- `price_max`: Maximum price
- `tags_includeany`: Comma-separated list of tags
- `in_stock`: `true` or `false`

### Example:
```
GET /products?q=backpack&price_min=30&tags_includeany=travel,giftable&in_stock=true
```

---

### GET `/products/:id`

Fetch detailed product info in a schema.org-inspired format.

### Example:
```
GET /products/123456789
```

Returns detailed metadata including:
- Brand, type, tags
- Images
- All variant offers with prices, stock, etc.

---

### POST `/checkouts`

Generate a Shopify checkout URL from selected variant IDs.

### Body:
```json
{
  "shop": "your-store.myshopify.com",
  "lineItems": [
    { "variantId": "gid://shopify/ProductVariant/123", "quantity": 1 }
  ],
  "discountCode": "WELCOME10",
  "note": "Agent-assisted",
  "customerEmail": "test@example.com"
}
```

### Response:
```json
{
  "checkoutUrl": "https://your-store.myshopify.com/cart/..."
}
```

---

### GET `/.well-known/agent-commerce-openapi.json`

OpenAPI 3.0 spec for agent discovery.

This file describes the above endpoints for agentic systems to self-integrate.

---

## 🧩 Integration Notes

- Ensure `SHOPIFY_ADMIN_API_TOKEN` is available in the environment for fetching real data.
- Modify product URL generation logic as needed to match your Shopify theme.
- Add CORS or headers as required by your agent clients.

---

© 2025 – Built for agentic commerce prototypes



## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```


## License

Nest is [MIT licensed](LICENSE).
