# Seeds the bakery's products on a site: content, which Loopress never syncs (it ships the
# `product` post type, its categories taxonomy and ACF fields, not the products themselves).
# What a team would do with a WordPress export, through the REST API instead. Idempotent:
# a category or product that already exists (same slug) is left as it is.
#   python3 content/seed.py https://bakery.local admin "<application password>" [ca-file]
import base64, json, mimetypes, ssl, sys, urllib.request
from pathlib import Path

url, user, password = sys.argv[1:4]
context = ssl.create_default_context(cafile=sys.argv[4]) if len(sys.argv) > 4 else None
here = Path(__file__).parent
data = json.loads((here / "products.json").read_text())
auth = "Basic " + base64.b64encode(f"{user}:{password}".encode()).decode()


def call(path, method="GET", body=None, headers=None):
    request = urllib.request.Request(f"{url}/wp-json/wp/v2/{path}", data=body, method=method,
                                     headers={"Authorization": auth, "Content-Type": "application/json", **(headers or {})})
    return json.load(urllib.request.urlopen(request, context=context))


terms = {}
for category in data["categories"]:
    found = call(f"product_category?slug={category['slug']}")
    terms[category["slug"]] = found[0]["id"] if found else call("product_category", "POST", json.dumps(category).encode())["id"]

for order, product in enumerate(data["products"], start=1):
    if call(f"product?slug={product['slug']}&status=any"):
        print(f"exists: {product['slug']}")
        continue
    image = here / product["image"]
    media = call("media", "POST", image.read_bytes(), {
        "Content-Type": mimetypes.guess_type(image.name)[0] or "image/jpeg",
        "Content-Disposition": f'attachment; filename="{image.name}"'})
    call(f"media/{media['id']}", "POST", json.dumps({"alt_text": product["alt"]}).encode())
    call("product", "POST", json.dumps({
        "slug": product["slug"], "title": product["title"], "excerpt": product["excerpt"], "status": "publish",
        "menu_order": order, "featured_media": media["id"], "product_category": [terms[product["category"]]],
        "acf": {"price": product["price"], "weight": product["weight"]},
    }).encode())
    print(f"created: {product['slug']}")
