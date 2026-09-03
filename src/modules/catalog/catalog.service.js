import { getPublicStorageUrl } from "@/src/config/supabase/server";
import {
  listActiveCategories,
  listActiveProducts,
  searchOperationalProducts,
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

export async function searchOperationalProductsService(input) {
  const products = await searchOperationalProducts(input.query, input.limit);
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    price: Number(product.price),
    pricing_mode: product.pricing_mode,
    unit: product.unit,
    image_url: getPublicStorageUrl(product.image_path),
    gemaster_code: product.external_code || null,
    reference: product.external_reference || null,
    ean: product.external_ean || null,
    matched_by: product.match_type,
  }));
}
