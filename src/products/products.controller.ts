import {
  Controller,
  Get,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
// Assuming FindAllProductsParams is exported from products.service.ts or defined in a shared types file
// If not, you might define a similar structure here or pass parameters individually.
// For this example, let's assume it's available or we construct a compatible object.

// transformProductForDetail remains the same, as it's used when 'handle' is provided,
// which in this controller's current 'findAll' implementation, still filters from a list.
// If 'handle' logic were to call service.findOne directly, this function would process GraphQL data.
const transformProductForDetail = (product: any, shopDomain: string): any => {
  if (!product) return null;
  // This function expects a product structure that might come from REST or a GraphQL structure
  // that has been pre-processed by the service to look similar (e.g., images and variants as flat arrays).
  // Key things to check: product.admin_graphql_api_id, product.variants[0].currency_code, variant.optionN
  return {
    id: product.admin_graphql_api_id || product.id, // GID
    name: product.title,
    description: product.body_html || product.descriptionHtml, // Prefer descriptionHtml if available
    url: `https://${shopDomain}/products/${product.handle}`,
    handle: product.handle,
    brand: { '@type': 'Brand', name: product.vendor },
    productType: product.product_type || product.productType,
    tags: Array.isArray(product.tags)
      ? product.tags
      : product.tags
        ? String(product.tags)
            .split(',')
            .map((t: string) => t.trim())
        : [],
    status: product.status || 'ACTIVE', // Ensure status is mapped from GraphQL (usually uppercase)
    createdAt: product.created_at || product.createdAt,
    updatedAt: product.updated_at || product.updatedAt,
    publishedAt: product.published_at || product.publishedAt,
    images: (product.images || []).map((img: any, idx: number) => ({
      // product.images is now array of nodes
      '@type': 'ImageObject',
      url: img.src || img.url,
      alternateName: img.altText || product.title,
      position: img.position !== undefined ? img.position : idx + 1,
    })),
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: Math.min(
        ...(product.variants || []).map((v: any) =>
          parseFloat(v.priceV2?.amount || v.price || '0'),
        ),
      ),
      highPrice: Math.max(
        ...(product.variants || []).map((v: any) =>
          parseFloat(v.priceV2?.amount || v.price || '0'),
        ),
      ),
      priceCurrency: product.variants?.[0]?.priceV2?.currencyCode || 'USD', // Use priceV2
      offerCount: product.variants?.length || 0,
      offers: (product.variants || []).map((variant: any) => {
        // Adapt attributes from variant.selectedOptions
        let attributes = [];
        if (product.options && variant.selectedOptions) {
          attributes = variant.selectedOptions.map((selectedOpt: any) => ({
            name: selectedOpt.name,
            value: selectedOpt.value,
          }));
        } else if (product.options) {
          // Fallback if selectedOptions not on variant, try to map from product.options
          attributes = product.options.map((opt: any, i: number) => ({
            name: opt.name,
            // This is the part that's hard to get from GraphQL directly if optionN was used.
            // Forcing a placeholder if selectedOptions is not available.
            value:
              variant[`option${i + 1}`] ||
              variant.title.split(' / ')[i] ||
              null,
          }));
        }

        return {
          '@type': 'Offer',
          id: variant.admin_graphql_api_id || variant.id,
          sku: variant.sku,
          name: variant.title,
          price: variant.priceV2?.amount || variant.price,
          priceCurrency: variant.priceV2?.currencyCode || 'USD',
          availability:
            (variant.inventoryQuantity !== undefined &&
              variant.inventoryQuantity > 0) ||
            (variant.inventory_quantity !== undefined &&
              variant.inventory_quantity > 0)
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          inventoryLevel: {
            '@type': 'QuantitativeValue',
            value:
              variant.inventoryQuantity !== undefined
                ? variant.inventoryQuantity
                : variant.inventory_quantity,
          },
          itemCondition: 'https://schema.org/NewCondition',
          attributes: attributes,
          url: `https://${shopDomain}/products/${product.handle}?variant=${String(variant.id).split('/').pop()}`,
        };
      }),
    },
  };
};

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(
    @Query('shop') shop: string,
    // Pagination params for GraphQL
    @Query('first') firstInput?: string,
    @Query('after') after?: string,
    // Filter params (service will translate many of these to Shopify query)
    @Query('q') q?: string,
    @Query('handle') handle?: string, // Handle specific product case
    @Query('product_type') productType?: string,
    @Query('vendor') vendor?: string,
    @Query('price_min') priceMinInput?: string,
    @Query('price_max') priceMaxInput?: string,
    @Query('tags_includeany') tagsIncludeAnyRaw?: string,
    @Query('tags_includeall') tagsIncludeAllRaw?: string,
    // Color and Size filters might still need post-processing if not fully in Shopify query
    @Query('color') colorFilter?: string,
    @Query('size') sizeFilter?: string,
    @Query('in_stock') inStockParam?: string,
    @Query('sort_by') sortBy?: string,
    // Removed: @Query('limit') limit?: string, @Query('offset') offset?: string,
  ) {
    if (!shop) {
      throw new BadRequestException('Shop query parameter is required.');
    }
    const shopDomain = shop.split('/')[0]; // Used for URL generation

    // If a handle is provided, the current logic fetches all then filters.
    // This could be optimized to call productsService.findOneByHandle if such a method existed
    // or make a specific service call for a single product by handle using GraphQL query with `handle:"value"`.
    // For now, keeping the original handle logic which relies on `productsService.findAll` returning enough data.
    if (handle) {
      // This part implies productsService.findAll needs to fetch a list that might contain the handle.
      // Or, ideally, if handle is provided, we should make a more targeted call.
      // For now, let's assume the service `findAll` returns a list, and we find the handle here.
      // This might be inefficient if the list is very large.
      const { products: allProductsForHandleSearch } =
        await this.productsService.findAll({
          shop,
          first: 250, // Fetch a decent number to search for handle
          // We don't pass other filters here, assuming handle search is exclusive. Or we should.
          // For simplicity here, we assume it works on a general fetch.
        });
      const foundProduct = allProductsForHandleSearch.find(
        (p: any) => p.handle === handle,
      );
      if (foundProduct) {
        return transformProductForDetail(foundProduct, shopDomain);
      } else {
        // Consider throwing NotFoundException if product with handle not found
        return null;
      }
    }

    const numFirst = firstInput ? parseInt(firstInput, 10) : 20;
    const priceMin = priceMinInput ? parseFloat(priceMinInput) : null;
    const priceMax = priceMaxInput ? parseFloat(priceMaxInput) : null;

    const serviceParams = {
      // Construct params for the service
      shop,
      first: numFirst,
      after: after || null,
      query: q || null,
      productType: productType || null,
      vendor: vendor || null,
      priceMin,
      priceMax,
      tagsIncludeAny: tagsIncludeAnyRaw
        ? tagsIncludeAnyRaw.split(',').map((t) => t.trim())
        : null,
      tagsIncludeAll: tagsIncludeAllRaw
        ? tagsIncludeAllRaw.split(',').map((t) => t.trim())
        : null,
      inStock: inStockParam === undefined ? null : inStockParam === 'true',
      sortBy: sortBy || 'RELEVANCE',
    };

    // productsService.findAll now returns { products: any[], pageInfo: any }
    const { products: fetchedProducts, pageInfo } =
      await this.productsService.findAll(serviceParams as any);

    // Apply filters that are hard to do in Shopify's main product query string
    // or require more complex logic, e.g., specific option filtering.
    const postFilteredProducts = fetchedProducts.filter((product: any) => {
      let matchesColor = !colorFilter;
      let matchesSize = !sizeFilter;

      if (product.options && (colorFilter || sizeFilter)) {
        if (colorFilter) {
          const colorOpt = product.options.find((opt: any) =>
            opt.name?.toLowerCase().includes('color'),
          );
          if (colorOpt) {
            matchesColor = product.variants?.some((v: any) =>
              v.selectedOptions?.some(
                (selOpt: any) =>
                  selOpt.name === colorOpt.name &&
                  selOpt.value?.toLowerCase() === colorFilter.toLowerCase(),
              ),
            );
          } else {
            matchesColor = false; // Product doesn't have a 'color' option
          }
        }
        if (sizeFilter) {
          const sizeOpt = product.options.find((opt: any) =>
            opt.name?.toLowerCase().includes('size'),
          );
          if (sizeOpt) {
            matchesSize = product.variants?.some((v: any) =>
              v.selectedOptions?.some(
                (selOpt: any) =>
                  selOpt.name === sizeOpt.name &&
                  selOpt.value?.toLowerCase() === sizeFilter.toLowerCase(),
              ),
            );
          } else {
            matchesSize = false; // Product doesn't have a 'size' option
          }
        }
      }
      return matchesColor && matchesSize;
    });

    // Map to ProductSummary objects
    // The controller is now responsible for mapping to the ProductSummary.
    // The service provides the data, controller shapes the final API output for this endpoint.
    const productSummaries = postFilteredProducts.map((p: any) => ({
      productId: p.admin_graphql_api_id || p.id,
      title: p.title,
      mainImage:
        p.image?.src ||
        p.image?.url ||
        p.featuredImage?.url ||
        p.images?.[0]?.url, // Use .url from GraphQL
      basePrice: p.variants?.[0]?.priceV2?.amount || p.variants?.[0]?.price, // Use .priceV2.amount
      keyTags: Array.isArray(p.tags)
        ? p.tags.slice(0, 3)
        : p.tags
          ? String(p.tags)
              .split(',')
              .map((t: string) => t.trim())
              .slice(0, 3)
          : [],
    }));

    return {
      products: productSummaries,
      pageInfo, // Include pageInfo for client-side pagination
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Query('shop') shop: string) {
    if (!shop) {
      throw new BadRequestException('Shop query parameter is required.');
    }
    // productsService.findOne now returns a product object structured from GraphQL
    const product = await this.productsService.findOne(id, shop);
    const shopDomain = shop.split('/')[0];

    // This now needs to use the `transformProductForDetail` function to ensure consistent detailed output
    // The `transformProductForDetail` function itself will need to be robust to handle
    // slight variations if the product data comes directly from the GraphQL-adapted service.findOne.
    return transformProductForDetail(product, shopDomain);
  }
}
