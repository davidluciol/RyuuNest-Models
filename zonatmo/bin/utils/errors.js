/** Error tipado del contrato (SPEC §6.4): el runtime lo reconoce por su forma. */
export function fail(code, message, details) {
  const error = new Error(message);
  error.name = "ModuleError";
  error.code = code;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}
