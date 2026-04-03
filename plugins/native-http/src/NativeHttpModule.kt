package com.secretlibrary.app.nativehttp

import com.facebook.react.bridge.*
import java.net.HttpURLConnection
import java.net.URL

/**
 * Minimal native HTTP module that makes GET requests without following redirects.
 * Returns the status code, Location header, and Set-Cookie headers.
 *
 * This is needed for OIDC authentication where we must capture the 302 redirect
 * from ABS to the IdP, then store the session cookie for the token exchange.
 */
class NativeHttpModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "NativeHttpModule"

    /**
     * Make a GET request without following redirects.
     * Returns { status, location, cookies[] }
     */
    @ReactMethod
    fun getWithoutRedirect(url: String, promise: Promise) {
        Thread {
            try {
                val connection = URL(url).openConnection() as HttpURLConnection
                connection.instanceFollowRedirects = false
                connection.requestMethod = "GET"
                connection.connectTimeout = 15000
                connection.readTimeout = 15000

                val status = connection.responseCode
                val location = connection.getHeaderField("Location") ?: ""

                // Collect all Set-Cookie headers
                val cookies = WritableNativeArray()
                var i = 1
                while (true) {
                    val key = connection.getHeaderFieldKey(i) ?: break
                    if (key.equals("Set-Cookie", ignoreCase = true)) {
                        val value = connection.getHeaderField(i)
                        if (value != null) cookies.pushString(value)
                    }
                    i++
                }

                connection.disconnect()

                val result = WritableNativeMap()
                result.putInt("status", status)
                result.putString("location", location)
                result.putArray("cookies", cookies)
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("HTTP_ERROR", e.message, e)
            }
        }.start()
    }

    /**
     * Make a GET request WITH cookies attached (for token exchange).
     * Sends the provided cookies and returns the response body as text.
     * Returns { status, body }
     */
    @ReactMethod
    fun getWithCookies(url: String, cookies: ReadableArray, promise: Promise) {
        Thread {
            try {
                val connection = URL(url).openConnection() as HttpURLConnection
                connection.instanceFollowRedirects = false
                connection.requestMethod = "GET"
                connection.connectTimeout = 15000
                connection.readTimeout = 15000
                connection.setRequestProperty("Accept", "application/json")

                // Attach cookies
                val cookieHeader = (0 until cookies.size())
                    .map { cookies.getString(it) }
                    .mapNotNull { raw -> raw?.substringBefore(";")?.trim() }
                    .joinToString("; ")
                if (cookieHeader.isNotEmpty()) {
                    connection.setRequestProperty("Cookie", cookieHeader)
                }

                val status = connection.responseCode
                val body = try {
                    if (status in 200..299) {
                        connection.inputStream.bufferedReader().readText()
                    } else {
                        connection.errorStream?.bufferedReader()?.readText() ?: ""
                    }
                } catch (_: Exception) { "" }

                connection.disconnect()

                val result = WritableNativeMap()
                result.putInt("status", status)
                result.putString("body", body)
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("HTTP_ERROR", e.message, e)
            }
        }.start()
    }
}
