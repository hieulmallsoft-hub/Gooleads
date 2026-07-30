import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GoogleAuth } from 'google-auth-library';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { GoogleAdsAccountEntity } from '../database/entities/google-ads-account.entity';

type GoogleAdsConfig = {
  developerToken: string;
  loginCustomerId?: string;
  defaultCustomerId?: string;
  keyFilePath: string;
  apiVersion: string;
};

@Injectable()
export class GoogleAdsApiService {
  private readonly config = this.loadConfig();

  constructor(private readonly dataSource: DataSource) {}

  async mutateAds(customerId: string, operations: any[]) {
    return this.requestGoogleAds(customerId, 'ads:mutate', { operations });
  }

  async mutateAssets(customerId: string, operations: any[]) {
    return this.requestGoogleAds(customerId, 'assets:mutate', { operations });
  }

  async search(customerId: string, query: string) {
    return this.requestGoogleAds(customerId, 'googleAds:search', { query });
  }

  async searchAll(customerId: string, query: string) {
    const results: any[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.requestGoogleAds(customerId, 'googleAds:search', {
        query,
        ...(pageToken ? { pageToken } : {}),
      });
      results.push(...(response.results ?? []));
      pageToken = response.nextPageToken || undefined;
    } while (pageToken);

    return { results };
  }

  private async requestGoogleAds(customerId: string, path: string, payload: unknown) {
    const targetCustomerId = this.normalizeCustomerId(customerId) ?? customerId;
    const loginCustomerId = await this.resolveLoginCustomerId(targetCustomerId);
    const auth = new GoogleAuth({
      keyFile: this.config.keyFilePath,
      scopes: ['https://www.googleapis.com/auth/adwords'],
    });
    let accessToken: Awaited<ReturnType<Awaited<ReturnType<typeof auth.getClient>>['getAccessToken']>>;

    try {
      const client = await auth.getClient();
      accessToken = await client.getAccessToken();
    } catch (error) {
      throw new InternalServerErrorException({
        message: `Google Ads auth failed: ${this.formatRuntimeError(error)}`,
      });
    }

    if (!accessToken.token) {
      throw new InternalServerErrorException('Could not get Google access token');
    }

    const url = `https://googleads.googleapis.com/${this.config.apiVersion}/customers/${targetCustomerId}/${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json',
      'developer-token': this.config.developerToken,
    };
    if (loginCustomerId) {
      headers['login-customer-id'] = loginCustomerId;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new InternalServerErrorException({
          message: this.formatGoogleAdsError(body),
          status: response.status,
          details: body,
        });
      }

      return body;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: `Could not reach Google Ads API: ${this.formatRuntimeError(error)}`,
      });
    }
  }

  private loadConfig(): GoogleAdsConfig {
    const configPath = resolve(
      process.cwd(),
      process.env.GOOGLE_ADS_CONFIG_PATH ??
        '../GoogleAds_extracted/GooogleAds/google-ads.yaml',
    );
    const yamlConfig = existsSync(configPath) ? this.readSimpleYaml(configPath) : {};
    const keyFilePath =
      process.env.GOOGLE_ADS_KEY_FILE ??
      yamlConfig.json_key_file_path ??
      '../GoogleAds_extracted/GooogleAds/key.json';

    const resolvedKeyFilePath = isAbsolute(keyFilePath)
      ? keyFilePath
      : resolve(dirname(configPath), keyFilePath);

    const developerToken =
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? yamlConfig.developer_token;

    if (!developerToken) {
      throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN or developer_token in google-ads.yaml');
    }

    if (!existsSync(resolvedKeyFilePath)) {
      throw new Error(`Google Ads key file not found: ${resolvedKeyFilePath}`);
    }

    return {
      developerToken,
      loginCustomerId: this.normalizeCustomerId(
        process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ??
          process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID ??
          process.env.GOOGLE_ADS_MCC_CUSTOMER_ID ??
          yamlConfig.login_customer_id,
      ),
      defaultCustomerId: this.normalizeCustomerId(
        process.env.DEFAULT_GOOGLE_ADS_CUSTOMER_ID ?? '9920642691',
      ),
      keyFilePath: resolvedKeyFilePath,
      apiVersion: process.env.GOOGLE_ADS_API_VERSION ?? 'v22',
    };
  }

  private async resolveLoginCustomerId(customerId: string) {
    const targetCustomerId = this.normalizeCustomerId(customerId);
    const account = targetCustomerId
      ? await this.dataSource
          .getRepository(GoogleAdsAccountEntity)
          .findOneBy({ customerId: targetCustomerId })
      : null;
    const accountLoginCustomerId = this.normalizeCustomerId(account?.loginCustomerId);

    if (accountLoginCustomerId) {
      return accountLoginCustomerId;
    }

    if (this.config.loginCustomerId) {
      return this.config.loginCustomerId;
    }

    if (this.config.defaultCustomerId && this.config.defaultCustomerId !== targetCustomerId) {
      return this.config.defaultCustomerId;
    }

    return undefined;
  }

  private readSimpleYaml(path: string): Record<string, string> {
    return readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .reduce<Record<string, string>>((config, line) => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) {
          return config;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
        config[key] = value;
        return config;
      }, {});
  }

  private formatRuntimeError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private formatGoogleAdsError(body: any) {
    const baseMessage = String(body?.error?.message ?? 'Google Ads API request failed');
    const errors = body?.error?.details
      ?.flatMap((detail: any) => detail?.errors ?? [])
      ?.map((error: any) => {
        const errorCode = error?.errorCode
          ? Object.entries(error.errorCode)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ')
          : '';
        const fieldPath = error?.location?.fieldPathElements
          ?.map((field: any) =>
            field?.index === undefined ? field?.fieldName : `${field?.fieldName}[${field.index}]`,
          )
          ?.filter(Boolean)
          ?.join('.');
        return [error?.message, errorCode, fieldPath ? `Field: ${fieldPath}` : '']
          .filter(Boolean)
          .join(' | ');
      })
      ?.filter(Boolean);

    return errors?.length ? `${baseMessage}: ${errors.join(' / ')}` : baseMessage;
  }

  private normalizeCustomerId(value: string | null | undefined) {
    const normalized = String(value ?? '').replace(/\D/g, '');
    return /^\d{10}$/.test(normalized) ? normalized : undefined;
  }
}
