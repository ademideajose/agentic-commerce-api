// src/auth/auth.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import axios from 'axios';
import { TokenStorageService } from './token-storage.service';

interface ShopifyInitDto {
  shop: string;
  accessToken: string;
  scopes: string;
}

@Controller('auth') // Will be /agent-api/auth due to global prefix in main.ts
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenStorageService: TokenStorageService,
  ) {}

  @Get() // path is /agent-api/auth
  async startOAuth(@Query('shop') shop: string, @Res() res: Response) {
    if (!shop) {
      throw new BadRequestException('Shop query parameter is required.');
    }
    const clientId = this.configService.get<string>('SHOPIFY_API_KEY'); // For this NestJS App
    const scopes = this.configService.get<string>('SCOPES_NESTJS_APP'); // Scopes this NestJS App needs (e.g., read_products,write_checkouts)
    const appUrl = this.configService.get<string>('AGENTIC_COMMERCE_API_URL'); // Base URL of this NestJS App (e.g., https://agentic-commerce-api.onrender.com)

    // Callback will be /agent-api/auth/callback because of global prefix
    const redirectUri = `${appUrl}/agent-api/auth/callback`;

    // State parameter for CSRF protection and potentially passing info
    // In a production app, you'd generate a secure random nonce for 'state', store it (e.g., in session or short-lived cache),
    // and then verify it on callback. For simplicity in MVP, we're just creating it.
    const state = `nonce_${Date.now()}_${shop}`; // Example state including shop (can be used for verification)

    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    this.logger.log(
      `Redirecting to Shopify OAuth for shop ${shop}: ${authUrl}`,
    );
    res.redirect(authUrl);
  }

  @Get('callback') // path is /agent-api/auth/callback
  async handleCallback(
    @Query('code') code: string,
    @Query('shop') shopFromShopify: string, // Shopify sends 'shop' on callback
    @Query('state') receivedState: string, // The 'state' parameter you sent
    @Res() res: Response,
  ) {
    // TODO: Implement proper 'state' validation against a stored nonce to prevent CSRF.
    // For an MVP, you might log it or do a basic check if you embedded identifiable info.
    // Example (very basic, assumes shop was part of state for cross-check, but real CSRF protection is more):
    // const expectedShopFromState = receivedState.split('_').pop();
    // if (!receivedState || !expectedShopFromState || shopFromShopify !== expectedShopFromState) {
    //   this.logger.error(`State mismatch or missing. Received shop: ${shopFromShopify}, state: ${receivedState}`);
    //   throw new BadRequestException('Invalid state or shop parameter mismatch.');
    // }
    this.logger.log(
      `Received callback for shop: ${shopFromShopify} with state: ${receivedState}`,
    );
    const shop = shopFromShopify; // Use the shop parameter directly from Shopify's callback

    if (!code || !shop) {
      throw new BadRequestException('Missing code or shop in callback.');
    }

    const clientId = this.configService.get<string>('SHOPIFY_API_KEY'); // For this NestJS App
    const clientSecret = this.configService.get<string>('SHOPIFY_API_SECRET'); // For this NestJS App

    try {
      const tokenResponse = await axios.post(
        `https://${shop}/admin/oauth/access_token`,
        { client_id: clientId, client_secret: clientSecret, code },
      );

      const accessToken = tokenResponse.data.access_token;
      const receivedScopes = tokenResponse.data.scope;

      this.logger.log(
        `✅ Access Token obtained for ${shop}. Scopes: ${receivedScopes}`,
      );
      await this.tokenStorageService.saveToken(
        shop,
        accessToken,
        receivedScopes,
      );
      this.logger.log(`Token for ${shop} securely stored.`);

      // Redirect to a success page or convey success to the user who authorized
      res.send(
        `OAuth successful for ${shop}. Token stored. Your application is now authorized. You can close this window.`,
      );
    } catch (error) {
      this.logger.error(
        `Error obtaining access token for ${shop}: ${error.message}`,
        error.response?.data, // Log the full error data from Shopify if available
      );
      const errorDescription =
        error.response?.data?.error_description ||
        error.response?.data?.error ||
        'Unknown error during token exchange.';
      throw new BadRequestException(
        `Failed to obtain access token for ${shop}. Shopify error: ${errorDescription}`,
      );
    }
  }

  @Post('shopify/init') // path is /agent-api/auth/shopify/init
  @HttpCode(HttpStatus.OK)
  async handleShopifyInit(
    @Body() shopifyInitDto: ShopifyInitDto,
  ): Promise<{ message: string }> {
    const { shop, accessToken, scopes } = shopifyInitDto; // accessToken from Shopify App is received
    if (!shop || !accessToken || !scopes) {
      // <<< Validate all three
      throw new BadRequestException(
        'Shop, accessToken, and scopes are required in the request body.',
      );
    }

    this.logger.log(
      `Received Shopify init POST for shop: ${shop}. Scopes: ${scopes}. Token (length: ${accessToken?.length}) received from Shopify app.`,
    );

    try {
      await this.tokenStorageService.saveToken(shop, accessToken, scopes);
      this.logger.log(
        `Token for ${shop} (from Shopify app init) has been successfully stored/updated.`,
      );
      return {
        message: `Shopify init successful for shop: ${shop}. Token and scopes stored.`,
      };
    } catch (error) {
      this.logger.error(
        `Error storing token during Shopify init for ${shop}: ${error.message}`,
        error.stack,
      );
      // Don't rethrow sensitive errors directly.
      throw new BadRequestException(
        `Could not process Shopify initialization for ${shop}.`,
      );
    }
  }
}
