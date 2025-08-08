import { AxiosInstance } from "axios";
import { handleApiError, throwOrGo } from "./errorHandler";
import { RetryConfig } from "./type";

export async function get(service: AxiosInstance, functionName: string, path: string, retry?: RetryConfig) {
  const response = await handleApiError(
    () => service.get(path),
    `[${functionName}] : ${path}`,
    retry?.maxRetries,
    retry?.delayInMS,
  );
  return throwOrGo(response);
}

export async function post(service: AxiosInstance, name: string, path: string, data?: any, retry?: RetryConfig) {
  const response = await handleApiError(
    () => service.post(path, data),
    `[${name}] : ${path}`,
    retry?.maxRetries,
    retry?.delayInMS,
  );
  return throwOrGo(response);
}
