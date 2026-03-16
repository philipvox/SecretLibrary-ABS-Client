import ExpoModulesCore
import AVFoundation
import MediaPlayer

// MARK: - Track Info

private struct TrackInfo {
    let url: URL
    let title: String
    let startOffset: Double   // Global position where this track starts (seconds)
    let duration: Double      // Track duration (seconds)
}

// MARK: - AVPlayerModule

public class AVPlayerModule: Module {

    // MARK: - Properties

    private var player: AVPlayer?
    private var tracks: [TrackInfo] = []
    private var currentTrackIndex: Int = 0
    private var totalDuration: Double = 0.0
    private var isInitialized = false

    // Position tracking
    private var timeObserverToken: Any?
    private var lastEmittedPosition: Double = 0.0

    // Stuck detection
    private var stuckCheckTimer: Timer?
    private var lastStuckCheckPosition: Double = 0.0
    private var lastStuckCheckTime: TimeInterval = 0.0
    private let stuckThresholdSeconds: Double = 3.0

    // Prepare timeout
    private var prepareTimeoutWork: DispatchWorkItem?
    private let prepareTimeoutSeconds: Double = 30.0

    // KVO observations
    private var statusObservation: NSKeyValueObservation?
    private var timeControlObservation: NSKeyValueObservation?

    // Notification observers
    private var itemDidPlayToEndObserver: NSObjectProtocol?
    private var interruptionObserver: NSObjectProtocol?
    private var routeChangeObserver: NSObjectProtocol?

    // Remote command targets
    private var playCommandTarget: Any?
    private var pauseCommandTarget: Any?
    private var skipForwardCommandTarget: Any?
    private var skipBackwardCommandTarget: Any?
    private var nextTrackCommandTarget: Any?
    private var previousTrackCommandTarget: Any?
    private var changePositionCommandTarget: Any?
    private var playbackRateCommandTarget: Any?

    // Artwork loading
    private var artworkTask: URLSessionDataTask?
    private var currentArtworkUrl: URL?

    // State
    private var currentRate: Float = 1.0
    private var isPlayingBeforeInterruption = false

    // MARK: - Module Definition

    public func definition() -> ModuleDefinition {
        Name("AVPlayerModule")

        Events(
            "AVPlayerPlaybackState",
            "AVPlayerTrackChange",
            "AVPlayerError",
            "AVPlayerBookEnd",
            "AVPlayerRemoteCommand"
        )

        AsyncFunction("initialize") { (promise: Promise) in
            self.initializePlayer(promise: promise)
        }

        AsyncFunction("loadTracks") { (tracks: [[String: Any]], startTrackIndex: Int, startPositionMs: Double, autoPlay: Bool, promise: Promise) in
            self.loadTracks(tracks: tracks, startTrackIndex: startTrackIndex, startPositionMs: startPositionMs, autoPlay: autoPlay, promise: promise)
        }

        Function("play") {
            self.play()
        }

        Function("pause") {
            self.pause()
        }

        Function("seekTo") { (globalPositionSec: Double) in
            self.seekTo(globalPositionSec: globalPositionSec)
        }

        Function("setRate") { (rate: Double) in
            self.setRate(rate: Float(rate))
        }

        Function("setVolume") { (volume: Double) in
            self.player?.volume = Float(max(0, min(1, volume)))
        }

        Function("setMetadata") { (title: String, artist: String, artworkUrl: String?, chapterTitle: String?) in
            self.updateNowPlayingInfo(title: title, artist: artist, artworkUrl: artworkUrl, chapterTitle: chapterTitle)
        }

        AsyncFunction("getCurrentState") { (promise: Promise) in
            let position = self.currentGlobalPosition()
            let isPlaying = self.player?.timeControlStatus == .playing
            let isBuffering = self.player?.timeControlStatus == .waitingToPlayAtSpecifiedRate
            promise.resolve([
                "isPlaying": isPlaying,
                "position": position,
                "duration": self.totalDuration,
                "isBuffering": isBuffering
            ] as [String: Any])
        }

        AsyncFunction("cleanup") { (promise: Promise) in
            self.cleanupPlayback()
            promise.resolve(nil)
        }

        OnDestroy {
            self.destroy()
        }
    }

