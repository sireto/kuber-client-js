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
  delayMs = 500,
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
        if (error.response.data) {
          let errorMessageText = `Api Error response [${error.response.status}] : ${JSON.stringify(error.response.data)}`;
          const tempError = new L1TxSubmitError(errorMessageText, error.response.status, error.response.data);

          if (tempError.parsedData && tempError.parsedData.tag === "PostTxOnChainFailed") {
            if (tempError.parsedData.postTxError && tempError.parsedData.postTxError.tag) {
              errorMessageText = `Api Error response [${error.response.status}] : ${tempError.parsedData.postTxError.tag}`;
            }
            errorMessage = new L1TxSubmitError(errorMessageText, error.response.status, error.response.data);
          } else {
            errorMessage = new APIError(
              `Api Error response [${error.response.status}] : ${JSON.stringify(error.response.data)}`,
              error.response.status,
              { data: error.response.data },
            );
          }
        } else {
          errorMessage = new APIError(`Api Error response [${error.response.status}]`, error.response.status, {});
        }
      } else if (error.request) {
        errorMessage = new APIError(
          "Error making Request",
          ErrorStatusCodes[error.code as keyof typeof ErrorStatusCodes] || 500,
          { url: error.request._currentUrl },
        );
      }

      if (retryError(errorMessage.status)) {
        // handle proper logging
        logError(errorMessage, error, log, attempt, maxRetries);
        // Stop retrying if max retries are reached
        if (attempt > maxRetries && attempt > 1) {
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
    console.log(`[ ${error.response.status} ]`);
    if (error.response.headers) {
      for (const [key, value] of Object.entries(error.response.headers)) {
        console.log(`  ${key} : ${value}`);
      }
    }
    console.log(error.response.data);
  } else if (errorMessage.message == "Error making Request") {
    console.log(
      `${log} ❌ Attempt ${attempt}/${maxRetries + 1} failed: Request sent but no response received. [ERROR]: ${
        error.code
      }. ${error.request._currentUrl ? `Request URL: ${error.request._currentUrl}` : ""}`,
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

    if (options.data) this.data = options.data!;
    if (options.url) this.url = options.url;

    // Restore prototype chain (important for instanceof checks)
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

export class L1TxSubmitError extends APIError {
  public rawData: any;

  constructor(message: string, status: number, data: any) {
    super(message, status, { data: typeof data === "string" ? data : JSON.stringify(data) });
    this.name = "L1TxSubmitError";
    this.rawData = data; // Store the raw data
    Object.setPrototypeOf(this, L1TxSubmitError.prototype);
  }

  get parsedData(): any {
    if (typeof this.rawData === "string") {
      try {
        return JSON.parse(this.rawData);
      } catch (e) {
        return this.rawData; // Return raw string if parsing fails
      }
    }
    return this.rawData;
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

export const respondWithError = (error: any) => {
  if (error instanceof APIError) {
    const errorData = error.data ? { data: error.data } : undefined;
    const errorUrl = error.url ? { url: error.url } : undefined;
    throw new Error(
      JSON.stringify({
        message: error.message,
        status: error.status,
        ...errorData,
        ...errorUrl,
      }),
    );
  }
  throw new Error(error.message);
};
