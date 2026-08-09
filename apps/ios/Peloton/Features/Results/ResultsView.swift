import Foundation
import SwiftUI

struct ResultsView: View {
    @State private var stageResults: StageResultsFixture?
    @State private var seasonStandings: SeasonStandingsFixture?
    @State private var riderNamesById: [String: String] = [:]
    @State private var loadingState = ResultsLoadingState.loading

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ResultsRaceHeader(
                        riderCount: stageResults?.classifications.count ?? 0,
                        markerCount: stageResults?.markerResults.count ?? 0,
                        jerseyCount: stageResults == nil ? 0 : 3
                    )
                    .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 8, trailing: 16))
                    .listRowBackground(Color.clear)
                }

                switch loadingState {
                case .loading:
                    Section("Results") {
                        LoadingResultsRow()
                    }
                case .loaded:
                    if isEmpty {
                        Section("Results") {
                            EmptyResultsRow()
                        }
                    } else {
                        Section("Jersey Leaders") {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    ForEach(jerseyLeaders) { leader in
                                        JerseyLeaderCard(leader: leader)
                                            .frame(width: 155)
                                    }
                                }
                                .padding(.vertical, 4)
                            }
                            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 0))
                        }

                        ResultSection(title: "Stage Classification", entries: stageEntries)
                        ResultSection(title: "Marker Winners", entries: markerEntries)
                        ResultSection(title: "Season", entries: seasonEntries)
                    }
                case .failed(let message):
                    Section("Results") {
                        ErrorResultsRow(message: message) {
                            loadResults()
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Results")
            .task {
                loadResults()
            }
        }
    }

    private var isEmpty: Bool {
        stageEntries.isEmpty && markerEntries.isEmpty && seasonEntries.isEmpty
    }

    private var jerseyLeaders: [JerseyLeaderResult] {
        guard let stageResults else { return [] }

        return [
            JerseyLeaderResult(
                jersey: .green,
                rider: riderName(for: stageResults.jerseyLeaders.green),
                detail: stagePointsText(for: stageResults.jerseyLeaders.green),
                subtitle: "Points leader"
            ),
            JerseyLeaderResult(
                jersey: .polkaDot,
                rider: riderName(for: stageResults.jerseyLeaders.polkaDot),
                detail: komPointsText(for: stageResults.jerseyLeaders.polkaDot),
                subtitle: "Climber leader"
            ),
            JerseyLeaderResult(
                jersey: .yellow,
                rider: riderName(for: stageResults.jerseyLeaders.yellow),
                detail: timeText(for: stageResults.jerseyLeaders.yellow),
                subtitle: "Stage leader"
            )
        ]
    }

    private var stageEntries: [ResultEntry] {
        guard let stageResults else { return [] }

        return stageResults.classifications
            .sorted { $0.todayTotal > $1.todayTotal }
            .enumerated()
            .map { index, classification in
                ResultEntry(
                    rank: index + 1,
                    rider: riderName(for: classification.riderId),
                    detail: "\(classification.todayTotal) pts",
                    time: durationText(seconds: classification.gcTimeSeconds)
                )
            }
    }

    private var markerEntries: [ResultEntry] {
        guard let stageResults else { return [] }

        return stageResults.markerResults.compactMap { marker in
            guard let winner = marker.crossings.min(by: { $0.rank < $1.rank }) else {
                return nil
            }

            return ResultEntry(
                rank: winner.rank,
                rider: riderName(for: winner.riderId),
                detail: marker.displayName,
                time: "\(winner.points) pts"
            )
        }
    }

    private var seasonEntries: [ResultEntry] {
        guard let seasonStandings else { return [] }

        return seasonStandings.standings
            .sorted { $0.rank < $1.rank }
            .map { standing in
                ResultEntry(
                    rank: standing.rank,
                    rider: riderName(for: standing.riderId),
                    detail: rankMovementText(current: standing.rank, previous: standing.previousRank),
                    time: "\(standing.seasonTotal) pts"
                )
            }
    }

    private func loadResults() {
        loadingState = .loading

        do {
            stageResults = try decodeFixture(
                fileName: "stage-results",
                fallbackJSON: Self.fallbackStageResultsJSON,
                type: StageResultsFixture.self
            )
            seasonStandings = try decodeFixture(
                fileName: "season-standings",
                fallbackJSON: Self.fallbackSeasonStandingsJSON,
                type: SeasonStandingsFixture.self
            )
            let riderDirectory = try decodeFixture(
                fileName: "recap",
                fallbackJSON: Self.fallbackRiderDirectoryJSON,
                type: RiderDirectoryFixture.self
            )
            riderNamesById = riderDirectory.namesById
            loadingState = .loaded
        } catch {
            stageResults = nil
            seasonStandings = nil
            riderNamesById = [:]
            loadingState = .failed("Unable to load fixture results.")
        }
    }

    private func decodeFixture<T: Decodable>(fileName: String, fallbackJSON: String, type: T.Type) throws -> T {
        let data: Data

        if let url = Bundle.main.url(forResource: fileName, withExtension: "json") {
            data = try Data(contentsOf: url)
        } else {
            data = Data(fallbackJSON.utf8)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    private func riderName(for riderId: String) -> String {
        riderNamesById[riderId] ?? riderId
    }

    private func stagePointsText(for riderId: String) -> String {
        guard let classification = stageResults?.classification(for: riderId) else {
            return "0 pts"
        }

        return "\(classification.sprintPoints) sprint pts"
    }

    private func komPointsText(for riderId: String) -> String {
        guard let classification = stageResults?.classification(for: riderId) else {
            return "0 KOM pts"
        }

        return "\(classification.komPoints) KOM pts"
    }

    private func timeText(for riderId: String) -> String {
        guard let classification = stageResults?.classification(for: riderId) else {
            return "--"
        }

        return durationText(seconds: classification.gcTimeSeconds)
    }

    private func durationText(seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let remainingSeconds = seconds % 60
        return String(format: "%d:%02d:%02d", hours, minutes, remainingSeconds)
    }

    private func rankMovementText(current: Int, previous: Int) -> String {
        if current < previous {
            return "Up from #\(previous)"
        }

        if current > previous {
            return "Down from #\(previous)"
        }

        return "Held #\(current)"
    }

    private static let fallbackRiderDirectoryJSON = """
    {
      "riders": [
        { "id": "rider-001", "displayName": "Marta" },
        { "id": "rider-002", "displayName": "Leo" }
      ]
    }
    """

    private static let fallbackStageResultsJSON = """
    {
      "stageId": "stage-001",
      "markerResults": [
        {
          "markerId": "marker-sprint-001",
          "type": "sprint",
          "crossings": [
            { "riderId": "rider-001", "crossedAtSeconds": 1498, "rank": 1, "points": 20 },
            { "riderId": "rider-002", "crossedAtSeconds": 1506, "rank": 2, "points": 17 }
          ]
        },
        {
          "markerId": "marker-climb-001",
          "type": "climb",
          "crossings": [
            { "riderId": "rider-002", "crossedAtSeconds": 2997, "rank": 1, "points": 10 },
            { "riderId": "rider-001", "crossedAtSeconds": 3011, "rank": 2, "points": 8 }
          ]
        }
      ],
      "classifications": [
        {
          "stageId": "stage-001",
          "riderId": "rider-001",
          "sprintPoints": 20,
          "komPoints": 8,
          "finishBonus": 5,
          "todayTotal": 33,
          "gcTimeSeconds": 5890
        },
        {
          "stageId": "stage-001",
          "riderId": "rider-002",
          "sprintPoints": 17,
          "komPoints": 10,
          "finishBonus": 3,
          "todayTotal": 30,
          "gcTimeSeconds": 5924
        }
      ],
      "jerseyLeaders": {
        "green": "rider-001",
        "polkaDot": "rider-002",
        "yellow": "rider-001"
      }
    }
    """

    private static let fallbackSeasonStandingsJSON = """
    {
      "seasonId": "season-001",
      "standings": [
        {
          "seasonId": "season-001",
          "riderId": "rider-001",
          "seasonTotal": 84,
          "rank": 1,
          "previousRank": 2
        },
        {
          "seasonId": "season-001",
          "riderId": "rider-002",
          "seasonTotal": 79,
          "rank": 2,
          "previousRank": 1
        }
      ]
    }
    """
}

private struct ResultsRaceHeader: View {
    let riderCount: Int
    let markerCount: Int
    let jerseyCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Stage 1 Results")
                        .font(.title2.weight(.bold))
                    Text("Barcelona Hills · fixture race classification")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text("Final")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.green.opacity(0.15), in: Capsule())
                    .foregroundStyle(.green)
            }

            HStack(spacing: 12) {
                ResultSummaryMetric(value: "\(riderCount)", label: "Riders", color: .blue)
                ResultSummaryMetric(value: "\(markerCount)", label: "Markers", color: .red)
                ResultSummaryMetric(value: "\(jerseyCount)", label: "Jerseys", color: .yellow)
            }
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct ResultSection: View {
    let title: String
    let entries: [ResultEntry]

    var body: some View {
        Section(title) {
            ForEach(entries) { entry in
                ResultRow(entry: entry)
            }
        }
    }
}

