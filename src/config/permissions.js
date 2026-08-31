export const ROLES = Object.freeze({
  SUPERADMIN: "superadmin",
  GERENTE: "gerente",
  ATENDENTE: "atendente",
});

export const PERMISSIONS = Object.freeze({
  EMPLOYEES_VIEW: "employees.view",
  EMPLOYEES_CREATE: "employees.create",
  EMPLOYEES_UPDATE: "employees.update",
  EMPLOYEES_RESET_PASSWORD: "employees.reset_password",
  MENU_MANAGE: "menu.manage",
  DELIVERY_ACCEPT: "delivery.accept",
  COMMANDS_RECEIVE: "commands.receive",
  POS_ACCESS: "pos.access",
  POS_SELL: "pos.sell",
  SALES_CANCEL: "sales.cancel",
  SALES_CANCEL_ITEM: "sales.cancel_item",
  REPORTS_VIEW: "reports.view",
  SUPPLIERS_MANAGE: "suppliers.manage",
  AUDIT_VIEW: "audit.view",
  SUPERADMINS_MANAGE: "superadmins.manage",
  TABLES_VIEW: "tables.view",
  TABLES_CREATE: "tables.create",
  TABLES_STATUS: "tables.status",
  WEIGHING_DEVICES_MANAGE: "weighing_devices.manage",
  BRIDGE_MANAGE: "bridge.manage",
});

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.SUPERADMIN]: new Set(Object.values(PERMISSIONS)),
  [ROLES.GERENTE]: new Set([
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_CREATE,
    PERMISSIONS.EMPLOYEES_UPDATE,
    PERMISSIONS.EMPLOYEES_RESET_PASSWORD,
    PERMISSIONS.DELIVERY_ACCEPT,
    PERMISSIONS.POS_ACCESS,
    PERMISSIONS.POS_SELL,
    PERMISSIONS.COMMANDS_RECEIVE,
    PERMISSIONS.SALES_CANCEL,
    PERMISSIONS.SALES_CANCEL_ITEM,
    PERMISSIONS.TABLES_VIEW,
    PERMISSIONS.TABLES_STATUS,
  ]),
  [ROLES.ATENDENTE]: new Set([
    PERMISSIONS.DELIVERY_ACCEPT,
    PERMISSIONS.COMMANDS_RECEIVE,
    PERMISSIONS.POS_ACCESS,
    PERMISSIONS.POS_SELL,
  ]),
});

export function normalizeRole(role) {
  if (role === "admin") return ROLES.SUPERADMIN;
  if (role === "operador") return ROLES.ATENDENTE;
  return role;
}

export function hasPermission(role, permission) {
  const normalizedRole = normalizeRole(role);
  return ROLE_PERMISSIONS[normalizedRole]?.has(permission) ?? false;
}
