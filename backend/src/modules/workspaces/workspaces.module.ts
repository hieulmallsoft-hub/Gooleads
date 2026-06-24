import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceEntity } from './entities/workspace.entity';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceEntity])],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
