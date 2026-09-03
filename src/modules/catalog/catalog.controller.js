import {
  getCategoriesService,
  getProductsService,
  searchOperationalProductsService,
} from "@/src/modules/catalog/catalog.service";
import { successResponse } from "@/src/shared/http/api-response";

export async function listCategoriesController() {
  const categories = await getCategoriesService();
  return successResponse(categories);
}

export async function listProductsController(filters) {
  const products = await getProductsService(filters);
  return successResponse(products);
}

export async function searchOperationalProductsController(input) {
  return successResponse(await searchOperationalProductsService(input));
}
