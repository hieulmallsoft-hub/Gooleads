import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CampaignGroupsService } from './campaign-groups.service';
import { CreateCampaignGroupDto } from './dto/create-campaign-group.dto';
import { UpdateCampaignGroupDto } from './dto/update-campaign-group.dto';
import { UpdateCampaignGroupMembersDto } from './dto/update-campaign-group-members.dto';

@Controller('campaign-groups')
export class CampaignGroupsController {
  constructor(private readonly campaignGroupsService: CampaignGroupsService) {}

  @Get()
  findAll(@Query('customerId') customerId: string) {
    return this.campaignGroupsService.findAll(customerId);
  }

  @Post()
  create(@Body() input: CreateCampaignGroupDto) {
    return this.campaignGroupsService.create(input);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateCampaignGroupDto) {
    return this.campaignGroupsService.update(id, input);
  }

  @Put(':id/members')
  replaceMembers(
    @Param('id') id: string,
    @Body() input: UpdateCampaignGroupMembersDto,
  ) {
    return this.campaignGroupsService.replaceMembers(id, input);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('customerId') customerId: string) {
    return this.campaignGroupsService.remove(id, customerId);
  }
}
