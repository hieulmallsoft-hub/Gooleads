import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceEntity } from './entities/workspace.entity';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
  ) {}

  findAll() {
    return this.workspaceRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const workspace = await this.workspaceRepository.findOneBy({ id });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  create(input: CreateWorkspaceDto) {
    const workspace = this.workspaceRepository.create({
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      timezone: input.timezone?.trim() || 'Asia/Ho_Chi_Minh',
    });
    return this.workspaceRepository.save(workspace);
  }

  async update(id: string, input: UpdateWorkspaceDto) {
    const workspace = await this.findOne(id);
    if (input.name !== undefined) workspace.name = input.name.trim();
    if (input.slug !== undefined) workspace.slug = input.slug.trim().toLowerCase();
    if (input.timezone !== undefined) workspace.timezone = input.timezone.trim();
    return this.workspaceRepository.save(workspace);
  }

  async remove(id: string) {
    const workspace = await this.findOne(id);
    await this.workspaceRepository.remove(workspace);
    return { deleted: true, id };
  }
}
