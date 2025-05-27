import {
  Controller,
  Get,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './product.interface'; 


const transformProductForDetail = (product: any, shopDomain: string): any => {
  if (!product) return null;
  return {
    id: product.admin_graphql_api_id,
    name: product.title,
    description: product.body_html,
    url: `https://${shopDomain}/products/${product.handle}`,
    handle: product.handle,
    brand: { "@type": "Brand", "name": product.vendor },
    productType: product.product_type,
    tags: product.tags ? product.tags.split(',').map(t => t.trim()) : [],
    status: product.status || "active",
    createdAt: product.created_at,
    updatedAt: product.updated_at,
    publishedAt: product.published_at,
    images: product.images.map((img, idx) => ({
      "@type": "ImageObject",
      url: img.src,
      alternateName: product.title,
      position: idx + 1
    })),
    offers: {
      "@type": "AggregateOffer",
      lowPrice: Math.min(...product.variants.map(v => parseFloat(v.price))),
      highPrice: Math.max(...product.variants.map(v => parseFloat(v.price))),
      priceCurrency: product.variants[0]?.currency_code || product.variants[0]?.price_set?.shop_money?.currency_code || "USD",
      offerCount: product.variants.length,
      offers: product.variants.map(variant => ({
        "@type": "Offer",
        id: variant.admin_graphql_api_id,
        sku: variant.sku,
        name: variant.title,
        price: variant.price,
        priceCurrency: variant.currency_code || variant.price_set?.shop_money?.currency_code || "USD",
        availability: variant.inventory_quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        inventoryLevel: {
          "@type": "QuantitativeValue",
          value: variant.inventory_quantity
        },
        itemCondition: "https://schema.org/NewCondition",
        attributes: product.options.map((opt, i) => ({
          name: opt.name,
          value: variant[`option${i + 1}`]
        })),
        url: `https://${shopDomain}/products/${product.handle}?variant=${variant.id}`
      }))
    }
  };
};



@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(
    @Query('shop') shop: string,
    @Query('q') q?: string,
    @Query('handle') handle?: string,
    @Query('product_type') productType?: string,
    @Query('vendor') vendor?: string,
    @Query('price_min') priceMin?: number,
    @Query('price_max') priceMax?: number,
    @Query('tags_includeany') tagsIncludeAny?: string,
    @Query('tags_includeall') tagsIncludeAll?: string,
    @Query('color') color?: string,
    @Query('size') size?: string,
    @Query('in_stock') inStock?: string,
    @Query('sort_by') sortBy?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!shop) {
      throw new BadRequestException('Shop query parameter is required.');
    }
    const allProducts = await this.productsService.findAll(shop);
    const shopDomain = shop.split('/')[0];
    // If handle is provided, find that specific product and return its detailed view
    if (handle) {
      const foundProduct = allProducts.find(p => p.handle === handle);
      if (foundProduct) {
        return transformProductForDetail(foundProduct, shopDomain);
      } else {
        return null; // Or throw NotFoundException
      }
    }

    const filters = {
      q: q?.toLowerCase(),
      priceMin: priceMin ? Number(priceMin) : null,
      priceMax: priceMax ? Number(priceMax) : null,
      tags: tagsIncludeAny ? tagsIncludeAny.toLowerCase().split(',') : [],
      inStock: inStock === 'true'
    };

    let filteredProducts = allProducts.filter((product: any) => { // Specify Product type if you have an interface
      const title = product.title?.toLowerCase() || '';
      const description = product.body_html?.toLowerCase() || '';
      const currentTags = (product.tags || '').toLowerCase().split(',').map(t => t.trim());
      const variants = product.variants || [];
      const prices = variants.map(v => parseFloat(v.price));
      const hasStock = variants.some(v => v.inventory_quantity > 0);
      const currentProductType = product.product_type?.toLowerCase() || '';
      const currentVendor = product.vendor?.toLowerCase() || '';

      const matchesQ = !filters.q || title.includes(filters.q) || description.includes(filters.q);
      const matchesProductType = !filters.productType || currentProductType === filters.productType;
      const matchesVendor = !filters.vendor || currentVendor === filters.vendor;
      const matchesTagsAny = !filters.tagsAny.length || filters.tagsAny.some(tag => currentTags.includes(tag));
      const matchesTagsAll = !filters.tagsAll.length || filters.tagsAll.every(tag => currentTags.includes(tag));
      const matchesPriceMin = filters.priceMin === null || prices.some(p => p >= filters.priceMin);
      const matchesPriceMax = filters.priceMax === null || prices.some(p => p <= filters.priceMax);
      const matchesStock = filters.inStock === undefined || filters.inStock === hasStock;

      let matchesColor = !filters.color;
      let matchesSize = !filters.size;

      if (filters.color || filters.size) {
        for (const option of product.options || []) {
          const optionName = option.name?.toLowerCase();
          if (filters.color && optionName.includes('color')) {
            matchesColor = product.variants.some(v => v[`option${option.position}`]?.toLowerCase() === filters.color);
          }
          if (filters.size && optionName.includes('size')) { // Simple check, might need refinement
            matchesSize = product.variants.some(v => v[`option${option.position}`]?.toLowerCase() === filters.size);
          }
        }
      }
      
      return matchesQ && matchesProductType && matchesVendor && matchesTagsAny && matchesTagsAll &&
             matchesPriceMin && matchesPriceMax && matchesStock && matchesColor && matchesSize;
    });

    // Sorting
    if (sortBy) {
      filteredProducts.sort((a, b) => {
        const aVal = a.variants[0]?.price ? parseFloat(a.variants[0].price) : 0;
        const bVal = b.variants[0]?.price ? parseFloat(b.variants[0].price) : 0;
        const aDate = new Date(a.published_at || 0).getTime();
        const bDate = new Date(b.published_at || 0).getTime();

        switch (sortBy) {
          case 'price_asc':
            return aVal - bVal;
          case 'price_desc':
            return bVal - aVal;
          case 'published_at_desc': // Newest first
            return bDate - aDate;
          // 'relevance' is tricky without a search engine; current 'q' filter is basic.
          // For now, relevance won't re-sort beyond the initial filtering.
          default:
            return 0;
        }
      });
    }

    // Pagination
    const numLimit = limit ? parseInt(limit, 10) : 20;
    const numOffset = offset ? parseInt(offset, 10) : 0;

    // Apply limit and offset after all filtering and sorting
    const paginatedProducts = filteredProducts.slice(numOffset, numOffset + numLimit);
    
    // The blueprint asks for an array of product summary objects.
    // For now, returning the filtered & paginated full objects. Can be trimmed down later if needed.
    // Each summary must include its canonical productId.
    return paginatedProducts.map(p => ({
        // Basic summary - adapt as needed, or return full object if preferred for now
        productId: p.admin_graphql_api_id || p.id, 
        title: p.title,
        mainImage: p.image?.src,
        basePrice: p.variants?.[0]?.price,
        keyTags: p.tags ? p.tags.split(',').map(t => t.trim()).slice(0, 3) : [], // Example
        // ... or just return 'p' for the full object
    }));
    // Or simply: return paginatedProducts; if the full object structure is acceptable for summary
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('shop') shop: string,
  ) {
    if (!shop) {
       // <<< ADDED validation for shop
      throw new BadRequestException('Shop query parameter is required.');
    }
    // Pass shop to the service method
    const product = await this.productsService.findOne(id, shop);

    // Construct the product URL using the dynamic shop parameter
    const productShopDomain = shop.split('/')[0]; // Assuming shop might contain protocol, get domain part

    return {
      id: product.admin_graphql_api_id,
      name: product.title,
      description: product.body_html,
      // Use productShopDomain for the URL
      url: `https://${productShopDomain}/products/${product.handle}`,
      handle: product.handle,
      brand: { "@type": "Brand", "name": product.vendor },
      productType: product.product_type,
      tags: product.tags ? product.tags.split(',').map(t => t.trim()) : [],
      status: product.status || "active",
      createdAt: product.created_at,
      updatedAt: product.updated_at,
      publishedAt: product.published_at,
      images: product.images.map((img, idx) => ({
        "@type": "ImageObject",
        url: img.src,
        alternateName: product.title,
        position: idx + 1
      })),
      offers: {
        "@type": "AggregateOffer",
        lowPrice: Math.min(...product.variants.map(v => parseFloat(v.price))),
        highPrice: Math.max(...product.variants.map(v => parseFloat(v.price))),
        priceCurrency: product.variants[0]?.currency_code || product.variants[0]?.price_set?.shop_money?.currency_code || "USD", // Adjusted to check common currency fields
        offerCount: product.variants.length,
        offers: product.variants.map(variant => ({
          "@type": "Offer",
          id: variant.admin_graphql_api_id,
          sku: variant.sku,
          name: variant.title,
          price: variant.price,
          priceCurrency: variant.currency_code || variant.price_set?.shop_money?.currency_code || "USD", // Adjusted
          availability: variant.inventory_quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          inventoryLevel: {
            "@type": "QuantitativeValue",
            value: variant.inventory_quantity
          },
          itemCondition: "https://schema.org/NewCondition",
          attributes: product.options.map((opt, i) => ({
            name: opt.name,
            value: variant[`option${i + 1}`]
          })),
          // Use productShopDomain for the variant URL
          url: `https://${productShopDomain}/products/${product.handle}?variant=${variant.id}`
        }))
      }
    };
  }
}