private struct LoadingResultsRow: View {
    var body: some View {
        HStack(spacing: 12) {
            ProgressView()
            Text("Loading fixture results")
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
    }
}

private struct EmptyResultsRow: View {
    var body: some View {
        ContentUnavailableView(
            "No results yet",
            systemImage: "list.number",
            description: Text("Stage and season results will appear after fixture data is loaded.")
        )
    }
}

private struct ErrorResultsRow: View {
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

private struct JerseyLeaderCard: View {
    let leader: JerseyLeaderResult

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                JerseyIcon(jersey: leader.jersey)
                    .frame(width: 48, height: 54)
                    .accessibilityHidden(true)

                Spacer()

                Text(leader.jersey.shortLabel)
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(leader.jersey.color.opacity(0.16), in: Capsule())
                    .foregroundStyle(leader.jersey.textColor)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(leader.rider)
                    .font(.headline)
                    .lineLimit(1)
                Text(leader.subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Text(leader.detail)
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(leader.jersey.textColor)
        }
        .padding(12)
        .background(leader.jersey.color.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(leader.jersey.color.opacity(0.22), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }
}

private struct JerseyIcon: View {
    let jersey: LeaderJersey

    var body: some View {
        ZStack {
            JerseyShape()
                .fill(jersey.color)

            if jersey == .polkaDot {
                PolkaDotPattern()
                    .fill(.red)
                    .clipShape(JerseyShape())
            }

            JerseyShape()
                .stroke(.primary.opacity(0.14), lineWidth: 1)
        }
    }
}

private struct JerseyShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.width * 0.28, y: rect.height * 0.08))
        path.addLine(to: CGPoint(x: rect.width * 0.12, y: rect.height * 0.20))
        path.addLine(to: CGPoint(x: rect.width * 0.02, y: rect.height * 0.42))
        path.addLine(to: CGPoint(x: rect.width * 0.20, y: rect.height * 0.50))
        path.addLine(to: CGPoint(x: rect.width * 0.24, y: rect.height * 0.94))
        path.addLine(to: CGPoint(x: rect.width * 0.76, y: rect.height * 0.94))
        path.addLine(to: CGPoint(x: rect.width * 0.80, y: rect.height * 0.50))
        path.addLine(to: CGPoint(x: rect.width * 0.98, y: rect.height * 0.42))
        path.addLine(to: CGPoint(x: rect.width * 0.88, y: rect.height * 0.20))
        path.addLine(to: CGPoint(x: rect.width * 0.72, y: rect.height * 0.08))
        path.addQuadCurve(
            to: CGPoint(x: rect.width * 0.28, y: rect.height * 0.08),
            control: CGPoint(x: rect.width * 0.50, y: rect.height * 0.22)
        )
        path.closeSubpath()
        return path
    }
}

