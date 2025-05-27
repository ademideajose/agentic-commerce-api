import { Controller, Post, Body } from '@nestjs/common';
import { ProductsService } from '../products/products.service';

@Controller('agent-api/suggest')
export class SuggestController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  async suggest(@Body() body: any) {
    const allProducts = await this.productsService.findAll();
    const { intent, context, constraints } = body;
    const matches = allProducts.filter((product) => {
      const tags = product.tags?.map((t) => t.toLowerCase()) || [];
      const title = product.title.toLowerCase();
      const price = parseFloat(product.variants?.[0]?.price || '0');
      if (intent === 'gift_idea') {
        return (
          price <= constraints?.max_price &&
          tags.includes('skincare') &&
          tags.includes('giftable')
        );
      }

      if (intent === 'product_search') {
        const keyword = context?.keyword?.toLowerCase();
        const keywordMatch =
          title.includes(keyword) ||
          tags.some((t) =>
            keyword?.split(' ').every((word) => t.includes(word)),
          );

        return price <= constraints?.max_price && keywordMatch;
      }

      if (intent === 'travel_capsule') {
        return tags.some((t) => ['travel', 'capsule', 'versatile'].includes(t));
      }
      return false;
    });

    return {
      products: matches.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.body_html,
        image: p.image?.src,
        price: p.variants?.[0]?.price,
        vendor: p.vendor,
        tags: p.tags,
        product_type: p.product_type,
        available: p.status === 'active',
        url: `https://theapparelhouse.myshopify.com/products/${p.handle}`,
        matched_on: [intent],
      })),
    };
  }
}
