import Foundation

public enum KitPattern: String, Codable, CaseIterable, Sendable {
  case solid
  case stripes
  case polkaDots
}

public struct RiderAppearance: Codable, Equatable, Sendable {
  public var jerseyColor: String
  public var accentColor: String
  public var helmetColor: String
  public var bikeColor: String
  public var pattern: KitPattern

  public init(jerseyColor: String, accentColor: String, helmetColor: String, bikeColor: String, pattern: KitPattern) {
    self.jerseyColor = jerseyColor
    self.accentColor = accentColor
    self.helmetColor = helmetColor
    self.bikeColor = bikeColor
    self.pattern = pattern
  }
}

public struct RiderProfile: Codable, Identifiable, Equatable, Sendable {
  public let id: String
  public let userId: String
  public var displayName: String
  public var appearance: RiderAppearance
  public let createdAt: Date
  public let updatedAt: Date

  public init(id: String, userId: String, displayName: String, appearance: RiderAppearance, createdAt: Date, updatedAt: Date) {
    self.id = id
    self.userId = userId
    self.displayName = displayName
    self.appearance = appearance
    self.createdAt = createdAt
    self.updatedAt = updatedAt
  }
}

public struct ActivityListResponse: Codable, Equatable, Sendable {
  public let data: [ImportedActivity]
  public let pagination: Pagination
}

public struct ActivitySyncResponse: Codable, Equatable, Sendable {
  public let status: String
  public let requestedAt: Date
}

public struct Pagination: Codable, Equatable, Sendable {
  public let nextCursor: String?
}

public struct ImportedActivity: Codable, Identifiable, Equatable, Sendable {
  public let id: String
  public let riderId: String
  public let provider: String
  public let providerActivityId: String
  public let activityType: String
  public let startedAt: Date
  public let distanceMeters: Double
  public let elapsedTimeSeconds: Int
  public let movingTimeSeconds: Int
  public let elevationGainMeters: Double
  public let routeSummary: RouteSummary
  public let importStatus: String
  public let processedStageId: String?
}

public struct RouteSummary: Codable, Equatable, Sendable {
  public let polyline: String
  public let previewBounds: PreviewBounds
}

public struct PreviewBounds: Codable, Equatable, Sendable {
  public let southWest: GeoPoint
  public let northEast: GeoPoint
}

public struct GeoPoint: Codable, Equatable, Sendable {
  public let latitude: Double
  public let longitude: Double
}

public struct StravaAuthorizationStart: Codable, Equatable, Sendable {
  public let authorizationUrl: URL
  public let stateExpiresAt: Date
}

public struct StravaIntegrationStatus: Codable, Equatable, Sendable {
  public let status: String
  public let acceptedScopes: [String]
  public let lastSyncedAt: Date?
}

public struct Group: Codable, Identifiable, Equatable, Sendable {
  public let id: String
  public let name: String
  public let ownerId: String
  public let createdAt: Date
  public let updatedAt: Date
}

public struct GroupMembership: Codable, Equatable, Sendable {
  public let groupId: String
  public let riderId: String
  public let role: String
  public let status: String
  public let joinedAt: Date
}

public struct StageListResponse: Codable, Equatable, Sendable {
  public let data: [Stage]
}

public struct Stage: Codable, Identifiable, Equatable, Sendable {
  public let id: String
  public let seasonId: String
  public let name: String
  public let route: RouteProfile
  public let orderedMarkers: [Marker]
  public let scheduledAt: Date
  public let status: String
}

public struct RouteProfile: Codable, Equatable, Sendable {
  public let distanceMeters: Double
  public let elevation: [RouteElevationPoint]
}

public struct RouteElevationPoint: Codable, Equatable, Sendable {
  public let positionMeters: Double
  public let altitudeMeters: Double
}

public struct StageRecap: Codable, Equatable, Sendable {
  public let stageId: String
  public let durationSeconds: Int
  public let riders: [RiderProfile]
  public let markers: [Marker]
  public let timeline: [TimelineFrame]
}

public struct Marker: Codable, Identifiable, Equatable, Sendable {
  public let id: String
  public let type: String
  public let positionMeters: Double
  public let latitude: Double
  public let longitude: Double
  public let geofenceRadiusMeters: Double
  public let category: Int?
  public let pointsSchedule: [Int]
}

public struct TimelineFrame: Codable, Equatable, Sendable {
  public let timeSeconds: Int
  public let positions: [RiderTimelinePosition]
}

public struct RiderTimelinePosition: Codable, Equatable, Sendable {
  public let riderId: String
  public let positionMeters: Double
  public let speedMetersPerSecond: Double
  public let markerEventId: String?
}

public struct StageResultsResponse: Codable, Equatable, Sendable {
  public let stageId: String
  public let markerResults: [MarkerResult]
  public let classifications: [StageClassification]
  public let jerseyLeaders: JerseyLeaders
}

public struct MarkerResult: Codable, Equatable, Sendable {
  public let markerId: String
  public let type: String
  public let crossings: [MarkerCrossing]
}

public struct MarkerCrossing: Codable, Equatable, Sendable {
  public let riderId: String
  public let crossedAtSeconds: Int
  public let rank: Int
  public let points: Int
}

public struct StageClassification: Codable, Equatable, Sendable {
  public let stageId: String
  public let riderId: String
  public let sprintPoints: Int
  public let komPoints: Int
  public let finishBonus: Int
  public let todayTotal: Int
  public let gcTimeSeconds: Int
}

public struct JerseyLeaders: Codable, Equatable, Sendable {
  public let green: String
  public let polkaDot: String
  public let yellow: String
}

public struct SeasonStandingsResponse: Codable, Equatable, Sendable {
  public let seasonId: String
  public let standings: [SeasonStanding]
}

public struct SeasonStanding: Codable, Equatable, Sendable {
  public let seasonId: String
  public let riderId: String
  public let seasonTotal: Int
  public let rank: Int
  public let previousRank: Int?
}

public struct SeasonArchetypesResponse: Codable, Equatable, Sendable {
  public let data: [ArchetypeSnapshot]
}

public struct ArchetypeSnapshot: Codable, Equatable, Sendable {
  public let seasonId: String
  public let riderId: String
  public let archetype: String
  public let confidence: Double
  public let sampleSize: Int
  public let sprintRelativeScore: Double
  public let climbRelativeScore: Double
  public let shortEffortScore: Double
  public let sustainedEffortScore: Double
  public let effectiveAt: Date
  public let reasons: [String]
}

public struct ErrorResponse: Codable, Equatable, Sendable {
  public let error: APIErrorDetail
}

public struct APIErrorDetail: Codable, Equatable, Sendable {
  public let code: String
  public let message: String
  public let requestId: String?
}
