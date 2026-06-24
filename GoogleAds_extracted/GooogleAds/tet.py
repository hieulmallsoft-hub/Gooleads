from google.ads.googleads.client import GoogleAdsClient
from flask import Flask, render_template, request

app = Flask(__name__)

@app.route("/")
def main():
    client = GoogleAdsClient.load_from_storage("google-ads.yaml")
    ga_service = client.get_service("GoogleAdsService")

    # Lay customer_id tu URL
    customer_id = request.args.get("customer_id")
    time_range = request.args.get("time", "TODAY")

    allowed_times = ["TODAY", "YESTERDAY", "LAST_7_DAYS", "THIS_MONTH"]
    if time_range not in allowed_times:
    	time_range = "TODAY"

    if not customer_id:
        return "Thieu customer_id. Vi du: ?customer_id=1234567890"

    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            metrics.cost_micros,
            metrics.conversions_value
        FROM campaign
        WHERE segments.date DURING { time_range }
        ORDER BY metrics.cost_micros DESC
        LIMIT 50
    """

    response = ga_service.search(
        customer_id=customer_id,
        query=query    
    )

    campaigns = []
    total_cost = 0
    total_conversion_value = 0

    for row in response:
        cost = (row.metrics.cost_micros or 0) / 1_000_000
        conversion_value = row.metrics.conversions_value or 0

        roas = conversion_value / cost if cost > 0 else 0

        campaigns.append({
            "id": row.campaign.id,
            "name": row.campaign.name,
            "cost": cost,
            "conversion_value": conversion_value,
            "roas": roas
        })

        total_cost += cost
        total_conversion_value += conversion_value

    # Tinh ROAS trung binh
    avg_roas = total_conversion_value / total_cost if total_cost > 0 else 0
    
    total_cost = sum(c["cost"] for c in campaigns)

    return render_template("campaigns.html", campaigns=campaigns, time_range=time_range, total_cost = total_cost, avg_roas = avg_roas)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)