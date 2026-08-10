import PelotonCore
import SwiftUI

struct MarkerMomentsPanel: View {
  let markers: [RaceMarker]
  let currentProgress: Double

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

          Text(currentProgress >= marker.position ? "Passed" : "Ahead")
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background((currentProgress >= marker.position ? Color.green : Color.gray).opacity(0.14), in: Capsule())
            .foregroundStyle(currentProgress >= marker.position ? .green : .secondary)
        }
      }
    }
    .padding(16)
    .background(.background, in: RoundedRectangle(cornerRadius: 8))
  }
}

struct LeaderStrip: View {
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

struct RecapLeaderCard: View {
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
      Text(leader.detail)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity)
    .accessibilityElement(children: .combine)
  }
}

struct LoadingRecapPanel: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      ProgressView()
      Text("Loading recap timeline")
        .font(.headline)
      Text("Race replay data is being prepared.")
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(16)
    .background(.background, in: RoundedRectangle(cornerRadius: 8))
  }
}

struct EmptyRecapPanel: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Image(systemName: "flag.slash")
        .font(.title3)
        .foregroundStyle(.secondary)
      Text("No recap data yet")
        .font(.headline)
      Text("The selected stage does not have recap data to show.")
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(16)
    .background(.background, in: RoundedRectangle(cornerRadius: 8))
  }
}

struct RaceMarker: Identifiable {
  let id: String
  let title: String
  let distance: String
  let position: Double
  let color: Color
  let systemImage: String
}

struct RecapLeader: Identifiable {
  let id = UUID()
  let title: String
  let rider: String
  let detail: String
  let color: Color
}

struct TimelineRider: Identifiable {
  let id: String
  let name: String
  let position: Double
  let appearance: RiderAppearance
}

extension StageRecap {
  var routeDistanceMeters: Double {
    timeline
      .flatMap(\.positions)
      .map(\.positionMeters)
      .max() ?? markers.map(\.positionMeters).max() ?? 1
  }

  func timelineRiders(at progress: Double, routeDistanceMeters: Double) -> [TimelineRider] {
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
        position: min(max(interpolatedMeters / max(routeDistanceMeters, 1), 0), 1),
        appearance: rider.appearance
      )
    }
  }
}

extension Marker {
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

  var markerColor: Color {
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

extension Double {
  var recapDistanceText: String {
    "\(recapDistanceValueText) km"
  }

  var recapDistanceValueText: String {
    let kilometers = self / 1000
    return kilometers.formatted(.number.precision(.fractionLength(1)))
  }
}

extension Int {
  var recapTimeText: String {
    let minutes = self / 60
    let seconds = self % 60
    return "\(minutes):\(String(format: "%02d", seconds))"
  }
}
