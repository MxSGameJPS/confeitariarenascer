import {
  archiveCategoryService,
  archiveProductService,
  createCategoryService,
  createProductService,
  listAdminCatalogService,
  updateCategoryService,
  updateProductService,
  uploadProductImageService,
} from "@/src/modules/admin/catalog/admin-catalog.service";
import { successResponse } from "@/src/shared/http/api-response";

export async function listAdminCatalogController() {
  return successResponse(await listAdminCatalogService());
}

export async function createCategoryController(input, actor) {
  return successResponse(await createCategoryService(input, actor), 201);
}

export async function updateCategoryController(id, input, actor) {
  return successResponse(await updateCategoryService(id, input, actor));
}

export async function archiveCategoryController(id, actor) {
  return successResponse(await archiveCategoryService(id, actor));
}

export async function createProductController(input, actor) {
  return successResponse(await createProductService(input, actor), 201);
}

export async function updateProductController(id, input, actor) {
  return successResponse(await updateProductService(id, input, actor));
}

export async function archiveProductController(id, actor) {
  return successResponse(await archiveProductService(id, actor));
}

export async function uploadProductImageController(file, actor) {
  return successResponse(await uploadProductImageService(file, actor), 201);
}
