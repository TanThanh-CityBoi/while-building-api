import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { AuthApi, AuthApiUnavailableError } from './auth-api.js';
import type { AuthenticatedUser } from './authenticated-user.js';

const TIMEOUT_MS = 5_000;

/** AuthApi over the While Building API's GET /auth/me. */
@Injectable()
export class HttpAuthApi extends AuthApi {
  private readonly url: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    this.url = `${config.get('API_URL', { infer: true })}/auth/me`;
  }

  async currentUser(accessToken: string): Promise<AuthenticatedUser | null> {
    let response: Response;
    try {
      response = await fetch(this.url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new AuthApiUnavailableError('GET /auth/me failed', {
        cause: error,
      });
    }

    // 401: missing, expired or revoked session; 403: disabled account.
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) {
      throw new AuthApiUnavailableError(
        `GET /auth/me answered ${response.status}`,
      );
    }
    try {
      const { data } = (await response.json()) as { data: AuthenticatedUser };
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
      };
    } catch (error) {
      throw new AuthApiUnavailableError('GET /auth/me returned invalid JSON', {
        cause: error,
      });
    }
  }
}
