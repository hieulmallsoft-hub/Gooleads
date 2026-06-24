import sys
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

def automate_app_ad_optimization(client, customer_id, ad_group_id, new_headline, new_description):
    ga_service = client.get_service("GoogleAdsService")
    ad_group_ad_service = client.get_service("AdGroupAdService")

    # --- BƯỚC 1: TÌM ASSET YẾU NHẤT (Dựa trên Performance Label LOW và Impressions thấp nhất) ---
    asset_query = f"""
        SELECT
          ad_group_ad.resource_name,
          ad_group_ad_asset_view.field_type,
          ad_group_ad_asset_view.performance_label,
          asset.text_asset.text,
          metrics.impressions
        FROM ad_group_ad_asset_view
        WHERE ad_group.id = {ad_group_id}
          AND segments.date DURING LAST_30_DAYS
          AND ad_group_ad_asset_view.field_type IN ('HEADLINE', 'DESCRIPTION')
          AND ad_group_ad_asset_view.performance_label = 'LOW'
    """

    worst_h_text, worst_d_text = None, None
    min_h_views, min_d_views = float('inf'), float('inf')
    ad_res_name = None

    try:
        search_results = ga_service.search(customer_id=customer_id, query=asset_query)
        for row in search_results:
            ad_res_name = row.ad_group_ad.resource_name
            f_type = row.ad_group_ad_asset_view.field_type.name
            views = row.metrics.impressions
            text = row.asset.text_asset.text

            if f_type == "HEADLINE" and views < min_h_views and views > 0:
                min_h_views, worst_h_text = views, text
            elif f_type == "DESCRIPTION" and views < min_d_views and views > 0:
                min_d_views, worst_d_text = views, text

        if not ad_res_name:
            print("💡 Không tìm thấy Asset nhãn LOW nào có dữ liệu để thay thế. Dừng script.")
            return

        # --- BƯỚC 2: LẤY CHI TIẾT AD HIỆN TẠI (Để giữ lại Hình ảnh/Video) ---
        ad_query = f"""
            SELECT
              ad_group_ad.ad.app_ad.headlines,
              ad_group_ad.ad.app_ad.descriptions,
              ad_group_ad.ad.app_ad.images,
              ad_group_ad.ad.app_ad.youtube_videos,
              ad_group_ad.ad.app_ad.html5_media_bundles
            FROM ad_group_ad
            WHERE ad_group_ad.resource_name = '{ad_res_name}'
        """
        ad_response = ga_service.search(customer_id=customer_id, query=ad_query)
        old_ad = next(iter(ad_response)).ad_group_ad.ad.app_ad

        # --- BƯỚC 3: CHUẨN BỊ THAO TÁC XÓA & TẠO (MUTATE) ---
        operations = []

        # 3.1. Operation Xóa Ad cũ
        remove_op = client.get_type("AdGroupAdOperation")
        remove_op.remove = ad_res_name
        operations.append(remove_op)

        # 3.2. Operation Tạo Ad mới
        create_op = client.get_type("AdGroupAdOperation")
        new_ad_group_ad = create_op.create
        new_ad_group_ad.ad_group = f"customers/{customer_id}/adGroups/{ad_group_id}"
        new_ad_group_ad.status = client.enums.AdGroupAdStatusEnum.ENABLED
        
        # Sao chép và thay thế Headlines
        for h in old_ad.headlines:
            asset = client.get_type("AdTextAsset")
            asset.text = new_headline if (h.text == worst_h_text) else h.text
            new_ad_group_ad.ad.app_ad.headlines.append(asset)

        # Sao chép và thay thế Descriptions
        for d in old_ad.descriptions:
            asset = client.get_type("AdTextAsset")
            asset.text = new_description if (d.text == worst_d_text) else d.text
            new_ad_group_ad.ad.app_ad.descriptions.append(asset)

        # QUAN TRỌNG: Giữ lại toàn bộ Image, Video, HTML5
        new_ad_group_ad.ad.app_ad.images.extend(old_ad.images)
        new_ad_group_ad.ad.app_ad.youtube_videos.extend(old_ad.youtube_videos)
        new_ad_group_ad.ad.app_ad.html5_media_bundles.extend(old_ad.html5_media_bundles)

        operations.append(create_op)

        # --- BƯỚC 4: THỰC THI ---
        print(f"🚀 Đang tiến hành thay thế Asset tệ nhất cho Ad: {ad_res_name}")
        if worst_h_text: print(f"   - Thay Headline: '{worst_h_text}'")
        if worst_d_text: print(f"   - Thay Description: '{worst_d_text}'")

        response = ad_group_ad_service.mutate_ad_group_ads(
            customer_id=customer_id, operations=operations
        )
        
        print(f"✅ Xóa Ad cũ thành công.")
        print(f"✅ Tạo Ad mới thành công: {response.results[1].resource_name}")

    except GoogleAdsException as ex:
        print(f"❌ Lỗi Google Ads API: {ex.failure.errors[0].message}")
    except Exception as e:
        print(f"❌ Lỗi hệ thống: {e}")

if __name__ == "__main__":
    # Cấu hình
    CUSTOMER_ID = "9920642691"
    AD_GROUP_ID = "144961648257"
    NEW_H = "Tải Ngay Ứng Dụng Cực Hay"
    NEW_D = "Khám phá các tính năng mới nhất vừa cập nhật."

    client = GoogleAdsClient.load_from_storage("google-ads.yaml")
    automate_app_ad_optimization(client, CUSTOMER_ID, AD_GROUP_ID, NEW_H, NEW_D)