import Foundation
import React

/**
 * Minimal native HTTP module that makes GET requests without following redirects.
 * Returns the status code, Location header, and Set-Cookie headers.
 *
 * This is needed for OIDC authentication where we must capture the 302 redirect
 * from ABS to the IdP, then store the session cookie for the token exchange.
 *
 * The ObjC bridge (NativeHttpModule.m) handles RCT_EXTERN_MODULE registration.
 */
@objc(NativeHttpModule)
class NativeHttpModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  /// Make a GET request without following redirects.
  /// Returns { status, location, cookies[] }
  @objc func getWithoutRedirect(_ url: String,
                                 resolver resolve: @escaping RCTPromiseResolveBlock,
                                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let requestUrl = URL(string: url) else {
      reject("INVALID_URL", "Invalid URL: \(url)", nil)
      return
    }

    let config = URLSessionConfiguration.ephemeral
    config.httpShouldSetCookies = true
    config.httpCookieAcceptPolicy = .always
    config.timeoutIntervalForRequest = 15

    let delegate = NoRedirectDelegate()
    let session = URLSession(configuration: config, delegate: delegate, delegateQueue: nil)

    session.dataTask(with: requestUrl) { _, response, error in
      defer { session.finishTasksAndInvalidate() }

      if let error = error {
        reject("HTTP_ERROR", error.localizedDescription, error)
        return
      }

      guard let httpResponse = response as? HTTPURLResponse else {
        reject("HTTP_ERROR", "No HTTP response", nil)
        return
      }

      let location = httpResponse.allHeaderFields["Location"] as? String ?? ""

      // Collect Set-Cookie headers
      let cookies: [String]
      if let headerFields = httpResponse.allHeaderFields as? [String: String],
         let responseUrl = httpResponse.url {
        let httpCookies = HTTPCookie.cookies(withResponseHeaderFields: headerFields, for: responseUrl)
        cookies = httpCookies.map { cookie in
          "\(cookie.name)=\(cookie.value); path=\(cookie.path); domain=\(cookie.domain)"
        }
      } else {
        cookies = []
      }

      resolve([
        "status": httpResponse.statusCode,
        "location": location,
        "cookies": cookies,
      ] as [String: Any])
    }.resume()
  }

  /// Make a GET request WITH cookies attached (for token exchange).
  /// Returns { status, body }
  @objc func getWithCookies(_ url: String,
                              cookies: [String],
                              resolver resolve: @escaping RCTPromiseResolveBlock,
                              rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let requestUrl = URL(string: url) else {
      reject("INVALID_URL", "Invalid URL: \(url)", nil)
      return
    }

    var request = URLRequest(url: requestUrl)
    request.httpMethod = "GET"
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.timeoutInterval = 15

    // Build cookie header from raw cookie strings
    let cookieHeader = cookies
      .compactMap { raw -> String? in
        let parts = raw.components(separatedBy: ";")
        return parts.first?.trimmingCharacters(in: .whitespaces)
      }
      .joined(separator: "; ")
    if !cookieHeader.isEmpty {
      request.setValue(cookieHeader, forHTTPHeaderField: "Cookie")
    }

    let config = URLSessionConfiguration.ephemeral
    let delegate = NoRedirectDelegate()
    let session = URLSession(configuration: config, delegate: delegate, delegateQueue: nil)

    session.dataTask(with: request) { data, response, error in
      defer { session.finishTasksAndInvalidate() }

      if let error = error {
        reject("HTTP_ERROR", error.localizedDescription, error)
        return
      }

      guard let httpResponse = response as? HTTPURLResponse else {
        reject("HTTP_ERROR", "No HTTP response", nil)
        return
      }

      let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""

      resolve([
        "status": httpResponse.statusCode,
        "body": body,
      ] as [String: Any])
    }.resume()
  }
}

/// URLSession delegate that prevents following redirects
private class NoRedirectDelegate: NSObject, URLSessionTaskDelegate {
  func urlSession(_ session: URLSession,
                  task: URLSessionTask,
                  willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest request: URLRequest,
                  completionHandler: @escaping (URLRequest?) -> Void) {
    completionHandler(nil)
  }
}
