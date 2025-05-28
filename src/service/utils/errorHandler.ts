// export type APIError =
//   | { message: string; data: string; status: number }
//   | { message: string; url: string; status: number };

const ErrorStatusCodes = {
    ERR_FR_TOO_MANY_REDIRECTS: 310,
    ERR_BAD_OPTION_VALUE: 400,
    ERR_BAD_OPTION: 400,
    ERR_NETWORK: 503,
    ERR_DEPRECATED: 410,
    ERR_BAD_RESPONSE: 502,
    ERR_BAD_REQUEST: 400,
    ERR_NOT_SUPPORT: 415,
    ERR_INVALID_URL: 400,
    ERR_CANCELED: 499,
    ECONNABORTED: 408,
    ETIMEDOUT: 408,
  };
  
  // retry in 429, all 500s except 503
  
  export async function handleApiError<T>(
    promiseFactory: () => Promise<T>,
    log: string,
    maxRetries = 0,
    delayMs = 500
  ): Promise<T | APIError> {
    let attempt = 0;
    let errorMessage: APIError = new APIError("unknown", 0, {});
    while (attempt <= maxRetries) {
      try {
        const result = await promiseFactory();
        if (attempt != 0) {
          console.log(`${log} ✅ Request succeeded on attempt ${attempt + 1}`);
        }
        return result;
      } catch (error: any) {
        attempt++;
  
        if (error.response) {
          errorMessage = new APIError("Error in Response", error.response.status, { data: error.response.data });
        } else if (error.request) {
          errorMessage = new APIError(
            "Error making Request",
            ErrorStatusCodes[error.code as keyof typeof ErrorStatusCodes] || 500,
            { url: error.request._currentUrl }
          );
        }
  
        if (retryError(errorMessage.status)) {
          // handle proper logging
          logError(errorMessage, error, log, attempt, maxRetries);
          // Stop retrying if max retries are reached
          if (attempt > maxRetries) {
            console.log(`${log} ⛔ Max retries reached. Giving up.`);
            return errorMessage;
          }
        } else {
          logError(errorMessage, error, log, 1, 0);
          return errorMessage;
        }
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  
    return errorMessage; // Should never reach here, but just in case
  }
  
  export function isApiError(data: any): boolean {
    if (data === null || data === undefined) {
      return false;
    }
    if (typeof data == "object") {
      const keys = Object.keys(data);
      if (keys.length === 3) {
        if (keys.includes("message") && keys.includes("status") && (keys.includes("data") || keys.includes("url"))) {
          return true;
        }
      }
    }
    return false;
  }
  
  export function apiError(message: string, data: any, status: number): APIError {
    return new APIError(message, status, { data: data });
  }
  
  const retryError = (status: number) => {
    return status == 429 || (status >= 500 && status != 503);
  };
  
  const logError = (errorMessage: APIError, error: any, log: string, attempt: number, maxRetries: number) => {
    if (errorMessage.message == "Error in Response") {
      console.log(`${log} ❌ Attempt ${attempt}/${maxRetries + 1} failed:`);
      console.log("Response Data:", error.response.data);
      console.log("Response Status:", error.response.status);
      console.log("Response Headers:", error.response.headers);
    } else if (errorMessage.message == "Error making Request") {
      console.log(
        `${log} ❌ Attempt ${attempt}/${maxRetries + 1} failed: Request sent but no response received. [ERROR]: ${
          error.code
        }. ${error.request._currentUrl ? `Request URL: ${error.request._currentUrl}` : ""}`
      );
    } else {
      console.log(`${log} ❌ Attempt ${attempt}/${maxRetries + 1} failed: Error:`, error.message);
    }
  };
  
  export class APIError extends Error {
    public status: number;
    public data?: string;
    public url?: string;
  
    constructor(message: string, status: number, options: { data?: string; url?: string } = {}) {
      super(message);
      this.name = "APIError";
      this.status = status;
  
      if (options.data) this.data = options.data;
      if (options.url) this.url = options.url;
  
      // Restore prototype chain (important for instanceof checks)
      Object.setPrototypeOf(this, APIError.prototype);
    }
  }
  
  export const throwOrGo = (res: any) => {
    if (res instanceof APIError) {
      throw res;
    } else if (res.data) {
      return res.data;
    } else {
      return res;
    }
  };
  
  export const respondWithError = (res: any, error: any, customMessage: string) => {
    if (error instanceof APIError) {
      const errorData = error.data ? { data: error.data } : undefined;
      const errorUrl = error.url ? { url: error.url } : undefined;
      return res.status(error.status).json({ message: error.message, status: error.status, ...errorData, ...errorUrl });
    } else {
      res.status(500).json({ error: customMessage, details: error.message });
    }
  };
  