// src/products/products.service.ts
import {
  Injectable,
  UnauthorizedException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { TokenStorageService } from '../auth/token-storage.service';

// Helper type for findAll parameters, promoting clarity
interface FindAllProductsParams {
  shop: string;
  first: number;
  after?: string | null; // Cursor for pagination
  query?: string | null; // For keyword search (maps to Shopify's 'query' on title, etc.)
  productType?: string | null;
  vendor?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  tagsIncludeAny?: string[] | null; // Expecting array of tags
  tagsIncludeAll?: string[] | null; // Expecting array of tags
  inStock?: boolean | null;
  sortBy?: string | null; // e.g., "RELEVANCE", "PRICE_ASC", "PRICE_DESC"
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly SHOPIFY_API_VERSION = '2025-01';

  constructor(private readonly tokenStorageService: TokenStorageService) {}

  private async getShopifyHeaders(
    shop: string,
  ): Promise<{ [key: string]: string }> {
    const token = await this.tokenStorageService.getToken(shop);
    if (!token) {
      this.logger.warn(
        `No token found for shop ${shop} in ProductsService operations.`,
      );
      throw new UnauthorizedException(
        `Access token not available for shop ${shop}. Please ensure the app is authorized.`,
      );
    }
    return {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    };
  }

  private buildShopifyProductQuery(params: FindAllProductsParams): string {
    const queryParts: string[] = [];
    if (params.query) {
      // Basic keyword search - Shopify's query can search multiple fields like title, vendor, product_type, sku, variants.title, etc.
      // For more targeted search (e.g., only title), you'd use title:${params.query}*
      queryParts.push(
        `(title:*${params.query}* OR description:*${params.query}* OR vendor:*${params.query}* OR product_type:*${params.query}* OR sku:*${params.query}*)`,
      );
    }
    if (params.productType) {
      queryParts.push(`product_type:'${params.productType}'`);
    }
    if (params.vendor) {
      queryParts.push(`vendor:'${params.vendor}'`);
    }
    if (params.priceMin !== null && params.priceMin !== undefined) {
      queryParts.push(`variants.price:>=${params.priceMin}`);
    }
    if (params.priceMax !== null && params.priceMax !== undefined) {
      queryParts.push(`variants.price:<=${params.priceMax}`);
    }
    if (params.tagsIncludeAll && params.tagsIncludeAll.length > 0) {
      params.tagsIncludeAll.forEach((tag) =>
        queryParts.push(`tag:'${tag.trim()}'`),
      );
    }
    if (params.tagsIncludeAny && params.tagsIncludeAny.length > 0) {
      queryParts.push(
        `(${params.tagsIncludeAny.map((tag) => `tag:'${tag.trim()}'`).join(' OR ')})`,
      );
    }
    if (params.inStock === true) {
      queryParts.push('variants.inventory_quantity:>0');
    } else if (params.inStock === false) {
      queryParts.push('variants.inventory_quantity:<=0');
    }
    // Note: Filtering by complex options (color/size) directly in this query string is advanced.
    // It might involve querying variant titles if they contain option values, or would be better handled
    // by filtering the results if the query syntax becomes too complex or isn't fully supported for options.
    // For now, color/size filtering will remain primarily in the controller as a post-fetch step.

    return queryParts.join(' AND ');
  }

  private mapSortKey(sortByApiValue?: string | null): string | undefined {
    // Maps API sort values to Shopify ProductSortKeys
    // Ensure these values are valid ProductSortKeys enum members in Shopify's GraphQL
    switch (sortByApiValue?.toLowerCase()) {
      case 'price_asc':
        return 'PRICE'; // Direction needs to be handled separately or use specific keys like `PRICE_ASC` if available
      case 'price_desc':
        return 'PRICE'; // Will need reverse: true for PRICE_DESC
      case 'published_at_desc':
        return 'PUBLISHED_AT'; // Will need reverse: true
      case 'created_at_desc':
        return 'CREATED_AT'; // Will need reverse: true
      case 'relevance':
        return 'RELEVANCE';
      default:
        return 'RELEVANCE'; // Default sort key
    }
  }
  private needsReverseSort(sortByApiValue?: string | null): boolean {
    const lowerSortBy = sortByApiValue?.toLowerCase();
    return (
      lowerSortBy === 'price_desc' ||
      lowerSortBy === 'published_at_desc' ||
      lowerSortBy === 'created_at_desc'
    );
  }

  async findAll(
    params: FindAllProductsParams,
  ): Promise<{ products: any[]; pageInfo: any }> {
    const headers = await this.getShopifyHeaders(params.shop);
    const shopifyQueryString = this.buildShopifyProductQuery(params);
    const sortKey = this.mapSortKey(params.sortBy);
    const reverseSort = this.needsReverseSort(params.sortBy);

    const graphqlQuery = {
      query: `
        query getProducts(
          $first: Int!, 
          $after: String, 
          $queryString: String,
          $sortKey: ProductSortKeys,
          $reverse: Boolean
        ) {
          products(
            first: $first, 
            after: $after, 
            query: $queryString, 
            sortKey: $sortKey,
            reverse: $reverse
          ) {
            edges {
              node {
                id
                admin_graphql_api_id: id
                title
                handle
                descriptionHtml
                bodyHtml: descriptionHtml
                vendor
                productType
                status
                tags
                createdAt
                updatedAt
                publishedAt
                options { id name position values } # For controller option filtering
                featuredImage { id url altText }
                images(first: 1) { edges { node { id url src: url altText } } } # For summary
                variants(first: 10) { # For price, stock, and option filtering in controller
                  edges {
                    node {
                      id
                      admin_graphql_api_id: id
                      title
                      sku
                      priceV2 { amount currencyCode }
                      price: priceV2 { amount }
                      inventoryQuantity
                      selectedOptions { name value } # For controller option filtering
                      image { id url src: url altText }
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
              hasPreviousPage # Shopify provides these too
              startCursor
            }
          }
        }
      `,
      variables: {
        first: params.first,
        after: params.after,
        queryString: shopifyQueryString || null, // Pass null if empty for Shopify to ignore
        sortKey: sortKey,
        reverse: reverseSort,
      },
    };

    try {
      const response = await axios.post(
        `https://${params.shop}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
        graphqlQuery,
        { headers },
      );

      if (response.data.errors) {
        this.logger.error(
          `GraphQL errors fetching products for shop ${params.shop}:`,
          JSON.stringify(response.data.errors),
        );
        throw new Error(
          `GraphQL error: ${response.data.errors.map((e: any) => e.message).join(', ')}`,
        );
      }

      const productEdges = response.data?.data?.products?.edges || [];
      const pageInfo = response.data?.data?.products?.pageInfo || {
        hasNextPage: false,
        endCursor: null,
        hasPreviousPage: false,
        startCursor: null,
      };

      const products = productEdges.map((edge: any) => {
        const productNode = edge.node;
        if (productNode.images && productNode.images.edges) {
          productNode.images = productNode.images.edges.map(
            (imgEdge: any) => imgEdge.node,
          );
        } else {
          productNode.images = [];
        }
        if (productNode.images.length > 0) {
          productNode.image = productNode.images[0];
        } else if (productNode.featuredImage) {
          productNode.image = productNode.featuredImage;
        }

        if (productNode.variants && productNode.variants.edges) {
          productNode.variants = productNode.variants.edges.map(
            (varEdge: any) => {
              const variantNode = varEdge.node;
              if (variantNode.priceV2) {
                variantNode.price = variantNode.priceV2.amount;
              }
              return variantNode;
            },
          );
        } else {
          productNode.variants = [];
        }
        return productNode;
      });

      return { products, pageInfo };
    } catch (error) {
      // ... (error handling as before, ensure it's robust) ...
      this.logger.error(
        `Error fetching all products for ${params.shop} via GraphQL: ${error.message}`,
        error.stack,
      );
      if (error.response?.status === 401) {
        throw new UnauthorizedException(
          'Shopify token invalid or insufficient scope for findAll (GraphQL).',
        );
      }
      throw error;
    }
  }

  // findOne method remains as previously revised (using GraphQL)
  async findOne(productIdGid: string, shop: string): Promise<any> {
    // ... (Keep the GraphQL version of findOne from the previous response)
    const headers = await this.getShopifyHeaders(shop);
    const graphqlQuery = {
      query: `
        query getProductById($id: ID!) {
          product(id: $id) {
            id 
            admin_graphql_api_id: id 
            title
            handle
            descriptionHtml 
            bodyHtml: descriptionHtml 
            vendor
            productType
            status
            createdAt
            updatedAt
            publishedAt
            tags
            options { id name position values }
            images(first: 25) { edges { node { id url src: url altText width height position } } }
            variants(first: 50) {
              edges {
                node {
                  id 
                  admin_graphql_api_id: id 
                  title
                  sku
                  priceV2 { amount currencyCode }
                  price: priceV2 { amount }
                  inventoryQuantity
                  image { id url src: url altText }
                  selectedOptions { name value }
                }
              }
            }
            featuredImage { id url src: url altText width height }
          }
        }
      `,
      variables: { id: productIdGid },
    };

    try {
      const response = await axios.post(
        `https://${shop}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
        graphqlQuery,
        { headers },
      );
      if (response.data.errors) {
        /* ... error handling ... */
        this.logger.error(
          `GraphQL errors for product ${productIdGid} on shop ${shop}:`,
          JSON.stringify(response.data.errors),
        );
        if (
          response.data.errors.some(
            (err: any) =>
              err.message?.toLowerCase().includes('not found') ||
              err.extensions?.code === 'NOT_FOUND',
          )
        ) {
          throw new NotFoundException(
            `Product with GID ${productIdGid} not found on shop ${shop} via GraphQL.`,
          );
        }
        throw new Error(
          `GraphQL error fetching product: ${response.data.errors
            .map((e: any) => e.message)
            .join(', ')}`,
        );
      }
      const productData = response.data?.data?.product;
      if (!productData) {
        throw new NotFoundException(`Product GID ${productIdGid} not found.`);
      }

      if (productData.images && productData.images.edges) {
        productData.images = productData.images.edges.map(
          (edge: any) => edge.node,
        );
      } else {
        productData.images = [];
      }
      if (productData.variants && productData.variants.edges) {
        productData.variants = productData.variants.edges.map((edge: any) => {
          const node = edge.node;
          if (node.priceV2) {
            node.price = node.priceV2.amount;
          }
          return node;
        });
      } else {
        productData.variants = [];
      }
      if (productData.featuredImage) {
        productData.image = productData.featuredImage;
      }
      return productData;
    } catch (error) {
      /* ... error handling ... */
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error(
        `Error fetching product GID ${productIdGid} for ${shop} via GraphQL: ${error.message}`,
        error.stack,
      );
      if (error.response?.status === 401) {
        throw new UnauthorizedException(
          'Shopify token invalid or insufficient scope for findOne (GraphQL).',
        );
      }
      throw new Error(
        `Failed to fetch product GID ${productIdGid} from ${shop}: ${error.message}`,
      );
    }
  }
}
