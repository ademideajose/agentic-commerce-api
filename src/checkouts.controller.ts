import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import axios from 'axios';

@Controller('checkouts')
export class CheckoutController {
  @Post()
  async createCheckout(@Body() body: any) {
    const { shop, lineItems, discountCode, note, customerEmail } = body;

    if (
      !shop ||
      !lineItems ||
      !Array.isArray(lineItems) ||
      lineItems.length === 0
    ) {
      throw new BadRequestException('Missing required fields: shop, lineItems');
    }

    const cartQuery = lineItems
      .map((item) => {
        const encodedVariantId = encodeURIComponent(item.variantId);
        return `${encodedVariantId}:${item.quantity}`;
      })
      .join(',');

    const baseUrl = `https://${shop}/cart/${cartQuery}`;

    const params = new URLSearchParams();
    if (discountCode) params.append('discount', discountCode);
    if (note) params.append('note', note);
    if (customerEmail) params.append('checkout[email]', customerEmail);

    const checkoutUrl = params.toString()
      ? `${baseUrl}?${params.toString()}`
      : baseUrl;

    return { checkoutUrl };
  }
}
