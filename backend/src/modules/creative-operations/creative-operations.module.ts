import { Module } from '@nestjs/common';
import { CreativeOperationsController } from './creative-operations.controller';
import { CreativeOperationsService } from './creative-operations.service';

@Module({
  controllers: [CreativeOperationsController],
  providers: [CreativeOperationsService],
})
export class CreativeOperationsModule {}
