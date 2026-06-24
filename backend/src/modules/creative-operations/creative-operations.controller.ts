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
} from '@nestjs/common';
import { CreateCreativeTermDto } from './dto/create-creative-term.dto';
import { UpdateCreativeSettingsDto } from './dto/update-creative-settings.dto';
import { UpdateCreativeTermDto } from './dto/update-creative-term.dto';
import { CreativeOperationsService } from './creative-operations.service';

function customerId(value: string | undefined) {
  const normalized = String(value ?? '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(normalized)) {
    throw new BadRequestException('customerId must be a 10 digit Google Ads customer ID');
  }
  return normalized;
}

@Controller('creative-operations')
export class CreativeOperationsController {
  constructor(private readonly service: CreativeOperationsService) {}

  @Get('overview')
  getOverview(
    @Query('customerId') inputCustomerId: string | undefined,
    @Query('adGroupId') adGroupId?: string,
  ) {
    return this.service.getOverview(customerId(inputCustomerId), adGroupId?.trim());
  }

  @Get('recommendations')
  getRecommendations(
    @Query('customerId') inputCustomerId: string | undefined,
    @Query('adGroupId') adGroupId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.getRecommendations(
      customerId(inputCustomerId),
      adGroupId?.trim(),
      status?.trim().toUpperCase(),
    );
  }

  @Get('terms')
  getTerms(@Query('customerId') inputCustomerId: string | undefined) {
    return this.service.getTerms(customerId(inputCustomerId));
  }

  @Post('terms')
  createTerm(@Body() input: CreateCreativeTermDto) {
    return this.service.createTerm(input);
  }

  @Patch('terms/:id')
  updateTerm(@Param('id') id: string, @Body() input: UpdateCreativeTermDto) {
    return this.service.updateTerm(id, input);
  }

  @Delete('terms/:id')
  deleteTerm(@Param('id') id: string) {
    return this.service.deleteTerm(id);
  }

  @Get('settings')
  getSettings(@Query('customerId') inputCustomerId: string | undefined) {
    return this.service.getSettings(customerId(inputCustomerId));
  }

  @Patch('settings')
  updateSettings(
    @Query('customerId') inputCustomerId: string | undefined,
    @Body() input: UpdateCreativeSettingsDto,
  ) {
    return this.service.updateSettings(customerId(inputCustomerId), input);
  }
}
