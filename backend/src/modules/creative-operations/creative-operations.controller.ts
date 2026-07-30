import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateCreativeTermDto } from './dto/create-creative-term.dto';
import { UpdateCreativeSettingsDto } from './dto/update-creative-settings.dto';
import { UpdateCreativeTermDto } from './dto/update-creative-term.dto';
import { CreativeOperationsService } from './creative-operations.service';
import { AuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CampaignAccessService } from '../auth/campaign-access.service';
import type { AuthenticatedUser } from '../auth/auth.guard';

function customerId(value: string | undefined) {
  const normalized = String(value ?? '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(normalized)) {
    throw new BadRequestException('customerId must be a 10 digit Google Ads customer ID');
  }
  return normalized;
}

@UseGuards(AuthGuard)
@RequirePermissions('ads.view')
@Controller('creative-operations')
export class CreativeOperationsController {
  constructor(
    private readonly service: CreativeOperationsService,
    private readonly campaignAccessService: CampaignAccessService,
  ) {}

  private customerIdForUser(
    inputCustomerId: string | undefined,
    user: AuthenticatedUser,
  ) {
    const normalizedCustomerId = customerId(inputCustomerId);
    this.campaignAccessService.assertCanViewCustomer(user, normalizedCustomerId);
    return normalizedCustomerId;
  }

  @Get('overview')
  getOverview(
    @Query('customerId') inputCustomerId: string | undefined,
    @Query('adGroupId') adGroupId?: string,
    @Req() request?: { user: AuthenticatedUser },
  ) {
    return this.service.getOverview(
      this.customerIdForUser(inputCustomerId, request!.user),
      adGroupId?.trim(),
    );
  }

  @Get('recommendations')
  getRecommendations(
    @Query('customerId') inputCustomerId: string | undefined,
    @Query('adGroupId') adGroupId?: string,
    @Query('status') status?: string,
    @Req() request?: { user: AuthenticatedUser },
  ) {
    return this.service.getRecommendations(
      this.customerIdForUser(inputCustomerId, request!.user),
      adGroupId?.trim(),
      status?.trim().toUpperCase(),
    );
  }

  @Get('change-impact')
  getChangeImpact(
    @Query('customerId') inputCustomerId: string | undefined,
    @Query('days') days: string | undefined,
    @Query('q') search: string | undefined,
    @Query('source') source: string | undefined,
    @Query('verdict') verdict: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.service.getChangeImpact(
      this.customerIdForUser(inputCustomerId, request.user),
      days,
      { search, source, verdict, page, pageSize },
    );
  }

  @Get('change-history')
  getChangeHistory(
    @Query('customerId') inputCustomerId: string | undefined,
    @Query('q') search: string | undefined,
    @Query('source') source: string | undefined,
    @Query('status') status: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.service.getChangeHistory(
      this.customerIdForUser(inputCustomerId, request.user),
      { search, source, status, page, pageSize },
    );
  }

  @Get('change-history/:changeId')
  getChangeHistoryDetail(
    @Param('changeId') changeId: string,
    @Query('customerId') inputCustomerId: string | undefined,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.service.getChangeHistoryDetail(
      this.customerIdForUser(inputCustomerId, request.user),
      changeId,
    );
  }

  @Get('terms')
  getTerms(
    @Query('customerId') inputCustomerId: string | undefined,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.service.getTerms(this.customerIdForUser(inputCustomerId, request.user));
  }

  @Post('terms')
  @RequirePermissions('rules.manage')
  createTerm(@Body() input: CreateCreativeTermDto) {
    return this.service.createTerm(input);
  }

  @Patch('terms/:id')
  @RequirePermissions('rules.manage')
  updateTerm(@Param('id') id: string, @Body() input: UpdateCreativeTermDto) {
    return this.service.updateTerm(id, input);
  }

  @Delete('terms/:id')
  @RequirePermissions('rules.manage')
  deleteTerm(@Param('id') id: string) {
    return this.service.deleteTerm(id);
  }

  @Get('settings')
  getSettings(
    @Query('customerId') inputCustomerId: string | undefined,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.service.getSettings(this.customerIdForUser(inputCustomerId, request.user));
  }

  @Get('automation/notifications')
  getAutomationNotifications(
    @Query('customerId') inputCustomerId: string | undefined,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.service.getAutomationNotifications(
      this.customerIdForUser(inputCustomerId, request.user),
    );
  }

  @Patch('settings')
  @RequirePermissions('rules.manage')
  updateSettings(
    @Query('customerId') inputCustomerId: string | undefined,
    @Body() input: UpdateCreativeSettingsDto,
  ) {
    return this.service.updateSettings(customerId(inputCustomerId), input);
  }

  @Patch('automation/settings')
  @RequirePermissions('automation.manage')
  updateAutomationSettings(
    @Query('customerId') inputCustomerId: string | undefined,
    @Body() input: UpdateCreativeSettingsDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.service.updateAutomationSettings(
      this.customerIdForUser(inputCustomerId, request.user),
      input,
    );
  }

  @Post('automation/run')
  @RequirePermissions('automation.manage')
  runAutomationNow(
    @Query('customerId') inputCustomerId: string | undefined,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.service.runAutomationNow(
      this.customerIdForUser(inputCustomerId, request.user),
    );
  }
}