    // MARK: - Initialize

    private func initializePlayer(promise: Promise) {
        if isInitialized {
            promise.resolve(nil)
            return
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio, options: [])
            try session.setActive(true)
        } catch {
            promise.reject("AUDIO_SESSION_ERROR", "Failed to configure AVAudioSession: \(error.localizedDescription)")
            return
        }

        // Create player
        player = AVPlayer()
        player?.automaticallyWaitsToMinimizeStalling = true

        // Observe timeControlStatus for play/pause/buffering state
        timeControlObservation = player?.observe(\.timeControlStatus, options: [.new]) { [weak self] player, _ in
            self?.handleTimeControlStatusChange(player.timeControlStatus)
        }

        // Set up interruption and route change observers
        setupAudioSessionObservers()

        // Set up remote command center
        setupRemoteCommandCenter()

        isInitialized = true
        promise.resolve(nil)
    }

    // MARK: - Load Tracks

    private func loadTracks(tracks rawTracks: [[String: Any]], startTrackIndex: Int, startPositionMs: Double, autoPlay: Bool, promise: Promise) {
        guard isInitialized, let player = player else {
            promise.reject("NOT_INITIALIZED", "AVPlayerModule not initialized. Call initialize() first.")
            return
        }

        // Clean up previous playback
        cleanupCurrentItem()

        // Parse track info
        var parsedTracks: [TrackInfo] = []
        for dict in rawTracks {
            guard let urlString = dict["url"] as? String,
                  let url = URL(string: urlString),
                  let title = dict["title"] as? String else {
                continue
            }
            let startOffset = (dict["startOffset"] as? Double) ?? 0.0
            let duration = (dict["duration"] as? Double) ?? 0.0
            parsedTracks.append(TrackInfo(url: url, title: title, startOffset: startOffset, duration: duration))
        }

        guard !parsedTracks.isEmpty else {
            promise.reject("NO_TRACKS", "No valid tracks provided")
            return
        }

        self.tracks = parsedTracks
        // Use lastTrack.startOffset + lastTrack.duration to match Android's calculation
        // and correctly handle any gaps/overlaps in track offsets
        let lastTrack = parsedTracks[parsedTracks.count - 1]
        self.totalDuration = lastTrack.startOffset + lastTrack.duration
        let trackIndex = max(0, min(startTrackIndex, parsedTracks.count - 1))
        self.currentTrackIndex = trackIndex

        // Calculate position within track
        let startPositionSec = startPositionMs / 1000.0
        let track = parsedTracks[trackIndex]
        let positionInTrack = max(0, startPositionSec - track.startOffset)

        // Create AVPlayerItem for the target track
        let item = AVPlayerItem(url: track.url)

        // Observe item status for readyToPlay
        var resolved = false

        // Set up prepare timeout
        let timeoutWork = DispatchWorkItem { [weak self] in
            guard !resolved else { return }
            resolved = true
            self?.statusObservation?.invalidate()
            self?.statusObservation = nil
            promise.reject("PREPARE_TIMEOUT", "Track did not become ready within \(self?.prepareTimeoutSeconds ?? 30)s")
        }
        self.prepareTimeoutWork = timeoutWork
        DispatchQueue.main.asyncAfter(deadline: .now() + prepareTimeoutSeconds, execute: timeoutWork)

        statusObservation = item.observe(\.status, options: [.new]) { [weak self] observedItem, _ in
            // KVO can fire on any thread — serialize access to `resolved` on main queue
            DispatchQueue.main.async {
                guard let self = self, !resolved else { return }

                switch observedItem.status {
                case .readyToPlay:
                    resolved = true
                    self.prepareTimeoutWork?.cancel()
                    self.prepareTimeoutWork = nil
                    self.statusObservation?.invalidate()
                    self.statusObservation = nil

                    // Seek to position within track
                    let seekTime = CMTime(seconds: positionInTrack, preferredTimescale: 600)
                    player.seek(to: seekTime, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
                        guard let self = self else { return }

                        // Set rate
                        player.rate = autoPlay ? self.currentRate : 0.0

                        // Start periodic time observer
                        self.startTimeObserver()

                        // Start stuck detection
                        self.startStuckDetection()

                        // Observe item end
                        self.observeItemEnd()

                        // Emit track change
                        self.sendEvent("AVPlayerTrackChange", [
                            "trackIndex": trackIndex,
                            "totalTracks": parsedTracks.count,
                            "title": track.title,
                            "startOffset": track.startOffset
                        ])

                        promise.resolve(nil)
                    }

                case .failed:
                    resolved = true
                    self.prepareTimeoutWork?.cancel()
                    self.prepareTimeoutWork = nil
                    self.statusObservation?.invalidate()
                    self.statusObservation = nil

                    let errorMsg = observedItem.error?.localizedDescription ?? "Unknown error"
                    let errorType = self.classifyError(observedItem.error)

                    self.sendEvent("AVPlayerError", [
                        "type": errorType,
                        "message": errorMsg,
                        "errorCode": (observedItem.error as NSError?)?.code ?? -1,
                        "position": self.currentGlobalPosition()
                    ])

                    promise.reject("LOAD_FAILED", errorMsg)

                case .unknown:
                    break // Still loading

                @unknown default:
                    break
                }
            }
        }

        // Replace current item (starts loading)
        player.replaceCurrentItem(with: item)
    }

    // MARK: - Playback Controls

    private func play() {
        guard let player = player else { return }
        do {
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // Best effort
        }
        player.rate = currentRate
        updateNowPlayingPlaybackInfo()
    }

    private func pause() {
        player?.pause()
        updateNowPlayingPlaybackInfo()
    }

    private func seekTo(globalPositionSec: Double) {
        // Dispatch to main queue — seekTo may be called from Expo's module thread,
        // but lastEmittedPosition is also written by the periodic time observer on main queue.
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let player = self.player else { return }

            let clampedPosition = max(0, min(globalPositionSec, self.totalDuration))

            // Find which track contains this position
            var targetTrackIndex = 0
            var positionInTrack = clampedPosition

            for (i, track) in self.tracks.enumerated() {
                if clampedPosition >= track.startOffset && clampedPosition < track.startOffset + track.duration {
                    targetTrackIndex = i
                    positionInTrack = clampedPosition - track.startOffset
                    break
                }
                // If past all tracks, use the last one
                if i == self.tracks.count - 1 {
                    targetTrackIndex = i
                    positionInTrack = min(clampedPosition - track.startOffset, track.duration)
                }
            }

            if targetTrackIndex != self.currentTrackIndex {
                // Need to switch tracks
                self.switchToTrack(index: targetTrackIndex, positionInTrack: positionInTrack, autoPlay: player.rate > 0)
            } else {
                // Same track, just seek
                let seekTime = CMTime(seconds: positionInTrack, preferredTimescale: 600)
                player.seek(to: seekTime, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
                    self?.updateNowPlayingPlaybackInfo()
                }
            }

            // Update position immediately for responsive UI
            self.lastEmittedPosition = clampedPosition
        }
    }

    private func setRate(rate: Float) {
        currentRate = rate
        if player?.timeControlStatus == .playing {
            player?.rate = rate
        }
        updateNowPlayingPlaybackInfo()
    }

    // MARK: - Track Switching

    private func switchToTrack(index: Int, positionInTrack: Double, autoPlay: Bool) {
        guard index >= 0 && index < tracks.count, let player = player else { return }

        // Clean up current item observers
        cleanupCurrentItem()

        currentTrackIndex = index
        let track = tracks[index]

        let item = AVPlayerItem(url: track.url)

        // Track whether the KVO observer has resolved (ready or failed)
        var resolved = false

        // Set up prepare timeout (same as loadTracks)
        let timeoutWork = DispatchWorkItem { [weak self] in
            guard !resolved else { return }
            resolved = true
            self?.statusObservation?.invalidate()
            self?.statusObservation = nil
            let errorMsg = "Track \(index) did not become ready within \(self?.prepareTimeoutSeconds ?? 30)s"
            self?.sendEvent("AVPlayerError", [
                "type": "PREPARE_TIMEOUT",
                "message": errorMsg,
                "errorCode": -1,
                "position": self?.currentGlobalPosition() ?? 0
            ])
        }
        self.prepareTimeoutWork = timeoutWork
        DispatchQueue.main.asyncAfter(deadline: .now() + prepareTimeoutSeconds, execute: timeoutWork)

        // Observe readiness
        statusObservation = item.observe(\.status, options: [.new]) { [weak self] observedItem, _ in
            // KVO can fire on any thread — serialize access to `resolved` on main queue
            DispatchQueue.main.async {
                guard let self = self, !resolved else { return }

                switch observedItem.status {
                case .readyToPlay:
                    resolved = true
                    self.prepareTimeoutWork?.cancel()
                    self.prepareTimeoutWork = nil
                    self.statusObservation?.invalidate()
                    self.statusObservation = nil

                    let seekTime = CMTime(seconds: positionInTrack, preferredTimescale: 600)
                    player.seek(to: seekTime, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
                        guard let self = self else { return }
                        if autoPlay {
                            player.rate = self.currentRate
                        }
                        self.startTimeObserver()
                        self.startStuckDetection()
                        self.observeItemEnd()
                    }

                case .failed:
                    resolved = true
                    self.prepareTimeoutWork?.cancel()
                    self.prepareTimeoutWork = nil
                    self.statusObservation?.invalidate()
                    self.statusObservation = nil
                    let errorMsg = observedItem.error?.localizedDescription ?? "Track switch failed"
                    self.sendEvent("AVPlayerError", [
                        "type": self.classifyError(observedItem.error),
                        "message": errorMsg,
                        "errorCode": (observedItem.error as NSError?)?.code ?? -1,
                        "position": self.currentGlobalPosition()
                    ])

                case .unknown:
                    break

                @unknown default:
                    break
                }
            }
        }

        player.replaceCurrentItem(with: item)

        // Emit track change event
        sendEvent("AVPlayerTrackChange", [
            "trackIndex": index,
            "totalTracks": tracks.count,
            "title": track.title,
            "startOffset": track.startOffset
        ])
    }

    // MARK: - Time Observer (100ms position updates)

    private func startTimeObserver() {
        stopTimeObserver()

        guard let player = player else { return }

        let interval = CMTime(seconds: 0.1, preferredTimescale: 600)
        timeObserverToken = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            self?.emitPlaybackState(currentTime: time)
        }
    }

    private func stopTimeObserver() {
        if let token = timeObserverToken, let player = player {
            player.removeTimeObserver(token)
        }
        timeObserverToken = nil
    }

    private func emitPlaybackState(currentTime: CMTime) {
        guard let player = player else { return }

        let positionInTrack = CMTimeGetSeconds(currentTime)
        guard positionInTrack.isFinite else { return }

        // Calculate global position
        let globalPosition: Double
        if currentTrackIndex < tracks.count {
            globalPosition = tracks[currentTrackIndex].startOffset + positionInTrack
        } else {
            globalPosition = positionInTrack
        }

        lastEmittedPosition = globalPosition

        let isPlaying = player.timeControlStatus == .playing
        let isBuffering = player.timeControlStatus == .waitingToPlayAtSpecifiedRate

        sendEvent("AVPlayerPlaybackState", [
            "isPlaying": isPlaying,
            "position": globalPosition,
            "duration": totalDuration,
            "isBuffering": isBuffering,
            "didJustFinish": false,
            "isStuck": false
        ])
    }

    // MARK: - Item End (track transition / book end)

    private func observeItemEnd() {
        // Remove previous observer
        if let observer = itemDidPlayToEndObserver {
            NotificationCenter.default.removeObserver(observer)
        }

        itemDidPlayToEndObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: player?.currentItem,
            queue: .main
        ) { [weak self] _ in
            self?.handleTrackEnd()
        }
    }

    private func handleTrackEnd() {
        let nextIndex = currentTrackIndex + 1

        if nextIndex < tracks.count {
            // Auto-advance to next track
            switchToTrack(index: nextIndex, positionInTrack: 0, autoPlay: true)
        } else {
            // Book finished
            player?.pause()

            sendEvent("AVPlayerPlaybackState", [
                "isPlaying": false,
                "position": totalDuration,
                "duration": totalDuration,
                "isBuffering": false,
                "didJustFinish": true,
                "isStuck": false
            ])

            sendEvent("AVPlayerBookEnd", [:] as [String: Any])
        }
    }

    // MARK: - Stuck Detection

    private func startStuckDetection() {
        stopStuckDetection()

        lastStuckCheckPosition = currentGlobalPosition()
        lastStuckCheckTime = Date.timeIntervalSinceReferenceDate

        let timer = Timer(timeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.checkIfStuck()
        }
        RunLoop.main.add(timer, forMode: .common)
        stuckCheckTimer = timer
    }

    private func stopStuckDetection() {
        stuckCheckTimer?.invalidate()
        stuckCheckTimer = nil
    }

    private func checkIfStuck() {
        guard let player = player,
              player.timeControlStatus == .playing else {
            // Reset if not playing
            lastStuckCheckPosition = currentGlobalPosition()
            lastStuckCheckTime = Date.timeIntervalSinceReferenceDate
            return
        }

        let currentPos = currentGlobalPosition()
        let now = Date.timeIntervalSinceReferenceDate

        if abs(currentPos - lastStuckCheckPosition) < 0.05 {
            // Position hasn't changed
            let stuckDuration = now - lastStuckCheckTime
            if stuckDuration >= stuckThresholdSeconds {
                sendEvent("AVPlayerPlaybackState", [
                    "isPlaying": true,
                    "position": currentPos,
                    "duration": totalDuration,
                    "isBuffering": false,
                    "didJustFinish": false,
                    "isStuck": true
                ])
            }
        } else {
            // Position changed, reset
            lastStuckCheckPosition = currentPos
            lastStuckCheckTime = now
        }
    }

    // MARK: - Audio Session Observers

    private func setupAudioSessionObservers() {
        // Interruption (phone calls, Siri, etc.)
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] notification in
            self?.handleInterruption(notification)
        }

        // Route change (headphone unplug)
        routeChangeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] notification in
            self?.handleRouteChange(notification)
        }
    }

    private func handleInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
            return
        }

        switch type {
        case .began:
            isPlayingBeforeInterruption = player?.timeControlStatus == .playing
            player?.pause()
            updateNowPlayingPlaybackInfo()

        case .ended:
            guard let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt else { return }
            let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
            if options.contains(.shouldResume) && isPlayingBeforeInterruption {
                do {
                    try AVAudioSession.sharedInstance().setActive(true)
                } catch {
                    // Best effort
                }
                player?.rate = currentRate
                updateNowPlayingPlaybackInfo()
            }

        @unknown default:
            break
        }
    }

    private func handleRouteChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
            return
        }

        if reason == .oldDeviceUnavailable {
            // Headphones unplugged — pause
            player?.pause()
            updateNowPlayingPlaybackInfo()
        }
    }

    // MARK: - TimeControlStatus Change

    private func handleTimeControlStatusChange(_ status: AVPlayer.TimeControlStatus) {
        // This fires when play/pause/buffering state changes
        // The periodic time observer handles position updates, but we
        // emit an immediate state update here for responsiveness
        guard let player = player else { return }

        let currentPos = currentGlobalPosition()

        sendEvent("AVPlayerPlaybackState", [
            "isPlaying": status == .playing,
            "position": currentPos,
            "duration": totalDuration,
            "isBuffering": status == .waitingToPlayAtSpecifiedRate,
            "didJustFinish": false,
            "isStuck": false
        ])
    }

    // MARK: - Remote Command Center

    private func setupRemoteCommandCenter() {
        let center = MPRemoteCommandCenter.shared()

        // Play — emit event to JS, let JS handle play (same pattern as skip/seek)
        playCommandTarget = center.playCommand.addTarget { [weak self] _ in
            self?.sendEvent("AVPlayerRemoteCommand", ["command": "play"])
            return .success
        }
        center.playCommand.isEnabled = true

        // Pause — emit event to JS, let JS handle pause (same pattern as skip/seek)
        pauseCommandTarget = center.pauseCommand.addTarget { [weak self] _ in
            self?.sendEvent("AVPlayerRemoteCommand", ["command": "pause"])
            return .success
        }
        center.pauseCommand.isEnabled = true

        // Skip Forward (30s)
        center.skipForwardCommand.preferredIntervals = [30]
        skipForwardCommandTarget = center.skipForwardCommand.addTarget { [weak self] _ in
            self?.sendEvent("AVPlayerRemoteCommand", ["command": "skipForward"])
            return .success
        }
        center.skipForwardCommand.isEnabled = true

        // Skip Backward (30s)
        center.skipBackwardCommand.preferredIntervals = [30]
        skipBackwardCommandTarget = center.skipBackwardCommand.addTarget { [weak self] _ in
            self?.sendEvent("AVPlayerRemoteCommand", ["command": "skipBackward"])
            return .success
        }
        center.skipBackwardCommand.isEnabled = true

        // Next Track (chapter)
        nextTrackCommandTarget = center.nextTrackCommand.addTarget { [weak self] _ in
            self?.sendEvent("AVPlayerRemoteCommand", ["command": "nextChapter"])
            return .success
        }
        center.nextTrackCommand.isEnabled = true

        // Previous Track (chapter)
        previousTrackCommandTarget = center.previousTrackCommand.addTarget { [weak self] _ in
            self?.sendEvent("AVPlayerRemoteCommand", ["command": "prevChapter"])
            return .success
        }
        center.previousTrackCommand.isEnabled = true

        // Scrubber / Change Playback Position
        changePositionCommandTarget = center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let positionEvent = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            let position = positionEvent.positionTime
            self?.sendEvent("AVPlayerRemoteCommand", [
                "command": "seek",
                "param": String(position)
            ])
            return .success
        }
        center.changePlaybackPositionCommand.isEnabled = true

        // Playback rate command (allows Control Center speed changes)
        playbackRateCommandTarget = center.changePlaybackRateCommand.addTarget { [weak self] event in
            guard let rateEvent = event as? MPChangePlaybackRateCommandEvent else {
                return .commandFailed
            }
            self?.setRate(rate: rateEvent.playbackRate)
            return .success
        }
        center.changePlaybackRateCommand.supportedPlaybackRates = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]
        center.changePlaybackRateCommand.isEnabled = true
    }

    private func removeRemoteCommandTargets() {
        let center = MPRemoteCommandCenter.shared()

        if let t = playCommandTarget { center.playCommand.removeTarget(t) }
        if let t = pauseCommandTarget { center.pauseCommand.removeTarget(t) }
        if let t = skipForwardCommandTarget { center.skipForwardCommand.removeTarget(t) }
        if let t = skipBackwardCommandTarget { center.skipBackwardCommand.removeTarget(t) }
        if let t = nextTrackCommandTarget { center.nextTrackCommand.removeTarget(t) }
        if let t = previousTrackCommandTarget { center.previousTrackCommand.removeTarget(t) }
        if let t = changePositionCommandTarget { center.changePlaybackPositionCommand.removeTarget(t) }
        if let t = playbackRateCommandTarget { center.changePlaybackRateCommand.removeTarget(t) }

        playCommandTarget = nil
        pauseCommandTarget = nil
        skipForwardCommandTarget = nil
        skipBackwardCommandTarget = nil
        nextTrackCommandTarget = nil
        previousTrackCommandTarget = nil
        changePositionCommandTarget = nil
        playbackRateCommandTarget = nil
    }

    // MARK: - Now Playing Info

    private func updateNowPlayingInfo(title: String, artist: String, artworkUrl: String?, chapterTitle: String?) {
        var info = [String: Any]()

        let displayTitle = chapterTitle ?? title
        info[MPMediaItemPropertyTitle] = displayTitle
        info[MPMediaItemPropertyArtist] = artist
        info[MPMediaItemPropertyPlaybackDuration] = totalDuration
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentGlobalPosition()
        info[MPNowPlayingInfoPropertyPlaybackRate] = player?.rate ?? 0.0
        info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = 1.0

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info

        // Load artwork asynchronously
        if let urlString = artworkUrl, let url = URL(string: urlString) {
            loadArtwork(from: url)
        }
    }

    private func updateNowPlayingPlaybackInfo() {
        guard var info = MPNowPlayingInfoCenter.default().nowPlayingInfo else { return }
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentGlobalPosition()
        info[MPNowPlayingInfoPropertyPlaybackRate] = player?.rate ?? 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func loadArtwork(from url: URL) {
        // Skip if artwork URL hasn't changed
        if url == currentArtworkUrl {
            return
        }
        currentArtworkUrl = url

        artworkTask?.cancel()

        artworkTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, error in
            guard let data = data, error == nil,
                  let image = UIImage(data: data) else { return }

            DispatchQueue.main.async {
                guard var info = MPNowPlayingInfoCenter.default().nowPlayingInfo else { return }
                let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                info[MPMediaItemPropertyArtwork] = artwork
                MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            }
        }
        artworkTask?.resume()
    }

    // MARK: - Helpers

    private func currentGlobalPosition() -> Double {
        guard let player = player,
              let currentItem = player.currentItem else {
            return lastEmittedPosition
        }

        let positionInTrack = CMTimeGetSeconds(currentItem.currentTime())
        guard positionInTrack.isFinite else { return lastEmittedPosition }

        if currentTrackIndex < tracks.count {
            return tracks[currentTrackIndex].startOffset + positionInTrack
        }
        return positionInTrack
    }

    private func classifyError(_ error: Error?) -> String {
        guard let nsError = error as NSError? else { return "LOAD_FAILED" }

        // Check for HTTP status in underlying error
        if let underlyingError = nsError.userInfo[NSUnderlyingErrorKey] as? NSError {
            let code = underlyingError.code
            if code == 403 || code == 401 {
                return "URL_EXPIRED"
            }
        }

        // Check error domain for URL errors
        if nsError.domain == NSURLErrorDomain {
            switch nsError.code {
            case NSURLErrorTimedOut, NSURLErrorCannotConnectToHost,
                 NSURLErrorNetworkConnectionLost, NSURLErrorNotConnectedToInternet:
                return "NETWORK_ERROR"
            default:
                break
            }
        }

        // Check for HTTP status codes in AVFoundation errors
        let description = nsError.localizedDescription.lowercased()
        if description.contains("403") || description.contains("forbidden") ||
           description.contains("401") || description.contains("unauthorized") {
            return "URL_EXPIRED"
        }

        return "LOAD_FAILED"
    }

    // MARK: - Cleanup

    private func cleanupCurrentItem() {
        stopTimeObserver()
        stopStuckDetection()

        prepareTimeoutWork?.cancel()
        prepareTimeoutWork = nil

        statusObservation?.invalidate()
        statusObservation = nil

        if let observer = itemDidPlayToEndObserver {
            NotificationCenter.default.removeObserver(observer)
            itemDidPlayToEndObserver = nil
        }

        artworkTask?.cancel()
        artworkTask = nil
        currentArtworkUrl = nil
    }

    private func cleanupPlayback() {
        cleanupCurrentItem()

        player?.pause()
        player?.replaceCurrentItem(with: nil)

        tracks = []
        currentTrackIndex = 0
        totalDuration = 0
        lastEmittedPosition = 0

        // Clear now playing
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    private func destroy() {
        cleanupPlayback()

        // Remove audio session observers
        if let observer = interruptionObserver {
            NotificationCenter.default.removeObserver(observer)
            interruptionObserver = nil
        }
        if let observer = routeChangeObserver {
            NotificationCenter.default.removeObserver(observer)
            routeChangeObserver = nil
        }

        // Remove remote command targets
        removeRemoteCommandTargets()

        // Remove time control observation
        timeControlObservation?.invalidate()
        timeControlObservation = nil

        player = nil
        isInitialized = false
    }
}
