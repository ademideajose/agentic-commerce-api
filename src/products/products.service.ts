// src/products/products.service.ts
import {
  Injectable,
  UnauthorizedException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { TokenStorageService } from '../auth/token-storage.service'; // <<< Adjust path as needed

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

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

  async findAll(shop: string): Promise<any[]> {
    const headers = await this.getShopifyHeaders(shop);
    try {
      const response = await axios.get(
        `https://${shop}/admin/api/2024-04/products.json`, // Use your target API version
        { headers },
      );

      // <<< --- TEMPORARY LOGGING for findAll --- >>>
      if (response.data.products && response.data.products.length > 0) {
        this.logger.debug(
          'Raw product data from Shopify (findAll - first product): ' +
            JSON.stringify(response.data.products[0], null, 2),
        );
        const firstProduct = response.data.products[0];
        this.logger.debug(
          'Product admin_graphql_api_id (findAll): ' +
            firstProduct.admin_graphql_api_id,
        );
        if (firstProduct.variants && firstProduct.variants.length > 0) {
          this.logger.debug(
            'Variant admin_graphql_api_id (findAll - first variant of first product): ' +
              firstProduct.variants[0].admin_graphql_api_id,
          );
        }
      }
      // <<< --- END TEMPORARY LOGGING --- >>>

      return response.data.products || [];
    } catch (error) {
      this.logger.error(
        `Error fetching products for ${shop}: ${error.message}`,
        error.stack,
      );
      if (error.response?.status === 401)
        throw new UnauthorizedException(
          'Shopify token invalid or insufficient scope.',
        );
      throw error; // Re-throw other errors
    }
  }

  async findOne(productId: string, shop: string): Promise<any> {
    const headers = await this.getShopifyHeaders(shop);
    try {
      // Assuming productId is the Shopify REST ID here. If it's GID, adjust the URL or use GraphQL.
      // The blueprint's path /products/{productId} usually implies it's your system's ID or GID.
      // Your controller logic transforms GID from path to use with REST API.
      // If 'productId' is Shopify's REST API ID:
      const response = await axios.get(
        `https://<span class="math-inline">\{shop\}/admin/api/2024\-04/products/</span>{productId}.json`, // Use your target API version
        { headers },
      );

      // <<< --- TEMPORARY LOGGING for findOne --- >>>
      if (response.data.product) {
        this.logger.debug(
          'Raw product data from Shopify (findOne): ' +
            JSON.stringify(response.data.product, null, 2),
        );
        this.logger.debug(
          'Product admin_graphql_api_id (findOne): ' +
            response.data.product.admin_graphql_api_id,
        );
        if (
          response.data.product.variants &&
          response.data.product.variants.length > 0
        ) {
          this.logger.debug(
            'Variant admin_graphql_api_id (findOne - first variant): ' +
              response.data.product.variants[0].admin_graphql_api_id,
          );
        }
      }
      // <<< --- END TEMPORARY LOGGING --- >>>

      if (!response.data.product)
        throw new NotFoundException(
          `Product ${productId} not found on shop ${shop}`,
        );
      return response.data.product;
    } catch (error) {
      this.logger.error(
        `Error fetching product ${productId} for ${shop}: ${error.message}`,
        error.stack,
      );
      if (error.response?.status === 401)
        throw new UnauthorizedException(
          'Shopify token invalid or insufficient scope.',
        );
      if (error.response?.status === 404)
        throw new NotFoundException(
          `Product ${productId} not found on shop ${shop}`,
        );
      throw error;
    }
  }
}
