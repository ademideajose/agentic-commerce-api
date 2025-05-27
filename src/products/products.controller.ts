
import { Controller, Get, Query, Param } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(
    @Query('q') q?: string,
    @Query('price_min') priceMin?: number,
    @Query('price_max') priceMax?: number,
    @Query('tags_includeany') tagsIncludeAny?: string,
    @Query('in_stock') inStock?: string // Accept as string for boolean parsing
  ) {
    const products = await this.productsService.findAll();
    const filters = {
      q: q?.toLowerCase(),
      priceMin: priceMin ? Number(priceMin) : null,
      priceMax: priceMax ? Number(priceMax) : null,
      tags: tagsIncludeAny ? tagsIncludeAny.toLowerCase().split(',') : [],
      inStock: inStock === 'true'
    };

    const filtered = products.filter((product) => {
      const title = product.title?.toLowerCase() || '';
      const description = product.body_html?.toLowerCase() || '';
      const tags = (product.tags || '').toLowerCase().split(',').map(t => t.trim());
      const variants = product.variants || [];
      const prices = variants.map(v => parseFloat(v.price));
      const hasStock = variants.some(v => v.inventory_quantity > 0);

      const matchesQ = !filters.q || title.includes(filters.q) || description.includes(filters.q);
      const matchesTags = !filters.tags.length || filters.tags.some(tag => tags.includes(tag));
      const matchesPriceMin = filters.priceMin === null || prices.some(p => p >= filters.priceMin);
      const matchesPriceMax = filters.priceMax === null || prices.some(p => p <= filters.priceMax);
      const matchesStock = inStock === undefined || filters.inStock === hasStock;

      return matchesQ && matchesTags && matchesPriceMin && matchesPriceMax && matchesStock;
    });

    return filtered;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const product = await this.productsService.findOne(id);

    return {
      id: product.admin_graphql_api_id,
      name: product.title,
      description: product.body_html,
      url: `https://${product.handle ? product.handle + '/' : ''}`,
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
        priceCurrency: product.variants[0]?.currency || "USD",
        offerCount: product.variants.length,
        offers: product.variants.map(variant => ({
          "@type": "Offer",
          id: variant.admin_graphql_api_id,
          sku: variant.sku,
          name: variant.title,
          price: variant.price,
          priceCurrency: variant.currency || "USD",
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
          url: `https://${product.handle}?variant=${variant.id}`
        }))
      }
    };
  }
}
