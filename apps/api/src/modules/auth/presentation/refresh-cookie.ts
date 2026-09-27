import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { EnvironmentVariables } from '../../../config/env.validation.js';

export const REFRESH_COOKIE_NAME = 'wb_refresh';
/** Only sent to /auth/* (refresh and logout), never to other API routes. */
export const REFRESH_COOKIE_PATH = '/auth';

/** Reads, sets and clears the httpOnly refresh-token cookie. */
@Injectable()
export class RefreshCookie {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  read(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[REFRESH_COOKIE_NAME];
    return typeof value === 'string' && value !== '' ? value : undefined;
  }

  set(response: Response, refreshToken: string): void {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...this.options(),
      maxAge: this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true }) * 1000,
    });
  }

  clear(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, this.options());
  }

  private options(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: this.config.get('COOKIE_SAME_SITE', { infer: true }),
      domain: this.config.get('COOKIE_DOMAIN', { infer: true }),
      path: REFRESH_COOKIE_PATH,
    };
  }
}
