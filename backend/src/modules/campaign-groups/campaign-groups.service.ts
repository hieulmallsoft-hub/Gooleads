import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CampaignGroupEntity } from '../../database/entities/campaign-group.entity';
import { CampaignGroupMemberEntity } from '../../database/entities/campaign-group-member.entity';
import { GoogleAdsAccountRegistryService } from '../../database/google-ads-account-registry.service';
import { CreateCampaignGroupDto } from './dto/create-campaign-group.dto';
import { UpdateCampaignGroupDto } from './dto/update-campaign-group.dto';
import { UpdateCampaignGroupMembersDto } from './dto/update-campaign-group-members.dto';

@Injectable()
export class CampaignGroupsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly accountRegistry: GoogleAdsAccountRegistryService,
  ) {}

  async findAll(customerId: string) {
    const account = await this.accountRegistry.getOrCreate(customerId);
    const groups = await this.dataSource.getRepository(CampaignGroupEntity).find({
      where: { accountId: account.id },
      order: { name: 'ASC' },
    });
    const members = groups.length
      ? await this.dataSource
          .getRepository(CampaignGroupMemberEntity)
          .createQueryBuilder('member')
          .where('member.group_id IN (:...groupIds)', { groupIds: groups.map((group) => group.id) })
          .orderBy('member.campaign_name', 'ASC')
          .getMany()
      : [];

    return {
      groups: groups.map((group) => ({
        ...group,
        campaigns: members
          .filter((member) => member.groupId === group.id)
          .map((member) => ({
            id: member.googleCampaignId,
            name: member.campaignName,
          })),
      })),
    };
  }

  async create(input: CreateCampaignGroupDto) {
    const customerId = this.normalizeCustomerId(input.customerId);
    const name = this.normalizeName(input.name);
    const account = await this.accountRegistry.getOrCreate(customerId);
    const repository = this.dataSource.getRepository(CampaignGroupEntity);
    const existing = await repository
      .createQueryBuilder('group')
      .where('group.account_id = :accountId', { accountId: account.id })
      .andWhere('LOWER(group.name) = LOWER(:name)', { name })
      .getOne();

    if (existing) throw new ConflictException('A campaign group with this name already exists');

    return repository.save({
      accountId: account.id,
      name,
      color: this.normalizeColor(input.color),
      description: input.description?.trim() || null,
    });
  }

  async update(id: string, input: UpdateCampaignGroupDto) {
    const group = await this.findOwnedGroup(id, this.normalizeCustomerId(input.customerId));
    if (input.name !== undefined) group.name = this.normalizeName(input.name);
    if (input.color !== undefined) group.color = this.normalizeColor(input.color);
    if (input.description !== undefined) group.description = input.description?.trim() || null;

    try {
      return await this.dataSource.getRepository(CampaignGroupEntity).save(group);
    } catch {
      throw new ConflictException('A campaign group with this name already exists');
    }
  }

  async replaceMembers(id: string, input: UpdateCampaignGroupMembersDto) {
    const customerId = this.normalizeCustomerId(input.customerId);
    await this.findOwnedGroup(id, customerId);
    const campaigns = Array.isArray(input.campaigns)
      ? Array.from(
          new Map(
            input.campaigns
              .map((campaign) => ({
                id: String(campaign.id ?? '').replace(/\D/g, ''),
                name: String(campaign.name ?? '').trim(),
              }))
              .filter((campaign) => campaign.id && campaign.name)
              .map((campaign) => [campaign.id, campaign]),
          ).values(),
        )
      : [];

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(CampaignGroupMemberEntity).delete({ groupId: id });
      if (campaigns.length) {
        await manager.getRepository(CampaignGroupMemberEntity).save(
          campaigns.map((campaign) => ({
            groupId: id,
            googleCampaignId: campaign.id,
            campaignName: campaign.name,
          })),
        );
      }
    });

    return this.findAll(customerId);
  }

  async remove(id: string, customerId: string) {
    const group = await this.findOwnedGroup(id, this.normalizeCustomerId(customerId));
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(CampaignGroupMemberEntity).delete({ groupId: id });
      await manager.getRepository(CampaignGroupEntity).remove(group);
    });
    return { deleted: true, id };
  }

  private async findOwnedGroup(id: string, customerId: string) {
    const account = await this.accountRegistry.getOrCreate(customerId);
    const group = await this.dataSource
      .getRepository(CampaignGroupEntity)
      .findOneBy({ id, accountId: account.id });
    if (!group) throw new NotFoundException('Campaign group not found');
    return group;
  }

  private normalizeCustomerId(value: string | undefined) {
    const customerId = String(value ?? '').replace(/\D/g, '');
    if (!/^\d{10}$/.test(customerId)) {
      throw new BadRequestException('customerId must be a 10 digit Google Ads customer ID');
    }
    return customerId;
  }

  private normalizeName(value: string | undefined) {
    const name = String(value ?? '').trim();
    if (!name) throw new BadRequestException('Campaign group name is required');
    if (name.length > 120) throw new BadRequestException('Campaign group name is too long');
    return name;
  }

  private normalizeColor(value: string | undefined) {
    const color = String(value ?? '#1a73e8').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      throw new BadRequestException('Campaign group color must be a hex color');
    }
    return color.toLowerCase();
  }
}
