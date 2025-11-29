/**
 * src/core/api/baseClient.ts
 * 
 * Base HTTP client for AudiobookShelf API with configuration and core HTTP methods.
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { ApiClientConfig } from '../types/api';

/**
 * Base API client with HTTP methods and configuration
 */
export class BaseApiClient {
  protected axiosInstance: AxiosInstance;
  protected baseURL: string = '';
  protected authToken: string = '';

  constructor() {
    // Initialize axios instance with default config
    this.axiosInstance = axios.create({
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Configure the API client with base URL and optional auth token
   */
  configure(config: ApiClientConfig): void {
    this.baseURL = config.baseURL;
    this.authToken = config.token || '';
    
    this.axiosInstance.defaults.baseURL = this.baseURL;
    
    if (config.timeout) {
      this.axiosInstance.defaults.timeout = config.timeout;
    }
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.authToken = '';
  }

  /**
   * Get current base URL
   */
  getBaseURL(): string {
    return this.baseURL;
  }
    /**
   * Get current auth token
   */
  getAuthToken(): string {
    return this.authToken;
  }
  /**
   * Handle API errors and format them consistently
   */
  protected handleError(error: AxiosError): Error {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const message = (error.response.data as any)?.error || error.message;

      switch (status) {
        case 401:
          return new Error('Unauthorized - please login again');
        case 403:
          return new Error('Forbidden - insufficient permissions');
        case 404:
          return new Error('Resource not found');
        case 500:
          return new Error('Server error - please try again later');
        default:
          return new Error(`API error (${status}): ${message}`);
      }
    } else if (error.request) {
      // Request made but no response received
      return new Error('Network error - please check your connection');
    } else {
      // Error setting up the request
      return new Error(`Request error: ${error.message}`);
    }
  }

  // ==================== Core HTTP Methods ====================

  /**
   * Perform GET request
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosInstance.get<T>(url, config);
      return response.data;
    } catch (error) {
      console.error(`GET ${url} failed:`, error);
      throw error;
    }
  }

  /**
   * Perform POST request
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosInstance.post<T>(url, data, config);
      return response.data;
    } catch (error) {
      console.error(`POST ${url} failed:`, error);
      throw error;
    }
  }

  /**
   * Perform PATCH request
   */
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosInstance.patch<T>(url, data, config);
      return response.data;
    } catch (error) {
      console.error(`PATCH ${url} failed:`, error);
      throw error;
    }
  }

  /**
   * Perform PUT request
   */
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosInstance.put<T>(url, data, config);
      return response.data;
    } catch (error) {
      console.error(`PUT ${url} failed:`, error);
      throw error;
    }
  }

  /**
   * Perform DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosInstance.delete<T>(url, config);
      return response.data;
    } catch (error) {
      console.error(`DELETE ${url} failed:`, error);
      throw error;
    }
  }
}
