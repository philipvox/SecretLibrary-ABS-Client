Pod::Spec.new do |s|
  s.name           = 'AVPlayerModule'
  s.version        = '1.0.0'
  s.summary        = 'Native AVPlayer audio playback for React Native'
  s.description    = 'Provides AVPlayer-based audio playback with AVAudioSession, MPRemoteCommandCenter, and MPNowPlayingInfoCenter'
  s.author         = 'Secret Library'
  s.homepage       = 'https://github.com/audiobookshelf/audiobookshelf-app'
  s.platforms      = { :ios => '16.0' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.frameworks = 'AVFoundation', 'MediaPlayer'
  s.source_files = '*.swift'
  s.swift_version = '5.4'
end
