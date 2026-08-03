import PelotonCore
import PelotonDesignSystem
import SwiftUI

struct RecapView: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  let store: AppStore
  @State private var isPlaying = false
  @State private var timeSeconds = 0.0
  @State private var speed = 1.0

  var body: some View {
    NavigationStack {
      VStack(spacing: 20) {
        if let recap = store.recap, let stage = store.stages.first(where: { $0.id == recap.stageId }) {
          GeometryReader { proxy in
            ZStack(alignment: .bottomLeading) {
              ElevationProfile(points: stage.route.elevation)
                .fill(.green.opacity(0.12))
              ElevationProfile(points: stage.route.elevation)
                .stroke(.green, lineWidth: 3)

              ForEach(recap.markers) { marker in
                Rectangle()
                  .fill(marker.type == "climb" ? .red : .yellow)
                  .frame(width: 4)
                  .offset(x: proxy.size.width * CGFloat(marker.positionMeters / max(stage.route.distanceMeters, 1)))
              }

              ForEach(currentFrame?.positions ?? [], id: \.riderId) { position in
                if let rider = recap.riders.first(where: { $0.id == position.riderId }) {
                  RiderAvatarView(appearance: rider.appearance)
                    .scaleEffect(0.42)
                    .offset(
                      x: proxy.size.width * CGFloat(position.positionMeters / max(stage.route.distanceMeters, 1)) - 50,
                      y: -44 - CGFloat(recap.riders.firstIndex(where: { $0.id == rider.id }) ?? 0) * 16
                    )
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: timeSeconds)
                }
              }
            }
          }
          .frame(height: 240)
          .padding()
          .accessibilityLabel("Race recap elevation profile")

          VStack(spacing: 12) {
            Slider(value: $timeSeconds, in: 0...Double(max(recap.durationSeconds, 1)))
              .accessibilityLabel("Timeline")
            HStack {
              Button {
                isPlaying.toggle()
              } label: {
                Label(isPlaying ? "Pause" : "Play", systemImage: isPlaying ? "pause.fill" : "play.fill")
              }
              .buttonStyle(.borderedProminent)

              Picker("Speed", selection: $speed) {
                Text("1x").tag(1.0)
                Text("1.5x").tag(1.5)
                Text("2x").tag(2.0)
              }
              .pickerStyle(.segmented)
              .frame(maxWidth: 220)
            }
          }
          .padding(.horizontal)

          if let leaders = store.results?.jerseyLeaders {
            HStack {
              JerseyLeader(label: "Green", rider: riderName(leaders.green), color: .green)
              JerseyLeader(label: "Polka", rider: riderName(leaders.polkaDot), color: .red)
              JerseyLeader(label: "Yellow", rider: riderName(leaders.yellow), color: .yellow)
            }
            .padding(.horizontal)
          }

          Spacer()
        } else if store.isLoading {
          ProgressView("Loading recap")
        } else {
          ContentUnavailableView("No recap", systemImage: "play.circle")
        }
      }
      .navigationTitle("Recap")
      .onChange(of: store.selectedStageId) {
        timeSeconds = 0
        isPlaying = false
      }
    }
  }

  private var currentFrame: TimelineFrame? {
    guard let recap = store.recap else {
      return nil
    }
    return recap.timeline.min(by: {
      abs(Double($0.timeSeconds) - timeSeconds) < abs(Double($1.timeSeconds) - timeSeconds)
    })
  }

  private func riderName(_ riderId: String) -> String {
    store.recap?.riders.first(where: { $0.id == riderId })?.displayName ?? riderId
  }
}

struct ElevationProfile: Shape {
  let points: [RouteElevationPoint]

  func path(in rect: CGRect) -> Path {
    guard points.count > 1 else { return Path() }
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
}

struct JerseyLeader: View {
  let label: String
  let rider: String
  let color: Color

  var body: some View {
    VStack(spacing: 6) {
      Circle().fill(color).frame(width: 18, height: 18)
      Text(label).font(.caption.weight(.semibold))
      Text(rider).font(.caption2).foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity)
    .accessibilityElement(children: .combine)
  }
}

#Preview {
  RecapView(store: AppStore.makeDefault())
}
