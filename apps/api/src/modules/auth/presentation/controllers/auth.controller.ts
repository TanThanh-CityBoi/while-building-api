import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../application/dto/authenticated-user.js';
import { InvalidSessionError } from '../../application/errors/auth.errors.js';
import { GetCurrentUserUseCase } from '../../application/use-cases/get-current-user.use-case.js';
import { LoginUseCase } from '../../application/use-cases/login.use-case.js';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case.js';
import { RefreshSessionUseCase } from '../../application/use-cases/refresh-session.use-case.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { Public } from '../decorators/public.decorator.js';
import {
  AuthUserResponseDto,
  LoginResponseDto,
  TokenResponseDto,
} from '../dto/auth-response.dto.js';
import { LoginDto } from '../dto/login.dto.js';
import { REFRESH_COOKIE_NAME, RefreshCookie } from '../refresh-cookie.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logout: LogoutUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly refreshCookie: RefreshCookie,
  ) {}

  /** Signs in. Sets the httpOnly refresh cookie and returns a short-lived access token. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  @ApiTooManyRequestsResponse({ description: 'Too many sign-in attempts.' })
  async signIn(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const { refreshToken, ...result } = await this.login.execute(dto);
    this.refreshCookie.set(response, refreshToken);
    return result;
  }

  /** Issues a new access token from the refresh cookie and rotates the cookie. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked session.',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TokenResponseDto> {
    try {
      const { refreshToken, ...result } = await this.refreshSession.execute(
        this.refreshCookie.read(request),
      );
      if (refreshToken) this.refreshCookie.set(response, refreshToken);
      return result;
    } catch (error) {
      // Don't leave a dead cookie behind.
      if (error instanceof InvalidSessionError)
        this.refreshCookie.clear(response);
      throw error;
    }
  }

  /** Ends the current session and clears the cookie. Always succeeds. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiNoContentResponse({
    description: 'Signed out (also when there was no session).',
  })
  async signOut(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.logout.execute(this.refreshCookie.read(request));
    this.refreshCookie.clear(response);
  }

  /** The signed-in user and their permissions. */
  @Get('me')
  @ApiBearerAuth()
  async me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuthUserResponseDto> {
    return { data: await this.getCurrentUser.execute(user.id) };
  }
}
