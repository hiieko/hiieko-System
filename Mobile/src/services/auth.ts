/**
 * Auth Service for HIIEKO Mobile
 * 
 * Handles authentication with NestJS backend and local user persistence.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from './database';
import { apiClient } from './apiClient';

const AUTH_TOKEN_KEY = '@hiieko:auth_token';
const AUTH_USER_KEY = '@hiieko:auth_user';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization_id?: string;
}

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<User> {
  try {
    const response = await apiClient.login({
      email: email.trim().toLowerCase(),
      password,
    });

    const { user, accessToken } = response.data;

    // Store token
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    
    // Set token in API client
    apiClient.setToken(accessToken);

    // Store user in SQLite
    await saveUserToDatabase(user, accessToken);

    console.log('✅ Login successful:', user.email);
    return user;
  } catch (error) {
    console.error('❌ Login failed:', error);
    throw error;
  }
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(AUTH_USER_KEY);
    apiClient.setToken(null);

    // Clear user from database
    const db = await getDatabase();
    await db.runAsync('DELETE FROM user');

    console.log('✅ Logout successful');
  } catch (error) {
    console.error('❌ Logout error:', error);
  }
}

/**
 * Get current user from storage
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const userJson = await AsyncStorage.getItem(AUTH_USER_KEY);
    if (!userJson) return null;

    const user = JSON.parse(userJson);
    return user;
  } catch (error) {
    console.error('❌ Get current user error:', error);
    return null;
  }
}

/**
 * Get stored token
 */
export async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('❌ Get token error:', error);
    return null;
  }
}

/**
 * Initialize auth on app start
 */
export async function initializeAuth(): Promise<User | null> {
  try {
    const token = await getStoredToken();
    if (!token) return null;

    // Set token in API client
    apiClient.setToken(token);

    // Verify token with backend
    const response = await apiClient.getMe();
    const user = response.data;

    // Update stored user
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    await saveUserToDatabase(user, token);

    console.log('✅ Auth initialized:', user.email);
    return user;
  } catch (error) {
    console.error('❌ Auth initialization failed:', error);
    // Token expired or invalid, clear auth
    await logout();
    return null;
  }
}

/**
 * Save user to SQLite database
 */
async function saveUserToDatabase(user: User, token: string): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO user (id, email, full_name, role, organization_id, token, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.email,
      user.full_name,
      user.role,
      user.organization_id || null,
      token,
      new Date().toISOString(),
    ]
  );
}

/**
 * Get user from SQLite (for offline access)
 */
export async function getUserFromDatabase(): Promise<User | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>('SELECT * FROM user LIMIT 1');
    
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      organization_id: row.organization_id,
    };
  } catch (error) {
    console.error('❌ Get user from database error:', error);
    return null;
  }
}
