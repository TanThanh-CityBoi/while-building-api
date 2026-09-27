import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/**
 * Opts a route (or controller) out of the global AccessTokenGuard. Every route
 * requires authentication unless it is explicitly marked public.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