private struct PolkaDotPattern: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let dotSize = min(rect.width, rect.height) * 0.13
        let points = [
            CGPoint(x: rect.width * 0.32, y: rect.height * 0.30),
            CGPoint(x: rect.width * 0.64, y: rect.height * 0.32),
            CGPoint(x: rect.width * 0.45, y: rect.height * 0.52),
            CGPoint(x: rect.width * 0.68, y: rect.height * 0.70),
            CGPoint(x: rect.width * 0.30, y: rect.height * 0.75)
        ]

        for point in points {
            path.addEllipse(in: CGRect(x: point.x - dotSize / 2, y: point.y - dotSize / 2, width: dotSize, height: dotSize))
        }

        return path
    }
}

private struct ResultRow: View {
    let entry: ResultEntry

    var body: some View {
        HStack(spacing: 12) {
            Text("\(entry.rank)")
                .font(.headline.monospacedDigit())
                .frame(width: 30, height: 30)
                .background(entry.rank == 1 ? Color.yellow.opacity(0.25) : Color.gray.opacity(0.18), in: Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(entry.rider)
                    .font(.headline)
                Text(entry.detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text(entry.time)
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}

private struct ResultSummaryMetric: View {
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

private struct JerseyLeaderResult: Identifiable {
    let id = UUID()
    let jersey: LeaderJersey
    let rider: String
    let detail: String
    let subtitle: String
}

private struct ResultEntry: Identifiable {
    let id = UUID()
    let rank: Int
    let rider: String
    let detail: String
    let time: String
}

private struct StageResultsFixture: Decodable {
    let stageId: String
    let markerResults: [MarkerResultFixture]
    let classifications: [ClassificationFixture]
    let jerseyLeaders: JerseyLeadersFixture

    func classification(for riderId: String) -> ClassificationFixture? {
        classifications.first { $0.riderId == riderId }
    }
}

private struct MarkerResultFixture: Decodable, Identifiable {
    var id: String { markerId }
    let markerId: String
    let type: String
    let crossings: [MarkerCrossingFixture]

    var displayName: String {
        switch type {
        case "sprint":
            return "Sprint"
        case "climb":
            return "KOM"
        default:
            return type.capitalized
        }
    }
}

private struct MarkerCrossingFixture: Decodable {
    let riderId: String
    let crossedAtSeconds: Int
    let rank: Int
    let points: Int
}

private struct ClassificationFixture: Decodable {
    let stageId: String
    let riderId: String
    let sprintPoints: Int
    let komPoints: Int
    let finishBonus: Int
    let todayTotal: Int
    let gcTimeSeconds: Int
}

private struct JerseyLeadersFixture: Decodable {
    let green: String
    let polkaDot: String
    let yellow: String
}

private struct SeasonStandingsFixture: Decodable {
    let seasonId: String
    let standings: [SeasonStandingFixture]
}

private struct SeasonStandingFixture: Decodable, Identifiable {
    var id: String { riderId }
    let seasonId: String
    let riderId: String
    let seasonTotal: Int
    let rank: Int
    let previousRank: Int
}

private struct RiderDirectoryFixture: Decodable {
    let riders: [RiderNameFixture]

    var namesById: [String: String] {
        Dictionary(uniqueKeysWithValues: riders.map { ($0.id, $0.displayName) })
    }
}

private struct RiderNameFixture: Decodable {
    let id: String
    let displayName: String
}

private enum ResultsLoadingState {
    case loading
    case loaded
    case failed(String)
}

private enum LeaderJersey {
    case green
    case polkaDot
    case yellow

    var shortLabel: String {
        switch self {
        case .green:
            return "PTS"
        case .polkaDot:
            return "KOM"
        case .yellow:
            return "GC"
        }
    }

    var color: Color {
        switch self {
        case .green:
            return .green
        case .polkaDot:
            return .white
        case .yellow:
            return .yellow
        }
    }

    var textColor: Color {
        switch self {
        case .green:
            return .green
        case .polkaDot:
            return .red
        case .yellow:
            return .orange
        }
    }
}

#Preview {
    ResultsView()
}
