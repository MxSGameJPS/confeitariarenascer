import { successResponse } from "@/src/shared/http/api-response";
import { createSupplierService,listSuppliersService,updateSupplierService } from "@/src/modules/suppliers/suppliers.service";
export async function listSuppliersController(){return successResponse(await listSuppliersService());}
export async function createSupplierController(input,actor){return successResponse(await createSupplierService(input,actor),201);}
export async function updateSupplierController(id,input,actor){return successResponse(await updateSupplierService(id,input,actor));}
