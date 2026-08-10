import PelotonCore
import SwiftUI

struct RecapView: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  let store: AppStore
  @State private var isPlaying = false
  @State private var progress = 0.35
  @State private var speed = 1.0

  private var selectedStage: Stage? {
    store.stages.first { $0.id == store.selectedStageId }
  }

  private var routeDistanceMeters: Double {
    selectedStage?.route.distanceMeters ?? store.recap?.routeDistanceMeters ?? 1
  }

  private var markers: [RaceMarker] {
    guard let recap = store.recap else { return [] }

    var routeMarkers = recap.markers.map { marker in
      RaceMarker(
        id: marker.id,
        title: marker.displayTitle,
        distance: marker.positionMeters.recapDistanceText,
        position: marker.positionMeters / max(routeDistanceMeters, 1),
        color: marker.markerColor,
        systemImage: marker.systemImage
      )
    }

    routeMarkers.append(
      RaceMarker(
        id: "finish",
        title: "Finish",
        distance: routeDistanceMeters.recapDistanceText,
        position: 1,
        color: .yellow,
        systemImage: "flag.checkered"
      )
    )

    return routeMarkers
  }

  private var leaders: [RecapLeader] {
    guard let results = store.results else { return [] }

    return [
      RecapLeader(title: "Green", rider: riderName(results.jerseyLeaders.green), detail: "Sprint leader", color: .green),
      RecapLeader(title: "Polka", rider: riderName(results.jerseyLeaders.polkaDot), detail: "KOM leader", color: .red),
      RecapLeader(title: "Yellow", rider: riderName(results.jerseyLeaders.yellow), detail: "Stage leader", color: .yellow)
    ]
  }

  private var currentRiders: [TimelineRider] {
    guard let recap = store.recap else { return [] }
    return recap.timelineRiders(at: progress, routeDistanceMeters: routeDistanceMeters)
  }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: 16) {
          if let recap = store.recap {
            RecapStageHeader(
              stageName: selectedStage?.name ?? recap.stageId,
              stageId: recap.stageId,
              progress: progress,
              speed: speed,
              routeDistanceMeters: routeDistanceMeters,
              elapsedSeconds: Int(Double(recap.durationSeconds) * progress)
            )

            RaceTimelinePanel(
              progress: progress,
              routeElevation: selectedStage?.route.elevation ?? [],
              markers: markers,
              riders: currentRiders,
              reduceMotion: reduceMotion
            )

            RaceControlPanel(isPlaying: $isPlaying, progress: $progress, speed: $speed)

            MarkerMomentsPanel(markers: markers, currentProgress: progress)

            if !leaders.isEmpty {
              LeaderStrip(leaders: leaders)
            }
          } else if store.isLoading {
            LoadingRecapPanel()
          } else {
            EmptyRecapPanel()
          }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
      }
      .navigationTitle("Recap")
      .onChange(of: store.selectedStageId) {
        progress = 0
        isPlaying = false
      }
      .task(id: isPlaying) {
        await advanceTimelineIfNeeded()
      }
    }
  }

  private func riderName(_ riderId: String) -> String {
    store.recap?.riders.first(where: { $0.id == riderId })?.displayName ?? riderId
  }

  private func advanceTimelineIfNeeded() async {
    guard isPlaying else { return }

    while isPlaying && !Task.isCancelled {
      try? await Task.sleep(for: .milliseconds(reduceMotion ? 900 : 450))
      guard isPlaying && !Task.isCancelled else { return }

      let increment = 0.025 * speed
      if progress + increment >= 1 {
        progress = 1
        isPlaying = false
      } else {
        progress += increment
      }
    }
  }
}

#Preview {
  RecapView(store: AppStore.makeDefault())
}
