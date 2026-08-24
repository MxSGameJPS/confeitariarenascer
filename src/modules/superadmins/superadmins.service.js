import { AppError } from "@/src/shared/errors/app-error";
import { PERMISSIONS, hasPermission, normalizeRole, ROLES } from "@/src/config/permissions";
import {
  createBootstrapRequest,
  createSupabaseAuthAdmin,
  deactivateSuperadminProfile,
  findProfileByEmail,
  listPendingSuperadminRequests,
  listSuperadminProfiles,
  promoteProfileToSuperadmin,
  writeSuperadminAudit,
} from "@/src/modules/superadmins/superadmins.repository";

function requireSuperadmin(actor) {
  if (!actor || !hasPermission(actor.role, PERMISSIONS.SUPERADMINS_MANAGE)) {
    throw new AppError("Apenas o Superadmin pode gerenciar administradores.", {
      statusCode: 403,
      code: "FORBIDDEN",
    });
  }
}

export async function listSuperadminsService(actor) {
  requireSuperadmin(actor);
  const [admins, pending] = await Promise.all([
    listSuperadminProfiles(),
    listPendingSuperadminRequests(),
  ]);
  return { admins, pending };
}

export async function createSuperadminService(input, actor) {
  requireSuperadmin(actor);

  const existingProfile = await findProfileByEmail(input.email);
  if (existingProfile) {
    if (normalizeRole(existingProfile.role) === ROLES.SUPERADMIN && existingProfile.active) {
      throw new AppError("Este e-mail já pertence a um Superadmin ativo.", {
        statusCode: 409,
        code: "SUPERADMIN_EXISTS",
      });
    }

    const promoted = await promoteProfileToSuperadmin(existingProfile.id, input);
    await writeSuperadminAudit({
      actorId: actor.id,
      action: "superadmin.promoted",
      entityId: promoted.id,
      metadata: { email: input.email, full_name: input.fullName },
    });

    return {
      status: "promoted",
      admin: promoted,
      manualCreationRequired: false,
    };
  }

  const bootstrap = await createBootstrapRequest({
    email: input.email,
    fullName: input.fullName,
    createdBy: actor.id,
  });

  const authResult = await createSupabaseAuthAdmin(input);

  if (!authResult.ok) {
    await writeSuperadminAudit({
      actorId: actor.id,
      action: "superadmin.bootstrap_prepared",
      entityId: bootstrap.id,
      metadata: {
        email: input.email,
        auth_status: authResult.status,
      },
    });

    return {
      status: "bootstrap_prepared",
      email: input.email,
      manualCreationRequired: true,
      message: "A autorização foi preparada. Crie este mesmo e-mail em Authentication > Users no Supabase; o trigger concederá Superadmin automaticamente.",
    };
  }

  const profile = await findProfileByEmail(input.email);
  if (!profile || normalizeRole(profile.role) !== ROLES.SUPERADMIN) {
    throw new AppError("O usuário foi criado no Auth, mas o perfil administrativo ainda não foi confirmado. Atualize a página em alguns segundos.", {
      statusCode: 502,
      code: "SUPERADMIN_PROFILE_PENDING",
    });
  }

  await writeSuperadminAudit({
    actorId: actor.id,
    action: "superadmin.created",
    entityId: profile.id,
    metadata: { email: input.email, full_name: input.fullName },
  });

  return {
    status: "created",
    admin: profile,
    manualCreationRequired: false,
  };
}

export async function deactivateSuperadminService(id, actor) {
  requireSuperadmin(actor);

  if (id === actor.id) {
    throw new AppError("Você não pode desativar o Superadmin que está usando nesta sessão.", {
      statusCode: 400,
      code: "CANNOT_DISABLE_SELF",
    });
  }

  const admins = await listSuperadminProfiles();
  const activeAdmins = admins.filter((item) => item.active);
  if (activeAdmins.length <= 1) {
    throw new AppError("O sistema precisa manter pelo menos um Superadmin ativo.", {
      statusCode: 409,
      code: "LAST_SUPERADMIN",
    });
  }

  const admin = await deactivateSuperadminProfile(id);
  if (!admin) {
    throw new AppError("Superadmin não encontrado.", {
      statusCode: 404,
      code: "SUPERADMIN_NOT_FOUND",
    });
  }

  await writeSuperadminAudit({
    actorId: actor.id,
    action: "superadmin.deactivated",
    entityId: id,
    metadata: { email: admin.email, full_name: admin.full_name },
  });

  return admin;
}
