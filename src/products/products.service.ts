import { Injectable } from '@nestjs/common';
import axios from 'axios';

const SHOP = 'theapparelhouse.myshopify.com';
let ADMIN_API_TOKEN = '';

@Injectable()
export class ProductsService {
  async findAll() {
    if (!ADMIN_API_TOKEN) {
      throw new Error('Access token not available. Complete OAuth first.');
    }
    const res = await axios.get(
      `https://${SHOP}/admin/api/2024-04/products.json`,
      {
        headers: {
          'X-Shopify-Access-Token': ADMIN_API_TOKEN,
          'Content-Type': 'application/json',
        },
      },
    );
    return res.data.products;
  }

  async findOne(id: string) {
    if (!ADMIN_API_TOKEN) {
      throw new Error('Access token not available. Complete OAuth first.');
    }

    const res = await axios.get(
      `https://${SHOP}/admin/api/2024-04/products/${id}.json`,
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
    ADMIN_API_TOKEN = token;
  }
}
