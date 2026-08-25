import { supabaseServerRequest } from "@/src/config/supabase/server";
export async function listSuppliers(){return supabaseServerRequest("/rest/v1/suppliers?select=*&order=active.desc,name.asc");}
export async function insertSupplier(data){return(await supabaseServerRequest("/rest/v1/suppliers?select=*",{method:"POST",body:data,prefer:"return=representation"}))[0];}
export async function patchSupplier(id,data){return(await supabaseServerRequest(`/rest/v1/suppliers?id=eq.${id}&select=*`,{method:"PATCH",body:data,prefer:"return=representation"}))[0]??null;}
export async function writeSupplierAudit(actor,action,id,metadata){await supabaseServerRequest("/rest/v1/audit_logs",{method:"POST",body:{actor_id:actor.id,actor_kind:"admin",action,entity_type:"supplier",entity_id:id,metadata}});}
