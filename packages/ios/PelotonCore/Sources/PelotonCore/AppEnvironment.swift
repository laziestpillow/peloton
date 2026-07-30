import Foundation
import Observation

public enum PelotonEnvironment: String, CaseIterable, Sendable {
  case fixture
  case local
  case development
  case staging
  case production
}

public struct AppConfiguration: Sendable {
  public let environment: PelotonEnvironment
  public let baseAPIURL: URL
  public let usesFixtures: Bool
  public let oauthCallbackScheme: String

  public init(environment: PelotonEnvironment, baseAPIURL: URL, usesFixtures: Bool, oauthCallbackScheme: String) {
    self.environment = environment
    self.baseAPIURL = baseAPIURL
    self.usesFixtures = usesFixtures
    self.oauthCallbackScheme = oauthCallbackScheme
  }

  public static let fixture = AppConfiguration(
    environment: .fixture,
    baseAPIURL: URL(string: "http://127.0.0.1:8080")!,
    usesFixtures: true,
    oauthCallbackScheme: "peloton"
  )
}

@Observable
public final class GarageState {
  public var displayName: String
  public var appearance: RiderAppearance
  public private(set) var hasUnsavedChanges = false

  public init(profile: RiderProfile) {
    self.displayName = profile.displayName
    self.appearance = profile.appearance
  }

  public func updateAppearance(_ appearance: RiderAppearance) {
    self.appearance = appearance
    hasUnsavedChanges = true
  }
}

@Observable
public final class RecapPlaybackState {
  public private(set) var isPlaying = false
  public var currentTimeSeconds: Double = 0
  public var playbackSpeed: Double = 1

  public init() {}

  public func play() {
    isPlaying = true
  }

  public func pause() {
    isPlaying = false
  }

  public func scrub(to seconds: Double, duration: Double) {
    currentTimeSeconds = min(max(seconds, 0), duration)
  }
}

