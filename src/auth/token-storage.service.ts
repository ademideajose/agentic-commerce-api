// src/auth/token-storage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopAuth } from '@prisma/client';

@Injectable()
export class TokenStorageService {
  private readonly logger = new Logger(TokenStorageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveToken(
    shop: string,
    accessToken: string,
    scopes?: string,
  ): Promise<ShopAuth> {
    this.logger.log(
      `Attempting to save/update token for shop: ${shop} with scopes: ${scopes}`,
    );

    try {
      const result: ShopAuth = await this.prisma.shopAuth.upsert({
        where: { shop },
        update: { accessToken, scopes, isActive: true },
        create: { shop, accessToken, scopes, isActive: true },
      });
      this.logger.log(
        `Token for shop ${shop} successfully upserted. Result ID: ${result.id}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error saving/updating token for shop: ${shop}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
  async debugTokenRetrieval(shop: string): Promise<any> {
    this.logger.log(`🔍 Debug: Checking token for shop: ${shop}`);

    try {
      // Get all records
      const allRecords = await this.prisma.shopAuth.findMany();
      this.logger.log(
        `📊 Found ${allRecords.length} total records in database`,
      );

      // Try to get the specific token
      const token = await this.getToken(shop);
      this.logger.log(`🎯 Token for ${shop}: ${token ? 'FOUND' : 'NOT FOUND'}`);

      return {
        shop,
        tokenFound: !!token,
        tokenPreview: token ? token.substring(0, 10) + '...' : null,
        allRecords: allRecords.map((r) => ({
          shop: r.shop,
          isActive: r.isActive,
          hasToken: !!r.accessToken,
          createdAt: r.createdAt,
          tokenPreview: r.accessToken
            ? r.accessToken.substring(0, 10) + '...'
            : null,
        })),
      };
    } catch (error) {
      this.logger.error(`❌ Debug error: ${error.message}`);
      throw error;
    }
  }
  async isKnownStorefront(origin: string): Promise<boolean> {
    try {
      // Strip protocol → widgets-store.myshopify.com
      const host = new URL(origin).hostname;

      // Look up an active record for that domain
      const record = await this.prisma.shopAuth.findFirst({
        where: { shop: host, isActive: true },
      });

      return !!record; // true ⇒ allow CORS
    } catch (err) {
      this.logger.error(`CORS check failed for ${origin}: ${err.message}`);
      return false; // default-deny on parse / DB errors
    }
  }
  async getToken(shop: string): Promise<string | null> {
    this.logger.debug(`Attempting to retrieve token for shop: ${shop}`);
    const shopAuthRecord = await this.prisma.shopAuth.findFirst({
      where: { shop, isActive: true },
    });
    if (shopAuthRecord) {
      this.logger.debug(`Token found for shop: ${shop}`);
      return shopAuthRecord.accessToken;
    }
    this.logger.warn(`No active token found for shop: ${shop}`);
    return null;
  }

  async deactivateToken(shop: string): Promise<ShopAuth | null> {
    this.logger.log(`Deactivating token for shop: ${shop}`);
    try {
      return await this.prisma.shopAuth.update({
        where: { shop },
        data: { isActive: false, accessToken: `DEACTIVATED_${Date.now()}` },
      });
    } catch (error) {
      // Prisma throws specific errors for not found, e.g., PrismaClientKnownRequestError with code P2025
      this.logger.error(
        `Error deactivating token for ${shop}: ${error.message}`,
      );
      return null;
    }
  }

  async getAllRecords(): Promise<ShopAuth[]> {
    return this.prisma.shopAuth.findMany();
  }
}
