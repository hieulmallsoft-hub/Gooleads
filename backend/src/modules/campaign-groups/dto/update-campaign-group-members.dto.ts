export class UpdateCampaignGroupMembersDto {
  customerId?: string;
  campaigns?: Array<{
    id?: string;
    name?: string;
  }>;
}
