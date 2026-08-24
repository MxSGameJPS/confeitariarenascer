import {
  createCategory,
  createProduct,
  findCategoryBySlug,
  findProductBySlug,
  listCategoriesAdmin,
  listProductsAdmin,
  updateCategory,
  updateProduct,
  uploadProductImage,
  writeAuditLog,
} from "@/src/modules/admin/catalog/admin-catalog.repository";
import { getPublicStorageUrl } from "@/src/config/supabase/server";
import { AppError } from "@/src/shared/errors/app-error";

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "item";
}

async function uniqueSlug(name, finder, currentId = null) {
  const base = slugify(name);
  let candidate = base;
  let index = 2;

  while (true) {
    const existing = await finder(candidate);
    if (!existing || existing.id === currentId) return candidate;
    candidate = `${base}-${index++}`;
  }
}

function mapProduct(product) {
  return {
    ...product,
    price: Number(product.price),
    stock_quantity: Number(product.stock_quantity),
    image_url: getPublicStorageUrl(product.image_path),
  };
}

export async function listAdminCatalogService() {
  const [categories, products] = await Promise.all([
    listCategoriesAdmin(),
    listProductsAdmin(),
  ]);

  return { categories, products: products.map(mapProduct) };
}

export async function createCategoryService(input, actor) {
  const slug = await uniqueSlug(input.name, findCategoryBySlug);
  const category = await createCategory({
    name: input.name,
    slug,
    description: input.description,
    sort_order: input.sortOrder,
    active: input.active,
  });

  await writeAuditLog({
    actorId: actor.id,
    action: "category.created",
    entityType: "category",
    entityId: category.id,
    metadata: { name: category.name },
  });

  return category;
}

export async function updateCategoryService(id, input, actor) {
  const slug = await uniqueSlug(input.name, findCategoryBySlug, id);
  const category = await updateCategory(id, {
    name: input.name,
    slug,
    description: input.description,
    sort_order: input.sortOrder,
    active: input.active,
  });

  if (!category) {
    throw new AppError("Categoria não encontrada.", { statusCode: 404, code: "CATEGORY_NOT_FOUND" });
  }

  await writeAuditLog({
    actorId: actor.id,
    action: "category.updated",
    entityType: "category",
    entityId: id,
    metadata: { name: category.name, active: category.active },
  });

  return category;
}

export async function archiveCategoryService(id, actor) {
  const category = await updateCategory(id, { active: false });
  if (!category) {
    throw new AppError("Categoria não encontrada.", { statusCode: 404, code: "CATEGORY_NOT_FOUND" });
  }

  await writeAuditLog({
    actorId: actor.id,
    action: "category.archived",
    entityType: "category",
    entityId: id,
    metadata: { name: category.name },
  });

  return category;
}

export async function createProductService(input, actor) {
  const slug = await uniqueSlug(input.name, findProductBySlug);
  const product = await createProduct({
    category_id: input.categoryId,
    name: input.name,
    slug,
    description: input.description,
    price: input.price,
    unit: input.unit,
    image_path: input.imagePath,
    featured: input.featured,
    active: input.active,
    stock_control: input.stockControl,
    stock_quantity: input.stockQuantity,
    sort_order: input.sortOrder,
    pricing_mode: input.pricingMode,
    available_delivery: input.availableDelivery,
    available_internal: input.availableInternal,
  });

  await writeAuditLog({
    actorId: actor.id,
    action: "product.created",
    entityType: "product",
    entityId: product.id,
    metadata: { name: product.name, price: Number(product.price) },
  });

  return mapProduct(product);
}

export async function updateProductService(id, input, actor) {
  const slug = await uniqueSlug(input.name, findProductBySlug, id);
  const product = await updateProduct(id, {
    category_id: input.categoryId,
    name: input.name,
    slug,
    description: input.description,
    price: input.price,
    unit: input.unit,
    image_path: input.imagePath,
    featured: input.featured,
    active: input.active,
    stock_control: input.stockControl,
    stock_quantity: input.stockQuantity,
    sort_order: input.sortOrder,
    pricing_mode: input.pricingMode,
    available_delivery: input.availableDelivery,
    available_internal: input.availableInternal,
  });

  if (!product) {
    throw new AppError("Produto não encontrado.", { statusCode: 404, code: "PRODUCT_NOT_FOUND" });
  }

  await writeAuditLog({
    actorId: actor.id,
    action: "product.updated",
    entityType: "product",
    entityId: id,
    metadata: { name: product.name, price: Number(product.price), active: product.active },
  });

  return mapProduct(product);
}

export async function archiveProductService(id, actor) {
  const product = await updateProduct(id, { active: false });
  if (!product) {
    throw new AppError("Produto não encontrado.", { statusCode: 404, code: "PRODUCT_NOT_FOUND" });
  }

  await writeAuditLog({
    actorId: actor.id,
    action: "product.archived",
    entityType: "product",
    entityId: id,
    metadata: { name: product.name },
  });

  return mapProduct(product);
}

export async function uploadProductImageService(file, actor) {
  if (!(file instanceof File) || file.size === 0) {
    throw new AppError("Selecione uma imagem.", { statusCode: 400, code: "INVALID_FILE" });
  }

  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) {
    throw new AppError("Formato inválido. Use JPG, PNG ou WebP.", { statusCode: 400, code: "INVALID_FILE_TYPE" });
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new AppError("A imagem deve ter no máximo 5 MB.", { statusCode: 400, code: "FILE_TOO_LARGE" });
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const objectPath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  await uploadProductImage({ objectPath, file });

  await writeAuditLog({
    actorId: actor.id,
    action: "product_image.uploaded",
    entityType: "storage_object",
    entityId: objectPath,
    metadata: { size: file.size, type: file.type },
  });

  return { path: objectPath, url: getPublicStorageUrl(objectPath) };
}

