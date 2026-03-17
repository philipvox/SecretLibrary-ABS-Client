import Foundation
import GoogleCast

/**
 * iOS native module for Google Cast (Chromecast) support.
 * Mirrors the Android CastModule API for cross-platform compatibility.
 */
@objc(CastModule)
class CastModule: RCTEventEmitter {

  private var sessionManager: GCKSessionManager {
    GCKCastContext.sharedInstance().sessionManager
  }

  private var hasListeners = false
  private var statusTimer: Timer?

  override init() {
    super.init()
    setupCastContext()
  }

  private func setupCastContext() {
    let options = GCKCastOptions(discoveryCriteria:
      GCKDiscoveryCriteria(applicationID: kGCKDefaultMediaReceiverApplicationID))
    GCKCastContext.setSharedInstanceWith(options)
    sessionManager.add(self)
  }

  @objc override static func requiresMainQueueSetup() -> Bool { true }

  override func supportedEvents() -> [String] {
    return [
      "onSessionStarted",
      "onSessionEnded",
      "onSessionStartFailed",
      "onMediaStatusUpdate",
      "onDevicesDiscovered",
    ]
  }

  override func startObserving() { hasListeners = true }
  override func stopObserving() {
    hasListeners = false
    stopMediaStatusPolling()
  }

  // MARK: - Discovery

  @objc func startDiscovery(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      GCKCastContext.sharedInstance().discoveryManager.startDiscovery()
      resolve(true)
    }
  }

  @objc func getAvailableDevices(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let discoveryManager = GCKCastContext.sharedInstance().discoveryManager
      var devices: [[String: Any]] = []
      for i in 0..<discoveryManager.deviceCount {
        let device = discoveryManager.device(at: i)
        devices.append([
          "id": device.deviceID,
          "name": device.friendlyName ?? "Unknown",
          "isConnected": self.sessionManager.currentCastSession?.connectionState == .connected
            && self.sessionManager.currentCastSession?.device?.deviceID == device.deviceID,
        ])
      }
      resolve(devices)
    }
  }

  @objc func showCastPicker(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      GCKCastContext.sharedInstance().presentCastDialog()
      resolve(true)
    }
  }

  // MARK: - Media Control

  @objc func loadMedia(_ url: String, title: String, author: String, coverUrl: String, position: Double,
                       resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let client = self.sessionManager.currentCastSession?.remoteMediaClient else {
        reject("NO_CLIENT", "No remote media client", nil)
        return
      }

      let metadata = GCKMediaMetadata(metadataType: .musicTrack)
      metadata.setString(title, forKey: kGCKMetadataKeyTitle)
      metadata.setString(author, forKey: kGCKMetadataKeyArtist)
      if !coverUrl.isEmpty, let imageUrl = URL(string: coverUrl) {
        metadata.addImage(GCKImage(url: imageUrl, width: 800, height: 800))
      }

      guard let mediaURL = URL(string: url) else {
        reject("INVALID_URL", "Invalid media URL", nil)
        return
      }
      let builder = GCKMediaInformationBuilder(contentURL: mediaURL)
      builder.streamType = .buffered
      builder.contentType = "audio/mp4"
      builder.metadata = metadata

      let options = GCKMediaLoadOptions()
      options.autoplay = true
      options.playPosition = position

      let request = client.loadMedia(builder.build(), with: options)
      request.delegate = RequestDelegate(resolve: resolve, reject: reject)
      self.startMediaStatusPolling()
    }
  }

  @objc func play(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let client = self.sessionManager.currentCastSession?.remoteMediaClient else {
        reject("NO_CLIENT", "No remote media client", nil)
        return
      }
      client.play()
      resolve(true)
    }
  }

  @objc func pause(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let client = self.sessionManager.currentCastSession?.remoteMediaClient else {
        reject("NO_CLIENT", "No remote media client", nil)
        return
      }
      client.pause()
      resolve(true)
    }
  }

  @objc func seek(_ position: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let client = self.sessionManager.currentCastSession?.remoteMediaClient else {
        reject("NO_CLIENT", "No remote media client", nil)
        return
      }
      let options = GCKMediaSeekOptions()
      options.interval = position
      client.seek(with: options)
      resolve(true)
    }
  }

  @objc func stop(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let client = self.sessionManager.currentCastSession?.remoteMediaClient else {
        reject("NO_CLIENT", "No remote media client", nil)
        return
      }
      client.stop()
      resolve(true)
    }
  }

  @objc func disconnect(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.sessionManager.endSessionAndStopCasting(true)
      resolve(true)
    }
  }

  @objc func getPosition(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let client = self.sessionManager.currentCastSession?.remoteMediaClient else {
        resolve(-1.0)
        return
      }
      resolve(client.approximateStreamPosition())
    }
  }

  @objc func isConnected(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      resolve(self.sessionManager.currentCastSession?.connectionState == .connected)
    }
  }

  // MARK: - Status Polling

  private func startMediaStatusPolling() {
    stopMediaStatusPolling()
    statusTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
      self?.emitMediaStatus()
    }
  }

  private func stopMediaStatusPolling() {
    statusTimer?.invalidate()
    statusTimer = nil
  }

  private func emitMediaStatus() {
    guard hasListeners,
          let client = sessionManager.currentCastSession?.remoteMediaClient,
          let status = client.mediaStatus else { return }

    sendEvent(withName: "onMediaStatusUpdate", body: [
      "position": client.approximateStreamPosition(),
      "duration": status.mediaInformation?.streamDuration ?? 0,
      "isPlaying": status.playerState == .playing,
      "isPaused": status.playerState == .paused,
      "isIdle": status.playerState == .idle,
    ])
  }
}

// MARK: - GCKSessionManagerListener

extension CastModule: GCKSessionManagerListener {
  func sessionManager(_ sessionManager: GCKSessionManager, didStart session: GCKCastSession) {
    guard hasListeners else { return }
    sendEvent(withName: "onSessionStarted", body: [
      "sessionId": session.sessionID ?? "",
      "deviceName": session.device?.friendlyName ?? "Unknown",
    ])
  }

  func sessionManager(_ sessionManager: GCKSessionManager, didEnd session: GCKCastSession, withError error: Error?) {
    stopMediaStatusPolling()
    guard hasListeners else { return }
    sendEvent(withName: "onSessionEnded", body: [
      "error": error?.localizedDescription ?? "",
    ])
  }

  func sessionManager(_ sessionManager: GCKSessionManager, didFailToStart session: GCKCastSession, withError error: Error) {
    guard hasListeners else { return }
    sendEvent(withName: "onSessionStartFailed", body: [
      "error": error.localizedDescription,
    ])
  }
}

// MARK: - Request Delegate

private class RequestDelegate: NSObject, GCKRequestDelegate {
  let resolve: RCTPromiseResolveBlock
  let reject: RCTPromiseRejectBlock

  init(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    self.resolve = resolve
    self.reject = reject
  }

  func requestDidComplete(_ request: GCKRequest) {
    resolve(true)
  }

  func request(_ request: GCKRequest, didFailWithError error: GCKError) {
    reject("LOAD_ERROR", error.localizedDescription, error)
  }
}
