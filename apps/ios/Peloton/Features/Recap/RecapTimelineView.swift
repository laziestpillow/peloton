import PelotonCore
import PelotonDesignSystem
import SwiftUI

struct RaceTimelinePanel: View {
  let progress: Double
  let routeElevation: [RouteElevationPoint]
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
        Text("Replay")
          .font(.caption.weight(.semibold))
          .foregroundStyle(.secondary)
      }

      GeometryReader { proxy in
        ZStack(alignment: .bottomLeading) {
          ElevationProfile(points: routeElevation)
            .fill(.green.opacity(0.12))
          ElevationProfile(points: routeElevation)
            .stroke(.green, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))

          ForEach(markers) { marker in
            TimelineMarker(marker: marker)
              .position(x: proxy.size.width * marker.position, y: markerY(for: marker, height: proxy.size.height))
          }

          Rectangle()
            .fill(.yellow)
            .frame(width: 4, height: proxy.size.height - 18)
            .offset(x: proxy.size.width * progress)
            .shadow(color: .yellow.opacity(0.45), radius: 4)
            .animation(replayAnimation, value: progress)

          ForEach(Array(riders.enumerated()), id: \.element.id) { index, rider in
            VStack(spacing: 2) {
              RiderAvatarView(appearance: rider.appearance)
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

struct RaceControlPanel: View {
  @Binding var isPlaying: Bool
  @Binding var progress: Double
  @Binding var speed: Double

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Race Control")
        .font(.headline)

      Slider(value: $progress, in: 0...1)
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
          progress = 0
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

struct TimelineMarker: View {
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

struct ElevationProfile: Shape {
  let points: [RouteElevationPoint]

  func path(in rect: CGRect) -> Path {
    guard points.count > 1 else {
      return fallbackPath(in: rect)
    }

    let maxPosition = max(points.map(\.positionMeters).max() ?? 1, 1)
    let minAltitude = points.map(\.altitudeMeters).min() ?? 0
    let maxAltitude = max(points.map(\.altitudeMeters).max() ?? 1, minAltitude + 1)
    var path = Path()
    path.move(to: CGPoint(x: rect.minX, y: rect.maxY))

    for point in points {
      let x = rect.minX + rect.width * CGFloat(point.positionMeters / maxPosition)
      let altitudeRatio = (point.altitudeMeters - minAltitude) / (maxAltitude - minAltitude)
      let y = rect.maxY - rect.height * 0.8 * CGFloat(altitudeRatio) - 20
      path.addLine(to: CGPoint(x: x, y: y))
    }

    path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
    path.closeSubpath()
    return path
  }

  private func fallbackPath(in rect: CGRect) -> Path {
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
    path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
    path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
    path.closeSubpath()
    return path
  }
}
