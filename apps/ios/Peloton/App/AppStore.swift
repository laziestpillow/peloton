import AuthenticationServices
import Foundation
import Observation
import PelotonAPIClient
import PelotonCore
import PelotonFixtures

extension LiveAPIClient: PelotonDataClient {}

@MainActor
@Observable
final class AppStore {
  let configuration: AppConfiguration
  private let client: any PelotonDataClient
  private let authContextProvider = AuthenticationContextProvider()
  @ObservationIgnored private var authSession: ASWebAuthenticationSession?

  var rider: RiderProfile?
  var stravaStatus: StravaIntegrationStatus?
  var activities: [ImportedActivity] = []
  var stages: [Stage] = []
  var recap: StageRecap?
  var results: StageResultsResponse?
  var standings: SeasonStandingsResponse?
  var archetypes: SeasonArchetypesResponse?
  var selectedStageId = "stage-001"
  var selectedSeasonId = "season-001"
  var isLoading = false
  var isSyncing = false
  var isSavingGarage = false
  var errorMessage: String?

  init(configuration: AppConfiguration, client: any PelotonDataClient) {
    self.configuration = configuration
    self.client = client
  }

  static func makeDefault() -> AppStore {
    let configuration = AppConfiguration.fromEnvironment()
    if configuration.usesFixtures {
      return AppStore(configuration: configuration, client: FixtureDataClient())
    }

    let token = ProcessInfo.processInfo.environment["PELOTON_BEARER_TOKEN"]
    return AppStore(
      configuration: configuration,
      client: LiveAPIClient(baseURL: configuration.baseAPIURL, bearerToken: { token })
    )
  }

  func loadInitialData() async {
    guard !isLoading else { return }
    isLoading = true
    defer { isLoading = false }

    do {
      async let rider = client.currentRider()
      async let status = client.stravaStatus()
      async let activities = client.activities()
      async let stages = client.stages(groupId: "group-001")

      let activityResponse = try await activities
      let stageResponse = try await stages

      self.rider = try await rider
      self.stravaStatus = try await status
      self.activities = activityResponse.data
      self.stages = stageResponse.data

      if let stage = self.stages.first {
        selectedStageId = stage.id
        selectedSeasonId = stage.seasonId
      }
      try await loadStageAndSeasonData()
      errorMessage = nil
    } catch {
      errorMessage = displayMessage(for: error)
    }
  }

  func refreshStravaStatus() async {
    do {
      stravaStatus = try await client.stravaStatus()
      errorMessage = nil
    } catch {
      errorMessage = displayMessage(for: error)
    }
  }

  func connectStrava() async {
    do {
      let authorization = try await client.startStravaAuthorization()
      let session = ASWebAuthenticationSession(
        url: authorization.authorizationUrl,
        callbackURLScheme: configuration.oauthCallbackScheme
      ) { [weak self] _, error in
        Task { @MainActor in
          guard let self else { return }
          if let error {
            self.errorMessage = error.localizedDescription
          }
          await self.refreshStravaStatus()
        }
      }
      session.presentationContextProvider = authContextProvider
      session.prefersEphemeralWebBrowserSession = true
      authSession = session
      if !session.start() {
        errorMessage = "Could not start Strava authorization."
      }
    } catch {
      errorMessage = displayMessage(for: error)
    }
  }

  func disconnectStrava() async {
    do {
      try await client.disconnectStrava()
      await refreshStravaStatus()
    } catch {
      errorMessage = displayMessage(for: error)
    }
  }

  func syncActivities() async {
    guard !isSyncing else { return }
    isSyncing = true
    defer { isSyncing = false }

    do {
      _ = try await client.syncActivities(idempotencyKey: UUID().uuidString)
      let activityResponse = try await client.activities()
      activities = activityResponse.data
      await refreshStravaStatus()
    } catch {
      errorMessage = displayMessage(for: error)
    }
  }

  func saveAppearance(_ appearance: RiderAppearance) async {
    isSavingGarage = true
    defer { isSavingGarage = false }

    do {
      rider = try await client.updateCurrentRiderAppearance(appearance, idempotencyKey: UUID().uuidString)
      errorMessage = nil
    } catch {
      errorMessage = displayMessage(for: error)
    }
  }

  func selectStage(_ stage: Stage) async {
    selectedStageId = stage.id
    selectedSeasonId = stage.seasonId
    do {
      try await loadStageAndSeasonData()
      errorMessage = nil
    } catch {
      errorMessage = displayMessage(for: error)
    }
  }

  private func loadStageAndSeasonData() async throws {
    async let recap = client.recap(stageId: selectedStageId)
    async let results = client.results(stageId: selectedStageId)
    async let standings = client.standings(seasonId: selectedSeasonId)
    async let archetypes = client.archetypes(seasonId: selectedSeasonId)

    self.recap = try await recap
    self.results = try await results
    self.standings = try await standings
    self.archetypes = try await archetypes
  }

  private func displayMessage(for error: Error) -> String {
    if let apiError = error as? LiveAPIError {
      switch apiError {
      case .unsuccessfulResponse(_, let response):
        return response?.error.message ?? "The API returned an error."
      }
    }
    return error.localizedDescription
  }
}

final class AuthenticationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    ASPresentationAnchor()
  }
}
