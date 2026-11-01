import { cacheBakedAsset } from "../src/world/bakedAssets";
import tree from "../src/world/assets/broadleaf.json";
import cottage from "../src/world/assets/cottage.json";
import shop from "../src/world/assets/cornerShop.json";

// Node-based world-geometry tests do not have a browser asset server.
cacheBakedAsset("broadleaf", tree);
cacheBakedAsset("cottage", cottage);
cacheBakedAsset("cornerShop", shop);
