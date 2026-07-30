import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { CampaignGroupsService } from './campaign-groups.service';
import { CreateCampaignGroupDto } from './dto/create-campaign-group.dto';
import { UpdateCampaignGroupDto } from './dto/update-campaign-group.dto';
import { UpdateCampaignGroupMembersDto } from './dto/update-campaign-group-members.dto';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@UseGuards(AuthGuard)
@RequirePermissions('ads.view')
@Controller('campaign-groups')
export class CampaignGroupsController {
  constructor(private readonly campaignGroupsService: CampaignGroupsService) {}

  @Get()
  findAll(
    @Query('customerId') customerId: string,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.campaignGroupsService.findAll(customerId, request.user);
  }

  @Post()
  @RequirePermissions('campaign_groups.manage')
  create(
    @Body() input: CreateCampaignGroupDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.campaignGroupsService.create(input, request.user);
  }

  @Patch(':id')
  @RequirePermissions('campaign_groups.manage')
  update(
    @Param('id') id: string,
    @Body() input: UpdateCampaignGroupDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.campaignGroupsService.update(id, input, request.user);
  }

  @Put(':id/members')
  @RequirePermissions('campaign_groups.manage')
  replaceMembers(
    @Param('id') id: string,
    @Body() input: UpdateCampaignGroupMembersDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.campaignGroupsService.replaceMembers(id, input, request.user);
  }

  @Delete(':id')
  @RequirePermissions('campaign_groups.manage')
  remove(
    @Param('id') id: string,
    @Query('customerId') customerId: string,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.campaignGroupsService.remove(id, customerId, request.user);
  }
}
