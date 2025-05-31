import {
  Controller,
  Post,
  Body,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyAuthGuard } from './auth/auth.guard';

@Controller('checkouts')
export class CheckoutController {
  @Post()
  @UseGuards(ApiKeyAuthGuard)
  async createCheckout(@Query('shop') shop: string, @Body() body: any) {
    const { lineItems, discountCode, note, customerEmail } = body;

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
        // Ensure variantId is just the ID number for cart permalinks
        const variantIdNumber = String(item.variantId).includes('/')
          ? String(item.variantId).split('/').pop()
          : item.variantId;
        const encodedVariantId = encodeURIComponent(variantIdNumber);
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
