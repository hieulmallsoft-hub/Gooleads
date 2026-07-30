import { Global, Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CampaignAccessService } from './campaign-access.service';

@Global()
@Module({
  controllers: [AuthController, AdminUsersController],
  providers: [AuthService, AuthGuard, CampaignAccessService],
  exports: [AuthGuard, AuthService, CampaignAccessService],
})
export class AuthModule {}
