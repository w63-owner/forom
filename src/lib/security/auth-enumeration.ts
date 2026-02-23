export type EmailCheckTransition = {
  nextStep: "signin"
  messageKey: "verifyAccountFallback"
}

/**
 * Uniform transition after email input to avoid exposing account existence via UI flow.
 */
export function getUniformEmailCheckTransition(): EmailCheckTransition {
  return {
    nextStep: "signin",
    messageKey: "verifyAccountFallback",
  }
}
