import Foundation
import SwiftUI

struct RecapView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isPlaying = false
    @State private var time = 0.35
    @State private var speed = 1.0
    @State private var recap: RecapFixture?
    @State private var loadingState = RecapLoadingState.loading

    private var routeDistanceMeters: Double {
        recap?.routeDistanceMeters ?? 42195
    }

    private var markers: [RaceMarker] {
        guard let recap else { return [] }

        var routeMarkers = recap.markers.map { marker in
            RaceMarker(
                id: marker.id,
                title: marker.displayTitle,
                distance: marker.positionMeters.distanceText,
                position: marker.positionMeters / routeDistanceMeters,
                color: marker.color,
                systemImage: marker.systemImage
            )
        }

        routeMarkers.append(
            RaceMarker(
                id: "finish",
                title: "Finish",
                distance: routeDistanceMeters.distanceText,
                position: 1,
                color: .yellow,
                systemImage: "flag.checkered"
            )
        )

        return routeMarkers
    }

    private var leaders: [RecapLeader] {
        guard let recap else { return [] }

        return [
            RecapLeader(title: "Green", rider: recap.winnerName(forMarkerType: "sprint"), detail: "Sprint leader", color: .green),
            RecapLeader(title: "Polka", rider: recap.winnerName(forMarkerType: "climb"), detail: "KOM leader", color: .red),
            RecapLeader(title: "Yellow", rider: recap.stageLeaderName, detail: "Stage leader", color: .yellow)
        ]
    }

    private var currentRiders: [TimelineRider] {
        recap?.timelineRiders(at: time) ?? []
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    switch loadingState {
                    case .loading:
                        LoadingRecapPanel()
                    case .loaded:
                        if let recap {
                            RecapStageHeader(
                                stageId: recap.stageId,
                                time: time,
                                speed: speed,
                                routeDistanceMeters: routeDistanceMeters,
                                elapsedSeconds: Int(Double(recap.durationSeconds) * time)
                            )

                            RaceTimelinePanel(
                                time: time,
                                markers: markers,
                                riders: currentRiders,
                                reduceMotion: reduceMotion
                            )

                            RaceControlPanel(isPlaying: $isPlaying, time: $time, speed: $speed)

                            MarkerMomentsPanel(markers: markers, currentTime: time)

                            LeaderStrip(leaders: leaders)
                        } else {
                            EmptyRecapPanel()
                        }
                    case .failed:
                        ErrorRecapPanel {
                            loadRecap()
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .navigationTitle("Recap")
            .task {
                loadRecap()
            }
            .task(id: isPlaying) {
                await advanceTimelineIfNeeded()
            }
        }
    }

    private func loadRecap() {
        loadingState = .loading

        do {
            let data: Data
            if let url = Bundle.main.url(forResource: "recap", withExtension: "json") {
                data = try Data(contentsOf: url)
            } else {
                data = Data(Self.fallbackRecapJSON.utf8)
            }

            recap = try JSONDecoder().decode(RecapFixture.self, from: data)
            loadingState = .loaded
        } catch {
            recap = nil
            loadingState = .failed
        }
    }

    private func advanceTimelineIfNeeded() async {
        guard isPlaying else { return }

        while isPlaying && !Task.isCancelled {
            try? await Task.sleep(for: .milliseconds(reduceMotion ? 900 : 450))
            guard isPlaying && !Task.isCancelled else { return }

            let increment = 0.025 * speed
            if time + increment >= 1 {
                time = 1
                isPlaying = false
            } else {
                time += increment
            }
        }
    }
}

private struct RecapStageHeader: View {
    let stageId: String
    let time: Double
    let speed: Double
    let routeDistanceMeters: Double
    let elapsedSeconds: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Stage 1 Replay")
                        .font(.title2.weight(.bold))
                    Text("\(stageId) · race recap timeline")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Label("\(Int(time * 100))%", systemImage: "play.circle.fill")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.blue.opacity(0.14), in: Capsule())
                    .foregroundStyle(.blue)
            }

            HStack(spacing: 12) {
                RecapMetric(value: routeDistanceMeters.distanceValueText, label: "km", color: .green)
                RecapMetric(value: elapsedSeconds.timeText, label: "elapsed", color: .red)
                RecapMetric(value: speedLabel, label: "speed", color: .orange)
            }
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 8))
    }

    private var speedLabel: String {
        if speed == 1 {
            return "1x"
        }

        return "\(speed)x"
    }
}

