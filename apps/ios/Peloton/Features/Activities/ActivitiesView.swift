import Foundation
import SwiftUI

struct ActivitiesView: View {
    @State private var activities: [RideActivity] = []
    @State private var loadingState = ActivityLoadingState.loading
    @State private var isSyncing = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    RaceCenterHeader(processedCount: processedCount, eligibleCount: eligibleCount, totalCount: activities.count)
                        .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
                        .listRowBackground(Color.clear)
                }

                Section("Import Control") {
                    Button {
                        Task {
                            await syncActivities()
                        }
                    } label: {
                        Label(isSyncing ? "Syncing Activities" : "Sync Activities", systemImage: isSyncing ? "arrow.triangle.2.circlepath" : "arrow.clockwise")
                            .font(.headline)
                    }
                    .disabled(isSyncing)
                    .accessibilityLabel(isSyncing ? "Syncing activities" : "Sync activities")
                }

                Section("Recent Rides") {
                    switch loadingState {
                    case .loading:
                        LoadingActivitiesRow()
                    case .loaded:
                        if activities.isEmpty {
                            EmptyActivitiesRow()
                        } else {
                            ForEach(activities) { activity in
                                ActivityRow(activity: activity)
                            }
                        }
                    case .failed(let message):
                        ErrorActivitiesRow(message: message) {
                            loadActivities()
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Rides")
            .refreshable {
                await syncActivities()
            }
            .task {
                loadActivities()
            }
        }
    }

    private func syncActivities() async {
        guard !isSyncing else { return }

        isSyncing = true
        try? await Task.sleep(for: .milliseconds(700))
        loadActivities()
        isSyncing = false
    }

    private func loadActivities() {
        loadingState = .loading

        do {
            let data: Data

            if let url = Bundle.main.url(forResource: "activities", withExtension: "json") {
                data = try Data(contentsOf: url)
            } else {
                data = Data(Self.fallbackActivitiesJSON.utf8)
            }

            let response = try JSONDecoder().decode(ActivitiesResponse.self, from: data)
            activities = response.data
            loadingState = .loaded
        } catch {
            activities = []
            loadingState = .failed("Unable to load fixture activities.")
        }
    }

    private static let fallbackActivitiesJSON = """
    {
      "data": [
        {
          "id": "activity-001",
          "riderId": "rider-001",
          "provider": "fixture",
          "providerActivityId": "fixture-ride-001",
          "activityType": "ride",
          "startedAt": "2026-07-18T07:30:00Z",
          "distanceMeters": 42195,
          "elapsedTimeSeconds": 6120,
          "movingTimeSeconds": 5890,
          "elevationGainMeters": 680,
          "importStatus": "processed",
          "processedStageId": "stage-001"
        },
        {
          "id": "activity-002",
          "riderId": "rider-001",
          "provider": "fixture",
          "providerActivityId": "fixture-ride-002",
          "activityType": "ride",
          "startedAt": "2026-07-22T06:45:00Z",
          "distanceMeters": 30500,
          "elapsedTimeSeconds": 4380,
          "movingTimeSeconds": 4210,
          "elevationGainMeters": 315,
          "importStatus": "eligible",
          "processedStageId": null
        }
      ]
    }
    """

    private var processedCount: Int {
        activities.filter { $0.processedStageId != nil }.count
    }

    private var eligibleCount: Int {
        activities.filter { $0.processedStageId == nil }.count
    }
}

private struct RaceCenterHeader: View {
    let processedCount: Int
    let eligibleCount: Int
    let totalCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Fixture Race Center")
                        .font(.title2.weight(.bold))
                    Text("Imported rides ready for stage building")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Label("Live", systemImage: "bolt.fill")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.yellow.opacity(0.18), in: Capsule())
                    .foregroundStyle(.orange)
            }

            RouteMapPreview()
                .frame(height: 130)
                .accessibilityLabel("Route map preview")

            HStack(spacing: 12) {
                SummaryMetric(value: "\(processedCount)", label: "Processed", color: .green)
                SummaryMetric(value: "\(eligibleCount)", label: "Eligible", color: .blue)
                SummaryMetric(value: "\(totalCount)", label: "Activities", color: .purple)
            }
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct RouteMapPreview: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.green.opacity(0.18), Color.blue.opacity(0.12)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            GridLines()
                .stroke(.white.opacity(0.45), lineWidth: 1)

            RouteLine()
                .stroke(.green, style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
                .shadow(color: .green.opacity(0.4), radius: 4)

            HStack {
                MapPin(label: "Start", color: .green)
                Spacer()
                MapPin(label: "Finish", color: .red)
            }
            .padding(.horizontal, 18)
            .padding(.top, 46)
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(alignment: .topLeading) {
            Label("Barcelona route window", systemImage: "map")
                .font(.caption.weight(.semibold))
                .padding(8)
                .background(.thinMaterial, in: Capsule())
                .padding(10)
        }
    }
}

private struct GridLines: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let columns = 4
        let rows = 3

        for column in 1..<columns {
            let x = rect.width * CGFloat(column) / CGFloat(columns)
            path.move(to: CGPoint(x: x, y: rect.minY))
            path.addLine(to: CGPoint(x: x, y: rect.maxY))
        }

        for row in 1..<rows {
            let y = rect.height * CGFloat(row) / CGFloat(rows)
            path.move(to: CGPoint(x: rect.minX, y: y))
            path.addLine(to: CGPoint(x: rect.maxX, y: y))
        }

        return path
    }
}

