import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import axios from 'axios';
import { ProductsService } from '../products/products.service';

const SHOP = 'theapparelhouse.myshopify.com';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly productsService: ProductsService,
  ) {}

  @Get()
  async startOAuth(@Res() res: Response) {
    const clientId = this.configService.get<string>('SHOPIFY_API_KEY');
    const scopes = this.configService.get<string>('SCOPES');
    const appUrl = this.configService.get<string>('SHOPIFY_APP_URL');
    const redirectUri = `${appUrl}/agent-api/auth/callback`;
    const url = `https://${SHOP}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}`;
    console.log('🔍 Redirecting to:', url);
    return res.redirect(url);
  }

  @Get('callback')
  async handleCallback(@Query('code') code: string, @Res() res: Response) {
    const clientId = this.configService.get<string>('SHOPIFY_API_KEY');
    const clientSecret = this.configService.get<string>('SHOPIFY_API_SECRET');

    const tokenRes = await axios.post(
      `https://${SHOP}/admin/oauth/access_token`,
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
      },
    );

    const accessToken = tokenRes.data.access_token;
    console.log('✅ Access Token:', accessToken);

    // 🔐 Save token in service
    this.productsService.setToken(accessToken);
    return res.send(`Access Token set and ready to fetch products.`);
  }
}
