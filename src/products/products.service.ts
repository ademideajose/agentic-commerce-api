import { Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';

//const SHOP = 'theapparelhouse.myshopify.com';
let ADMIN_API_TOKEN = '';

@Injectable()
export class ProductsService {
  async findAll(shop: string) {
    if (!ADMIN_API_TOKEN) {
      // In a multi-tenant app, you'd fetch the token for the specific 'shop' here
      throw new UnauthorizedException(
        'Access token not available for this shop. Complete OAuth first.',
      );
    }
    const res = await axios.get(
      `https://${shop}/admin/api/2024-04/products.json`,
      {
        headers: {
          'X-Shopify-Access-Token': ADMIN_API_TOKEN,
          'Content-Type': 'application/json',
        },
      },
    );
    return res.data.products;
  }

  async findOne(id: string, shop: string) {
    if (!ADMIN_API_TOKEN) {
      // In a multi-tenant app, you'd fetch the token for the specific 'shop' here
      throw new UnauthorizedException(
        'Access token not available for this shop. Complete OAuth first.',
      );
    }

    const res = await axios.get(
      `https://${shop}/admin/api/2024-04/products/${id}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': ADMIN_API_TOKEN,
          'Content-Type': 'application/json',
        },
      },
    );

    return res.data.product;
  }

  // TEMP: helper to manually set token
  setToken(token: string) {
    console.warn(
      'Setting a global ADMIN_API_TOKEN. This is not suitable for multi-tenancy without further changes for per-shop token management.',
    );
    ADMIN_API_TOKEN = token;
  }
}