private struct RaceTimelinePanel: View {
    let time: Double
    let markers: [RaceMarker]
    let riders: [TimelineRider]
    let reduceMotion: Bool

    private var replayAnimation: Animation? {
        reduceMotion ? nil : .easeInOut(duration: 0.25)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Race Timeline", systemImage: "waveform.path.ecg")
                    .font(.headline)
                Spacer()
                Text("Live replay")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }

            GeometryReader { proxy in
                ZStack(alignment: .bottomLeading) {
                    ElevationFill()
                        .fill(.green.opacity(0.12))
                    ElevationLine()
                        .stroke(.green, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))

                    ForEach(markers) { marker in
                        TimelineMarker(marker: marker)
                            .position(x: proxy.size.width * marker.position, y: markerY(for: marker, height: proxy.size.height))
                    }

                    Rectangle()
                        .fill(.yellow)
                        .frame(width: 4, height: proxy.size.height - 18)
                        .offset(x: proxy.size.width * time)
                        .shadow(color: .yellow.opacity(0.45), radius: 4)
                        .animation(replayAnimation, value: time)

                    ForEach(Array(riders.enumerated()), id: \.element.id) { index, rider in
                        VStack(spacing: 2) {
                            AvatarPreview(
                                jerseyColor: rider.jerseyColor,
                                accentColor: rider.accentColor,
                                helmetColor: rider.helmetColor,
                                bikeColor: rider.bikeColor,
                                pattern: rider.pattern
                            )
                            .scaleEffect(0.36)

                            Text(rider.name)
                                .font(.caption2.weight(.semibold))
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(.thinMaterial, in: Capsule())
                        }
                        .position(
                            x: proxy.size.width * rider.position,
                            y: riderY(for: index, height: proxy.size.height)
                        )
                        .animation(replayAnimation, value: rider.position)
                    }
                }
            }
            .frame(height: 230)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Race recap elevation profile with rider positions and course markers")
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 8))
    }

    private func markerY(for marker: RaceMarker, height: CGFloat) -> CGFloat {
        switch marker.title {
        case "Sprint":
            return height * 0.58
        case "KOM":
            return height * 0.36
        default:
            return height * 0.24
        }
    }

    private func riderY(for index: Int, height: CGFloat) -> CGFloat {
        index.isMultiple(of: 2) ? height * 0.56 : height * 0.74
    }
}

private struct RaceControlPanel: View {
    @Binding var isPlaying: Bool
    @Binding var time: Double
    @Binding var speed: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Race Control")
                .font(.headline)

            Slider(value: $time, in: 0...1)
                .accessibilityLabel("Timeline progress")

