import { refreshToken } from './authService';

// A custom event that will be dispatched to trigger a global logout in the UI.
export const forceLogoutEvent = new Event('forceLogout');

let isRefreshing = false;
// A queue to hold API requests that failed due to an expired token while a refresh is in progress.
let failedQueue: { resolve: (value: any) => void; reject: (reason?: any) => void; }[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      // Resolve with the new token so the request can be retried
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    window.dispatchEvent(forceLogoutEvent);
};

/**
 * A wrapper around the native `fetch` API that automatically handles
 * adding the Authorization header and refreshing the access token when it expires.
 * @param url The URL to fetch.
 * @param options The options for the fetch request.
 * @returns A promise that resolves to the Response object.
 */
export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const makeRequest = async (token: string | null): Promise<Response> => {
        const headers = new Headers(options.headers);
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }
        
        const method = (options.method || 'GET').toString().toUpperCase();
        const hasBody = options.body !== undefined && options.body !== null;
        if (hasBody && !(options.body instanceof FormData)) {
            if (!headers.has('Content-Type')) {
                headers.set('Content-Type', 'application/json');
            }
        }

        return fetch(url, { ...options, headers });
    };
    
    const token = localStorage.getItem('authToken');
    let response = await makeRequest(token);
    
    if (response.status === 401) {
        // Clone the response to read its body without consuming it,
        // allowing the caller to process the body as well if needed.
        const clonedResponse = response.clone();
        const errorBody = await clonedResponse.json().catch(() => ({}));
        
        const isAuthError = errorBody.detail === "Invalid or expired token" || errorBody.detail === "Not authenticated";

        if (isAuthError) {
            if (isRefreshing) {
                // If a token refresh is already in progress, add this request to the queue.
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(newToken => {
                    return makeRequest(newToken as string);
                });
            }

            isRefreshing = true;

            // This is the first request to fail, so it triggers the token refresh.
            return new Promise(async (resolve, reject) => {
                try {
                    const refreshData = await refreshToken();
                    if (refreshData?.token) {
                        localStorage.setItem('authToken', refreshData.token);
                        // The refresh endpoint might issue a new refresh token.
                        if (refreshData.refreshToken) {
                            localStorage.setItem('refreshToken', refreshData.refreshToken);
                        }
                        // Process the queue of failed requests with the new token.
                        processQueue(null, refreshData.token);
                        // Retry the original request and resolve the promise with its response.
                        resolve(await makeRequest(refreshData.token));
                    } else {
                        // If refresh fails, trigger a logout.
                        throw new Error('Session expired. Please log in again.');
                    }
                } catch (error) {
                    handleLogout();
                    processQueue(error as Error, null);
                    reject(error);
                } finally {
                    isRefreshing = false;
                }
            });
        }
    }

    return response;
};
