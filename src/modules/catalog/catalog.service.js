import { getPublicStorageUrl } from "@/src/config/supabase/server";
import {
  listActiveCategories,
  listActiveProducts,
} from "@/src/modules/catalog/catalog.repository";

function mapProduct(product) {
  return {
    ...product,
    price: Number(product.price),
    image_url: getPublicStorageUrl(product.image_path),
  };
}

export async function getCategoriesService() {
  return listActiveCategories();
}

export async function getProductsService(filters) {
  const products = await listActiveProducts(filters);
  return products.map(mapProduct);
}
