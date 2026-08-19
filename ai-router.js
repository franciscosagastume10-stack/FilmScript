export const AI_MODELS = Object.freeze({
  sol: "gpt-5.6-sol",
  terra: "gpt-5.6-terra",
  luna: "gpt-5.6-luna",
});

export const AI_TASK_ROUTE = Object.freeze({
  analysis: "sol", partial_analysis: "sol", breakdown: "sol", breakdown_scene: "sol",
  shot_list: "sol", shot_list_update: "sol", translation: "sol", chat: "luna",
});

// These names are server vocabulary, not product language. Keeping the
// complete catalogue here makes job validation and recovery deterministic
// without ever exposing a provider or model choice to the browser.
export const AI_JOB_TYPES = Object.freeze([
  "analysis", "breakdown", "breakdown_scene", "shot_list", "translation",
]);

export const AI_JOB_MODULE = Object.freeze({
  analysis: "analysis",
  breakdown: "breakdown",
  breakdown_scene: "breakdown",
  shot_list: "shot_list",
  translation: "script",
});

const NON_RETRYABLE_CODES = new Set([
  "invalid_input", "permission_denied", "financial_permission_denied", "insufficient_credits",
  "corrupt_script", "unsupported_structure", "cancelled", "user_cancelled",
]);

export function isAIJobType(value) {
  return AI_JOB_TYPES.includes(String(value || ""));
}

export function moduleForAIJob(value) {
  return AI_JOB_MODULE[String(value || "")] || null;
}

export function modelForTask(task, env = process.env) {
  const tier = AI_TASK_ROUTE[task] || "luna";
  const key = `FILMSCRIPT_AI_MODEL_${tier.toUpperCase()}`;
  return String(env[key] || AI_MODELS[tier]).trim() || AI_MODELS[tier];
}

export function isRetryableAIError(error) {
  if (NON_RETRYABLE_CODES.has(String(error?.code || ""))) return false;
  const status = Number(error?.status || error?.statusCode || 0);
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500 || error?.name === "AbortError";
}

export async function routeAIRequest({ task, request, invoke, onAttempt = () => {} }) {
  const primaryModel = modelForTask(task);
  onAttempt({ model: primaryModel, fallback: false });
  try {
    const result = await invoke({ ...request, model: primaryModel });
    return { result, completedModel: primaryModel, usedFallback: false, attempts: [{ model: primaryModel, fallback: false }] };
  } catch (error) {
    if (AI_TASK_ROUTE[task] !== "sol" || !isRetryableAIError(error)) throw error;
    const fallbackModel = String(process.env.FILMSCRIPT_AI_MODEL_TERRA || AI_MODELS.terra).trim() || AI_MODELS.terra;
    onAttempt({ model: fallbackModel, fallback: true, error });
    const result = await invoke({ ...request, model: fallbackModel });
    return {
      result,
      completedModel: fallbackModel,
      usedFallback: true,
      attempts: [
        { model: primaryModel, fallback: false, errorCode: String(error?.code || "provider_retryable") },
        { model: fallbackModel, fallback: true },
      ],
    };
  }
}

export function publicAIJob(job) {
  if (!job || typeof job !== "object") return job;
  // Inputs can contain a scene focus, a language choice, or an internal
  // reservation reference. They are intentionally not a browser contract.
  const { internalPrimaryModel, internalCompletedModel, usedFallback, input, created, ...safe } = job;
  return safe;
}
