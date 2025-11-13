

import type { User, LoginResponse } from '../types';

const API_BASE_URL = 'https://1f78112e7eab.ngrok-free.app';

const getErrorMessage = (errorBody: any): string => {
    if (!errorBody || !errorBody.detail) {
        return 'An unknown error occurred.';
    }

    // Handle simple string details, e.g., { "detail": "LOGIN_BAD_CREDENTIALS" }
    if (typeof errorBody.detail === 'string') {
        return errorBody.detail;
    }

    // Handle FastAPI validation error arrays, e.g., { "detail": [ { "loc": [...], "msg": "..." } ] }
    if (Array.isArray(errorBody.detail)) {
        try {
            // Return the first validation error message, which is usually sufficient
            const firstError = errorBody.detail[0];
            if (firstError && firstError.msg) {
                // Prepend the field name for more context if available
                if (firstError.loc && firstError.loc.length > 1) {
                    return `${firstError.loc[1]}: ${firstError.msg}`;
                }
                return firstError.msg;
            }
        } catch (e) {
            return 'Invalid input. Please check the form fields.';
        }
    }

    // Fallback for other unexpected object structures
    return 'An unexpected error occurred. Please try again.';
};

/**
 * Decodes a JWT token to extract its payload.
 * Note: This does not validate the token's signature.
 * @param token The JWT string.
 * @returns The decoded payload object or null if decoding fails.
 */
const decodeToken = (token: string): { [key: string]: any } | null => {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Failed to decode token:', error);
        return null;
    }
};

export const refreshToken = async (): Promise<{ token: string; refreshToken?: string } | null> => {
    const currentRefreshToken = localStorage.getItem('refreshToken');
    if (!currentRefreshToken) return null;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentRefreshToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.error('Refresh token request failed with status:', response.status);
            return null;
        }

        const data = await response.json();
        if (!data.access_token) {
            console.error('Refresh response missing access_token');
            return null;
        }
        
        // The refresh endpoint may optionally return a new refresh token
        return { token: data.access_token, refreshToken: data.refresh_token };

    } catch (error) {
        console.error('An exception occurred during token refresh:', error);
        return null;
    }
};


export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: email, password: password }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: 'Invalid credentials or server error.' }));
    throw new Error(getErrorMessage(errorBody));
  }

  const data = await response.json();
  
  if (!data.access_token || !data.refresh_token) {
      throw new Error('Login response did not include the necessary tokens.');
  }
  
  const user: User = {
    id: data.user_id,
    email: data.email,
    username: data.username,
    subscription_tier: data.subscription_tier,
  };

  return { token: data.access_token, refreshToken: data.refresh_token, user };
};

export const register = async (email: string, password: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ detail: 'Registration failed. The email might already be in use.' }));
        throw new Error(getErrorMessage(errorBody));
    }

    return response.json();
};


export const getUserProfile = (token: string): Promise<User> => {
    return new Promise((resolve, reject) => {
        const decodedToken = decodeToken(token);
        if (!decodedToken) {
            return reject(new Error('Invalid token: Could not decode token.'));
        }

        const userId = decodedToken?.sub;
        if (!userId) {
            return reject(new Error('Invalid token: Could not find user ID in token.'));
        }

        const user: User = {
            id: userId,
            email: decodedToken.email,
            username: decodedToken.user_metadata?.username,
            subscription_tier: decodedToken.user_metadata?.subscription_tier,
        };
        
        resolve(user);
    });
};

export const logout = async (token: string): Promise<void> => {
    // The backend endpoint at /api/auth/logout was returning a 404 Not Found error.
    // To ensure a smooth user experience, the remote API call is temporarily disabled.
    // The application will proceed with a client-side only logout, which involves
    // clearing local storage and state, effectively signing the user out of the app.
    console.log("Performing client-side logout. Backend endpoint is currently unavailable.");
    return Promise.resolve();
};