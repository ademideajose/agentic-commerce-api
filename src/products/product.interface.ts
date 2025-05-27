// src/products/product.interface.ts

export interface ProductVariant {
id: number;
admin_graphql_api_id: string; // For the GID format
product_id: number;
    title: string;
    price: string;
    sku: string | null;
    position: number;
    inventory_policy: string;
    compare_at_price: string | null;
    fulfillment_service: string;
    inventory_management: string | null;
    option1: string | null;
    option2: string | null;
    option3: string | null;
    created_at: string;
    updated_at: string;
    taxable: boolean;
    barcode: string | null;
    grams: number;
    image_id: number | null;
    weight: number;
    weight_unit: string;
    inventory_item_id: number;
    inventory_quantity: number;
    old_inventory_quantity: number;
    presentment_prices?: Array<{ // Shopify can have multiple presentment prices
      price: {
        amount: string;
        currency_code: string;
      };
      compare_at_price: {
        amount: string;
        currency_code: string;
      } | null;
    }>;
    // Add currency_code directly if it exists at variant level from your API exploration
    currency_code?: string; 
    price_set?: { // Often present in Storefront API, good to have
      shop_money: {
        amount: string;
        currency_code: string;
      };
      presentment_money: {
        amount: string;
        currency_code: string;
      };
    };
    // Add any other variant fields you expect from the Shopify API
  }
  
  export interface ProductOption {
    id: number;
    product_id: number;
    name: string;
    position: number;
    values: string[];
  }
  
  export interface ProductImage {
    id: number;
    product_id: number;
    position: number;
    created_at: string;
    updated_at: string;
    alt: string | null;
    width: number;
    height: number;
    src: string;
    variant_ids: number[];
    admin_graphql_api_id: string;
  }
  
  export interface Product {
    id: number;
    admin_graphql_api_id: string; // For the GID format
    title: string;
    body_html: string | null;
    vendor: string;
    product_type: string;
    created_at: string;
    handle: string;
    updated_at: string;
    published_at: string | null;
    template_suffix: string | null;
    status: string; // e.g., 'active', 'draft', 'archived'
    published_scope: string;
    tags: string; // Comma-separated string
    variants: ProductVariant[];
    options: ProductOption[];
    images: ProductImage[];
    image: ProductImage | null;
  }