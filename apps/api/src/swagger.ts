import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { REFRESH_COOKIE_NAME } from './modules/auth/presentation/refresh-cookie.js';

/** OpenAPI docs at /docs (UI) and /docs-json. Enabled by SWAGGER_ENABLED. */
export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('While Building API')
      .setDescription(
        [
          'Things I build, things I learn, things I break.',
          '',
          'Authentication: `POST /auth/login` returns a short-lived access token (send it as',
          '`Authorization: Bearer <token>`) and sets an httpOnly refresh cookie used by',
          '`POST /auth/refresh` and `POST /auth/logout`. Every route requires a valid access',
          'token unless documented otherwise; user and CMS routes also require the listed permission.',
          'Public content routes (`/articles`, `/projects`) need no token and only return published',
          'content; the CMS manages articles in every status under `/content/articles`.',
          '',
          'Roles → permissions: ROOT and ADMIN have all permissions; EDITOR has CONTENT_READ,',
          'CONTENT_CREATE, CONTENT_UPDATE, CONTENT_PUBLISH; AUTHOR has CONTENT_READ,',
          'CONTENT_CREATE, CONTENT_UPDATE.',
        ].join('\n'),
      )
      .setVersion('0.2.0')
      .addBearerAuth()
      .addCookieAuth(REFRESH_COOKIE_NAME)
      .build(),
  );
  SwaggerModule.setup('docs', app, document);
}
