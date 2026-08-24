import { AppError } from "@/src/shared/errors/app-error";

export function jsonResponse(payload, status = 200) {
  return Response.json(payload, { status });
}

export function successResponse(data, status = 200) {
  return jsonResponse({ data }, status);
}

export function handleApiError(error) {
  if (error instanceof AppError) {
    return jsonResponse(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      error.statusCode
    );
  }

  if (error instanceof SyntaxError) {
    return jsonResponse(
      {
        error: {
          code: "INVALID_JSON",
          message: "O corpo da requisição contém JSON inválido.",
        },
      },
      400
    );
  }

  console.error("[API_ERROR]", error);

  return jsonResponse(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Não foi possível concluir a operação.",
      },
    },
    500
  );
}
