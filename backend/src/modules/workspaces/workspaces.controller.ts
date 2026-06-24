import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  findAll() {
    return this.workspacesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workspacesService.findOne(id);
  }

  @Post()
  create(@Body() input: CreateWorkspaceDto) {
    return this.workspacesService.create(input);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateWorkspaceDto) {
    return this.workspacesService.update(id, input);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workspacesService.remove(id);
  }
}
