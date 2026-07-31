import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedUser } from './auth.guard';
import { AuthService } from './auth.service';

type RequestWithUser = {
  headers: Record<string, string | string[] | undefined>;
  user: AuthenticatedUser;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: unknown, @Req() request: RequestWithUser, @Res({ passthrough: true }) response: unknown) {
    return this.authService.login((body ?? {}) as Record<string, unknown>, request, response as any);
  }

  @Post('logout')
  logout(@Req() request: RequestWithUser, @Res({ passthrough: true }) response: unknown) {
    return this.authService.logout(request, response as any);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() request: RequestWithUser) {
    return this.authService.me(request.user);
  }

  @UseGuards(AuthGuard)
  @Post('change-password')
  changePassword(
    @Body() body: unknown,
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: unknown,
  ) {
    return this.authService.changePassword(
      request.user.id,
      (body ?? {}) as Record<string, unknown>,
      response as any,
    );
  }
}
