import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import axios from 'axios';
import { ProductsService } from '../products/products.service';

//const SHOP = 'theapparelhouse.myshopify.com';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly productsService: ProductsService, // Ensure ProductsService is correctly typed if you changed its setToken method
  ) {}

  @Get()
  async startOAuth(
    @Query('shop') shop: string, // <<< ADDED shop query parameter
    @Res() res: Response,
  ) {
    if (!shop) { // <<< ADDED validation for shop
      throw new BadRequestException(
        'Shop query parameter is required to start OAuth.',
      );
    }

    const clientId = this.configService.get<string>('SHOPIFY_API_KEY');
    const scopes = this.configService.get<string>('SCOPES');
    const appUrl = this.configService.get<string>('SHOPIFY_APP_URL');
    // Pass shop in the state or as part of redirect_uri to retrieve in callback
    const redirectUri = `${appUrl}/agent-api/auth/callback?shop=${encodeURIComponent(shop)}`; // <<< MODIFIED to include shop

    const url = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}`;
    console.log(`🔍 Redirecting to: ${url} for shop: ${shop}`);
    return res.redirect(url);
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('shop') shop: string, // <<< ADDED shop query parameter (retrieved from redirect)
    @Res() res: Response
  ) {
    if (!code || !shop) { // <<< ADDED validation
      throw new BadRequestException('Missing code or shop in callback.');
    }

    const clientId = this.configService.get<string>('SHOPIFY_API_KEY');
    const clientSecret = this.configService.get<string>('SHOPIFY_API_SECRET');

    try {
      const tokenRes = await axios.post(
        `https://${shop}/admin/oauth/access_token`, // <<< Use dynamic shop
        {
          client_id: clientId,
          client_secret: clientSecret,
          code,
        },
      );

      const accessToken = tokenRes.data.access_token;
      console.log(`✅ Access Token for ${shop}: ${accessToken}`);

      // 🔐 Save token in service (or a more persistent store for multi-tenancy)
      // For now, assuming productsService.setToken might be adapted or this logic will change.
      // If ProductsService.setToken is not shop-aware yet, this will overwrite the global token.
      // This needs to be addressed for true multi-tenancy.
      this.productsService.setToken(accessToken); // Or this.productsService.setTokenForShop(shop, accessToken);
      // For now, the global token in ProductService is being set.
      // In a real multi-tenant app, you would store this token associated with the 'shop'
      // e.g., in a database: await shopTokenStorage.saveToken(shop, accessToken);

      return res.send(
        `OAuth successful for ${shop}. Access Token has been (globally) set. In a multi-tenant app, this token would be stored securely for this shop.`,
      );
    } catch (error) {
      console.error(
        `Error obtaining access token for ${shop}:`,
        error.response?.data || error.message,
      );
      throw new BadRequestException(
        `Failed to obtain access token for ${shop}.`,
      );
    }
  }
}