private struct RouteLine: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.width * 0.12, y: rect.height * 0.70))
        path.addCurve(
            to: CGPoint(x: rect.width * 0.36, y: rect.height * 0.38),
            control1: CGPoint(x: rect.width * 0.18, y: rect.height * 0.44),
            control2: CGPoint(x: rect.width * 0.30, y: rect.height * 0.66)
        )
        path.addCurve(
            to: CGPoint(x: rect.width * 0.62, y: rect.height * 0.58),
            control1: CGPoint(x: rect.width * 0.44, y: rect.height * 0.18),
            control2: CGPoint(x: rect.width * 0.56, y: rect.height * 0.28)
        )
        path.addCurve(
            to: CGPoint(x: rect.width * 0.88, y: rect.height * 0.30),
            control1: CGPoint(x: rect.width * 0.70, y: rect.height * 0.86),
            control2: CGPoint(x: rect.width * 0.80, y: rect.height * 0.44)
        )
        return path
    }
}

private struct MapPin: View {
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 12, height: 12)
                .overlay(Circle().stroke(.white, lineWidth: 2))
            Text(label)
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(.thinMaterial, in: Capsule())
        }
    }
}

private struct SummaryMetric: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value)
                .font(.headline.monospacedDigit())
                .foregroundStyle(color)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(color.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct ActivityRow: View {
    let activity: RideActivity

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(activity.title)
                        .font(.headline)
                    Text(activity.dateText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text(activity.statusText)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(activity.statusColor.opacity(0.15), in: Capsule())
                    .foregroundStyle(activity.statusColor)
            }

            HStack(spacing: 10) {
                RideMetric(icon: "location", value: activity.distanceText, label: "Distance")
                RideMetric(icon: "clock", value: activity.durationText, label: "Time")
                RideMetric(icon: "arrow.up", value: activity.elevationText, label: "Gain")
            }

            if let processedStageId = activity.processedStageId {
                Label("Processed as \(processedStageId)", systemImage: "flag.checkered")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            } else {
                Label("Ready to build into a stage", systemImage: "plus.circle")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
    }
}

private struct RideMetric: View {
    let icon: String
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(value, systemImage: icon)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct LoadingActivitiesRow: View {
    var body: some View {
        HStack(spacing: 12) {
            ProgressView()
            Text("Loading fixture rides")
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
    }
}

private struct EmptyActivitiesRow: View {
    var body: some View {
        ContentUnavailableView(
            "No rides yet",
            systemImage: "bicycle",
            description: Text("Synced rides will appear here when fixture data is available.")
        )
    }
}

private struct ErrorActivitiesRow: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(message, systemImage: "exclamationmark.triangle")
                .foregroundStyle(.red)
            Button("Retry", action: retry)
                .buttonStyle(.bordered)
        }
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
    }
}

struct RideActivity: Identifiable, Decodable {
    let id: String
    let riderId: String
    let provider: String
    let providerActivityId: String
    let activityType: String
    let title: String
    let startedAt: String
    let distanceMeters: Double
    let elapsedTimeSeconds: Int
    let movingTimeSeconds: Int
    let elevationGainMeters: Int
    let importStatus: String
    let processedStageId: String?

    enum CodingKeys: String, CodingKey {
        case id
        case riderId
        case provider
        case providerActivityId
        case activityType
        case startedAt
        case distanceMeters
        case elapsedTimeSeconds
        case movingTimeSeconds
        case elevationGainMeters
        case importStatus
        case processedStageId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        riderId = try container.decode(String.self, forKey: .riderId)
        provider = try container.decode(String.self, forKey: .provider)
        providerActivityId = try container.decode(String.self, forKey: .providerActivityId)
        activityType = try container.decode(String.self, forKey: .activityType)
        title = Self.title(for: id)
        startedAt = try container.decode(String.self, forKey: .startedAt)
        distanceMeters = try container.decode(Double.self, forKey: .distanceMeters)
        elapsedTimeSeconds = try container.decode(Int.self, forKey: .elapsedTimeSeconds)
        movingTimeSeconds = try container.decode(Int.self, forKey: .movingTimeSeconds)
        elevationGainMeters = try container.decode(Int.self, forKey: .elevationGainMeters)
        importStatus = try container.decode(String.self, forKey: .importStatus)
        processedStageId = try container.decodeIfPresent(String.self, forKey: .processedStageId)
    }

    var dateText: String {
        let inputFormatter = ISO8601DateFormatter()

        guard let date = inputFormatter.date(from: startedAt) else {
            return startedAt
        }

        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .none
        return displayFormatter.string(from: date)
    }

    var distanceText: String {
        String(format: "%.1f km", distanceMeters / 1000)
    }

    var durationText: String {
        let hours = movingTimeSeconds / 3600
        let minutes = (movingTimeSeconds % 3600) / 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }

        return "\(minutes)m"
    }

    var elevationText: String {
        "\(elevationGainMeters) m"
    }

    var statusText: String {
        importStatus.capitalized
    }

    var statusColor: Color {
        switch importStatus {
        case "processed":
            return .green
        case "eligible":
            return .blue
        default:
            return .secondary
        }
    }

    private static func title(for id: String) -> String {
        switch id {
        case "activity-001":
            return "Barcelona Hills"
        case "activity-002":
            return "Coastal Tempo"
        default:
            return "Imported Ride"
        }
    }
}

private struct ActivitiesResponse: Decodable {
    let data: [RideActivity]
}

private enum ActivityLoadingState {
    case loading
    case loaded
    case failed(String)
}

private enum ActivityLoadError: Error {
    case missingFixture
}

#Preview {
    ActivitiesView()
}
