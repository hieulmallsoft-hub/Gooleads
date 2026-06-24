from google.ads.googleads.client import GoogleAdsClient

def get_adgroup_full(customer_id: str, ad_group_id: str):
    client = GoogleAdsClient.load_from_storage("google-ads.yaml")
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
          campaign.id,
          campaign.name,

          ad_group.id,
          ad_group.name,
          ad_group.status,
          ad_group.type,
          ad_group.cpc_bid_micros,

          ad_group_ad.ad.id,
          ad_group_ad.ad.name,
          ad_group_ad.status,
          ad_group_ad.ad.type,

          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.conversions,
          metrics.cost_micros

        FROM ad_group_ad
        WHERE ad_group.id = {ad_group_id}
        AND segments.date DURING LAST_30_DAYS
    """

    response = ga_service.search(
        customer_id=customer_id,
        query=query
    )

    result = {
        "campaign": {},
        "ad_group": {},
        "ads": []
    }

    for row in response:
        # Campaign info
        result["campaign"] = {
            "id": row.campaign.id,
            "name": row.campaign.name
        }

        # Ad group info
        result["ad_group"] = {
            "id": row.ad_group.id,
            "name": row.ad_group.name,
            "status": row.ad_group.status.name,
            "type": row.ad_group.type_.name,
            "cpc_bid_micros": row.ad_group.cpc_bid_micros
        }

        # Ad info
        ad_data = {
            "ad_id": row.ad_group_ad.ad.id,
            "ad_name": row.ad_group_ad.ad.name,
            "status": row.ad_group_ad.status.name,
            "type": row.ad_group_ad.ad.type_.name,
            "metrics": {
                "impressions": row.metrics.impressions,
                "clicks": row.metrics.clicks,
                "ctr": row.metrics.ctr,
                "conversions": row.metrics.conversions,
                "cost_micros": row.metrics.cost_micros
            }
        }

        result["ads"].append(ad_data)

    return result


if __name__ == "__main__":
    CUSTOMER_ID = "9920642691"
    AD_GROUP_ID = "176778806638"

    data = get_adgroup_full(CUSTOMER_ID, AD_GROUP_ID)

    import json
    print(json.dumps(data, indent=2))