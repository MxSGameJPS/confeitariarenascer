import { AppError } from "@/src/shared/errors/app-error";
import { insertSupplier,listSuppliers,patchSupplier,writeSupplierAudit } from "@/src/modules/suppliers/suppliers.repository";
export async function listSuppliersService(){return listSuppliers();}
export async function createSupplierService(input,actor){const supplier=await insertSupplier({...input,created_by:actor.id});await writeSupplierAudit(actor,"supplier.created",supplier.id,{name:supplier.name});return supplier;}
export async function updateSupplierService(id,input,actor){const supplier=await patchSupplier(id,input);if(!supplier)throw new AppError("Fornecedor não encontrado.",{statusCode:404,code:"SUPPLIER_NOT_FOUND"});await writeSupplierAudit(actor,"supplier.updated",id,{name:supplier.name,active:supplier.active});return supplier;}
