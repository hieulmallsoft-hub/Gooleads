import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedUser } from './auth.guard';
import { AuthService } from './auth.service';
import { RequirePermissions } from './permissions.decorator';

@UseGuards(AuthGuard)
@RequirePermissions('users.manage')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  listUsers() {
    return this.authService.listUsers();
  }

  @Post()
  createUser(
    @Body() body: unknown,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.authService.createUser(
      (body ?? {}) as Record<string, unknown>,
      request.user.id,
    );
  }

  @Patch(':id')
  updateUser(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.authService.updateUser(
      id,
      (body ?? {}) as Record<string, unknown>,
      request.user.id,
    );
  }

  @Delete(':id')
  deleteUser(
    @Param('id') id: string,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.authService.deleteUser(id, request.user.id);
  }

  @Put(':id/account-access')
  setAccountAccess(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.authService.setUserAccountAccess(
      id,
      (body ?? {}) as Record<string, unknown>,
      request.user.id,
    );
  }
}