            HStack(spacing: 12) {
                Button {
                    isPlaying.toggle()
                } label: {
                    Label(isPlaying ? "Pause" : "Play", systemImage: isPlaying ? "pause.fill" : "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)

                Button {
                    time = 0
                    isPlaying = false
                } label: {
                    Image(systemName: "backward.end.fill")
                        .frame(width: 42, height: 20)
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("Restart replay")
            }

            Picker("Speed", selection: $speed) {
                Text("1x").tag(1.0)
                Text("1.5x").tag(1.5)
                Text("2x").tag(2.0)
            }
            .pickerStyle(.segmented)
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct MarkerMomentsPanel: View {
    let markers: [RaceMarker]
    let currentTime: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Marker Moments")
                .font(.headline)

            ForEach(markers) { marker in
                HStack(spacing: 12) {
                    Image(systemName: marker.systemImage)
                        .font(.caption.weight(.bold))
                        .frame(width: 28, height: 28)
                        .background(marker.color.opacity(0.16), in: Circle())
                        .foregroundStyle(marker.color)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(marker.title)
                            .font(.subheadline.weight(.semibold))
                        Text(marker.distance)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    Text(currentTime >= marker.position ? "Passed" : "Ahead")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background((currentTime >= marker.position ? Color.green : Color.gray).opacity(0.14), in: Capsule())
                        .foregroundStyle(currentTime >= marker.position ? .green : .secondary)
                }
            }
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct LeaderStrip: View {
    let leaders: [RecapLeader]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Jersey Leaders")
                .font(.headline)

            HStack(spacing: 10) {
                ForEach(leaders) { leader in
                    RecapLeaderCard(leader: leader)
                }
            }
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct TimelineMarker: View {
    let marker: RaceMarker

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: marker.systemImage)
                .font(.caption2.weight(.bold))
                .frame(width: 24, height: 24)
                .background(marker.color.opacity(0.2), in: Circle())
                .foregroundStyle(marker.color)
            Text(marker.title)
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(.thinMaterial, in: Capsule())
        }
    }
}

private struct RecapLeaderCard: View {
    let leader: RecapLeader

    var body: some View {
        VStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 5)
                .fill(leader.color)
                .frame(width: 24, height: 30)
                .overlay(alignment: .top) {
                    Circle()
                        .fill(.background)
                        .frame(width: 10, height: 10)
                        .offset(y: -2)
                }
                .overlay {
                    if leader.title == "Polka" {
                        Circle().fill(.white).frame(width: 5, height: 5).offset(x: -5, y: -4)
                        Circle().fill(.white).frame(width: 5, height: 5).offset(x: 5, y: 4)
                    }
                }

            Text(leader.title)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
            Text(leader.rider)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

private struct LoadingRecapPanel: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ProgressView()
            Text("Loading recap timeline")
                .font(.headline)
            Text("Fixture replay data is being prepared.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct EmptyRecapPanel: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: "flag.slash")
                .font(.title3)
                .foregroundStyle(.secondary)
            Text("No recap data yet")
                .font(.headline)
            Text("The recap fixture is present, but there are no timeline points to show.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct ErrorRecapPanel: View {
    let retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Unable to load recap fixture.", systemImage: "exclamationmark.triangle")
                .font(.headline)
                .foregroundStyle(.red)
            Button("Retry", action: retry)
                .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct RecapMetric: View {
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

private struct ElevationFill: Shape {
    func path(in rect: CGRect) -> Path {
        var path = ElevationLine().path(in: rect)
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

private struct ElevationLine: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY - 30))
        path.addCurve(
            to: CGPoint(x: rect.width * 0.32, y: rect.maxY - 96),
            control1: CGPoint(x: rect.width * 0.12, y: rect.maxY - 36),
            control2: CGPoint(x: rect.width * 0.20, y: rect.maxY - 132)
        )
        path.addCurve(
            to: CGPoint(x: rect.width * 0.68, y: rect.maxY - 62),
            control1: CGPoint(x: rect.width * 0.46, y: rect.maxY - 58),
            control2: CGPoint(x: rect.width * 0.54, y: rect.maxY - 38)
        )
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - 126))
        return path
    }
}

private enum RecapLoadingState {
    case loading
    case loaded
    case failed
}

private struct RaceMarker: Identifiable {
    let id: String
    let title: String
    let distance: String
    let position: Double
    let color: Color
    let systemImage: String
}

private struct RecapLeader: Identifiable {
    let id = UUID()
    let title: String
    let rider: String
    let detail: String
    let color: Color
}

private struct TimelineRider: Identifiable {
    let id: String
    let name: String
    let position: Double
    let jerseyColor: Color
    let accentColor: Color
    let helmetColor: Color
    let bikeColor: Color
    let pattern: KitPattern
}

private struct RecapFixture: Decodable {
    let stageId: String
    let durationSeconds: Int
    let riders: [RecapRider]
    let markers: [RecapMarker]
    let timeline: [RecapTimelinePoint]

    var routeDistanceMeters: Double {
        timeline
            .flatMap(\.positions)
            .map(\.positionMeters)
            .max() ?? markers.map(\.positionMeters).max() ?? 42195
    }

    var stageLeaderName: String {
        guard let leaderId = timeline.last?.positions.sorted(by: { $0.positionMeters > $1.positionMeters }).first?.riderId else {
            return riders.first?.displayName ?? "Leader"
        }

        return riderName(for: leaderId)
    }

    func winnerName(forMarkerType markerType: String) -> String {
        guard let markerId = markers.first(where: { $0.type == markerType })?.id else {
            return stageLeaderName
        }

        let winnerId = timeline
            .flatMap(\.positions)
            .first(where: { $0.markerEventId == markerId })?
            .riderId

        return winnerId.map(riderName) ?? stageLeaderName
    }

    func timelineRiders(at progress: Double) -> [TimelineRider] {
        let sortedTimeline = timeline.sorted { $0.timeSeconds < $1.timeSeconds }
        guard !sortedTimeline.isEmpty else { return [] }

        let targetSeconds = Double(durationSeconds) * progress
        let previousPoint = sortedTimeline.last { Double($0.timeSeconds) <= targetSeconds } ?? sortedTimeline[0]
        let nextPoint = sortedTimeline.first { Double($0.timeSeconds) >= targetSeconds } ?? previousPoint
        let segmentDuration = max(Double(nextPoint.timeSeconds - previousPoint.timeSeconds), 1)
        let segmentProgress = min(max((targetSeconds - Double(previousPoint.timeSeconds)) / segmentDuration, 0), 1)

        return riders.compactMap { rider -> TimelineRider? in
            guard let previousPosition = previousPoint.positions.first(where: { $0.riderId == rider.id }) else { return nil }

            let nextPosition = nextPoint.positions.first(where: { $0.riderId == rider.id }) ?? previousPosition
            let interpolatedMeters = previousPosition.positionMeters + ((nextPosition.positionMeters - previousPosition.positionMeters) * segmentProgress)

            return TimelineRider(
                id: rider.id,
                name: rider.displayName,
                position: min(max(interpolatedMeters / routeDistanceMeters, 0), 1),
                jerseyColor: Color(hex: rider.appearance.jerseyColor),
                accentColor: Color(hex: rider.appearance.accentColor),
                helmetColor: Color(hex: rider.appearance.helmetColor),
                bikeColor: Color(hex: rider.appearance.bikeColor),
                pattern: rider.appearance.kitPattern
            )
        }
    }

    private func riderName(for riderId: String) -> String {
        riders.first(where: { $0.id == riderId })?.displayName ?? riderId
    }
}

private struct RecapRider: Decodable {
    let id: String
    let displayName: String
    let appearance: RecapAppearance
}

private struct RecapAppearance: Decodable {
    let jerseyColor: String
    let accentColor: String
    let helmetColor: String
    let bikeColor: String
    let pattern: String

    var kitPattern: KitPattern {
        switch pattern {
        case "stripes":
            return .stripes
        case "polkaDots":
            return .polkaDots
        default:
            return .solid
        }
    }
}

private struct RecapMarker: Decodable {
    let id: String
    let type: String
    let positionMeters: Double
    let category: Int?

    var displayTitle: String {
        switch type {
        case "sprint":
            return "Sprint"
        case "climb":
            return "KOM"
        default:
            return type.capitalized
        }
    }

    var color: Color {
        switch type {
        case "sprint":
            return .green
        case "climb":
            return .red
        default:
            return .blue
        }
    }

    var systemImage: String {
        switch type {
        case "sprint":
            return "bolt.fill"
        case "climb":
            return "mountain.2.fill"
        default:
            return "mappin.circle.fill"
        }
    }
}

private struct RecapTimelinePoint: Decodable {
    let timeSeconds: Int
    let positions: [RecapTimelinePosition]
}

private struct RecapTimelinePosition: Decodable {
    let riderId: String
    let positionMeters: Double
    let speedMetersPerSecond: Double
    let markerEventId: String?
}

private extension Double {
    var distanceText: String {
        "\(distanceValueText) km"
    }

    var distanceValueText: String {
        let kilometers = self / 1000
        return kilometers.formatted(.number.precision(.fractionLength(1)))
    }
}

private extension Int {
    var timeText: String {
        let minutes = self / 60
        let seconds = self % 60
        return "\(minutes):\(String(format: "%02d", seconds))"
    }
}

private extension Color {
    init(hex: String) {
        let sanitized = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: sanitized).scanHexInt64(&value)

        let red: UInt64
        let green: UInt64
        let blue: UInt64

        switch sanitized.count {
        case 6:
            red = (value & 0xFF0000) >> 16
            green = (value & 0x00FF00) >> 8
            blue = value & 0x0000FF
        default:
            red = 47
            green = 128
            blue = 237
        }

        self.init(
            .sRGB,
            red: Double(red) / 255,
            green: Double(green) / 255,
            blue: Double(blue) / 255,
            opacity: 1
        )
    }
}

private extension RecapView {
    static let fallbackRecapJSON = """
    {
      "stageId": "stage-001",
      "durationSeconds": 3600,
      "riders": [
        {
          "id": "rider-001",
          "userId": "user-001",
          "displayName": "Marta",
          "appearance": {
            "jerseyColor": "#2F80ED",
            "accentColor": "#F2C94C",
            "helmetColor": "#FFFFFF",
            "bikeColor": "#111111",
            "pattern": "stripes"
          },
          "createdAt": "2026-07-01T10:00:00Z",
          "updatedAt": "2026-07-20T10:00:00Z"
        },
        {
          "id": "rider-002",
          "userId": "user-002",
          "displayName": "Leo",
          "appearance": {
            "jerseyColor": "#27AE60",
            "accentColor": "#EB5757",
            "helmetColor": "#222222",
            "bikeColor": "#6FCF97",
            "pattern": "polkaDots"
          },
          "createdAt": "2026-07-01T10:00:00Z",
          "updatedAt": "2026-07-20T10:00:00Z"
        }
      ],
      "markers": [
        {
          "id": "marker-sprint-001",
          "type": "sprint",
          "positionMeters": 12000,
          "latitude": 41.39,
          "longitude": 2.16,
          "geofenceRadiusMeters": 25,
          "category": null,
          "pointsSchedule": [20, 17, 15, 13, 11]
        },
        {
          "id": "marker-climb-001",
          "type": "climb",
          "positionMeters": 31000,
          "latitude": 41.42,
          "longitude": 2.18,
          "geofenceRadiusMeters": 25,
          "category": 3,
          "pointsSchedule": [10, 8, 6, 4, 2]
        }
      ],
      "timeline": [
        {
          "timeSeconds": 0,
          "positions": [
            { "riderId": "rider-001", "positionMeters": 0, "speedMetersPerSecond": 8.8, "markerEventId": null },
            { "riderId": "rider-002", "positionMeters": 0, "speedMetersPerSecond": 8.7, "markerEventId": null }
          ]
        },
        {
          "timeSeconds": 1500,
          "positions": [
            { "riderId": "rider-001", "positionMeters": 12030, "speedMetersPerSecond": 9.3, "markerEventId": "marker-sprint-001" },
            { "riderId": "rider-002", "positionMeters": 11970, "speedMetersPerSecond": 9.1, "markerEventId": null }
          ]
        },
        {
          "timeSeconds": 3000,
          "positions": [
            { "riderId": "rider-001", "positionMeters": 30940, "speedMetersPerSecond": 6.2, "markerEventId": null },
            { "riderId": "rider-002", "positionMeters": 31020, "speedMetersPerSecond": 6.5, "markerEventId": "marker-climb-001" }
          ]
        },
        {
          "timeSeconds": 3600,
          "positions": [
            { "riderId": "rider-001", "positionMeters": 42195, "speedMetersPerSecond": 8.0, "markerEventId": null },
            { "riderId": "rider-002", "positionMeters": 42195, "speedMetersPerSecond": 7.8, "markerEventId": null }
          ]
        }
      ]
    }
    """
}

#Preview {
    RecapView()
}
