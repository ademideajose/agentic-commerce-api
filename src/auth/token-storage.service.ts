// src/auth/token-storage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopAuth } from '@prisma/client';

@Injectable()
export class TokenStorageService {
  private readonly logger = new Logger(TokenStorageService.name);

  // In-memory cache for domain mappings
  private domainMappings = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves frontend domain to backend domain
   * @param inputDomain - Could be either frontend or backend domain
   * @returns Backend domain that exists in database
   */
  async resolveDomain(inputDomain: string): Promise<string | null> {
    this.logger.debug(`🔍 Resolving domain: ${inputDomain}`);

    // Check cache first
    if (this.domainMappings.has(inputDomain)) {
      const resolved = this.domainMappings.get(inputDomain)!;
      this.logger.debug(`📋 Cache hit: ${inputDomain} → ${resolved}`);
      return resolved;
    }

    // Try direct lookup (input might already be backend domain)
    // Use skipResolution=true to prevent infinite loop
    const directToken = await this.getToken(inputDomain, true);

    if (directToken) {
      this.logger.debug(`✅ Direct match found for: ${inputDomain}`);
      // Cache the identity mapping
      this.domainMappings.set(inputDomain, inputDomain);
      return inputDomain;
    }

    // Try to find by pattern matching
    // Example: theeapparelstore.myshopify.com → 1ekhav-v7.myshopify.com
    const allShops = await this.prisma.shopAuth.findMany({
      where: { isActive: true },
      select: { shop: true },
    });

    // Look for pattern matches
    for (const shopRecord of allShops) {
      const backendDomain = shopRecord.shop;

      // Try to derive what the frontend domain might be
      // Common pattern: remove the version suffix like "-v7"
      const potentialFrontend = backendDomain.replace(/-v\d+/, '');

      if (potentialFrontend === inputDomain) {
        this.logger.log(
          `🎯 Pattern match found: ${inputDomain} → ${backendDomain}`,
        );
        // Cache both directions
        this.domainMappings.set(inputDomain, backendDomain);
        this.domainMappings.set(backendDomain, backendDomain);
        return backendDomain;
      }
    }

    this.logger.warn(`❌ No domain mapping found for: ${inputDomain}`);
    return null;
  }

  /**
   * Store domain mapping when we learn about it
   */
  async storeDomainMapping(
    frontendDomain: string,
    backendDomain: string,
  ): Promise<void> {
    this.logger.log(
      `📝 Storing domain mapping: ${frontendDomain} → ${backendDomain}`,
    );
    this.domainMappings.set(frontendDomain, backendDomain);
    this.domainMappings.set(backendDomain, backendDomain); // Identity mapping
  }

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
      // Store identity mapping for backend domain
      this.domainMappings.set(shop, shop);

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

      // Try domain resolution
      const resolvedDomain = await this.resolveDomain(host);
      return !!resolvedDomain; // true ⇒ allow CORS
    } catch (err) {
      this.logger.error(`CORS check failed for ${origin}: ${err.message}`);
      return false; // default-deny on parse / DB errors
    }
  }
  async getToken(
    shop: string,
    skipResolution: boolean = false,
  ): Promise<string | null> {
    this.logger.debug(`Attempting to retrieve token for shop: ${shop}`);

    let searchDomain = shop;

    // Only do domain resolution if not already resolved
    if (!skipResolution) {
      const resolvedDomain = await this.resolveDomain(shop);
      searchDomain = resolvedDomain || shop;
    }

    const shopAuthRecord = await this.prisma.shopAuth.findFirst({
      where: { shop: searchDomain, isActive: true },
    });

    if (shopAuthRecord) {
      this.logger.debug(`Token found for shop: ${searchDomain}`);
      return shopAuthRecord.accessToken;
    }
    this.logger.warn(`No active token found for shop: ${shop}`);
    return null;
  }

  async deactivateToken(shop: string): Promise<ShopAuth | null> {
    this.logger.log(`Deactivating token for shop: ${shop}`);

    const resolvedDomain = await this.resolveDomain(shop);
    const searchDomain = resolvedDomain || shop;

    try {
      return await this.prisma.shopAuth.update({
        where: { shop: searchDomain },
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
