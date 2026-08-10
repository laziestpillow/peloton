import Foundation
import PelotonCore
import SwiftUI

struct ResultsView: View {
  let store: AppStore

  var body: some View {
    NavigationStack {
      List {
        Section {
          ResultsRaceHeader(
            riderCount: store.results?.classifications.count ?? 0,
            markerCount: store.results?.markerResults.count ?? 0,
            jerseyCount: store.results == nil ? 0 : 3,
            stageName: selectedStage?.name ?? "Stage Results"
          )
          .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 8, trailing: 16))
          .listRowBackground(Color.clear)
        }

        if store.isLoading && store.results == nil && store.standings == nil {
          Section("Results") {
            LoadingResultsRow()
          }
        } else if isEmpty {
          Section("Results") {
            ContentUnavailableView(
              "No results yet",
              systemImage: "list.number",
              description: Text("Stage and season results will appear after data is loaded.")
            )
          }
        } else {
          if !jerseyLeaders.isEmpty {
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
          }

          ResultSection(title: "Stage Classification", entries: stageEntries)
          ResultSection(title: "Marker Winners", entries: markerEntries)
          ResultSection(title: "Season", entries: seasonEntries)
        }
      }
      .listStyle(.insetGrouped)
      .navigationTitle("Results")
      .refreshable {
        await store.loadInitialData()
      }
    }
  }

  private var selectedStage: Stage? {
    store.stages.first { $0.id == store.selectedStageId }
  }

  private var isEmpty: Bool {
    stageEntries.isEmpty && markerEntries.isEmpty && seasonEntries.isEmpty
  }

  private var jerseyLeaders: [JerseyLeaderResult] {
    guard let results = store.results else { return [] }

    return [
      JerseyLeaderResult(
        jersey: .green,
        rider: riderName(results.jerseyLeaders.green),
        detail: stagePointsText(for: results.jerseyLeaders.green),
        subtitle: "Points leader"
      ),
      JerseyLeaderResult(
        jersey: .polkaDot,
        rider: riderName(results.jerseyLeaders.polkaDot),
        detail: komPointsText(for: results.jerseyLeaders.polkaDot),
        subtitle: "Climber leader"
      ),
      JerseyLeaderResult(
        jersey: .yellow,
        rider: riderName(results.jerseyLeaders.yellow),
        detail: timeText(for: results.jerseyLeaders.yellow),
        subtitle: "Stage leader"
      )
    ]
  }

  private var stageEntries: [ResultEntry] {
    guard let results = store.results else { return [] }

    return results.classifications
      .sorted {
        if $0.todayTotal == $1.todayTotal {
          return $0.gcTimeSeconds < $1.gcTimeSeconds
        }
        return $0.todayTotal > $1.todayTotal
      }
      .enumerated()
      .map { index, classification in
        ResultEntry(
          rank: index + 1,
          rider: riderName(classification.riderId),
          detail: "\(classification.todayTotal) pts - \(archetype(for: classification.riderId))",
          time: classification.gcTimeSeconds.duration
        )
      }
  }

  private var markerEntries: [ResultEntry] {
    guard let results = store.results else { return [] }

    return results.markerResults.compactMap { marker in
      guard let winner = marker.crossings.min(by: { $0.rank < $1.rank }) else {
        return nil
      }

      return ResultEntry(
        rank: winner.rank,
        rider: riderName(winner.riderId),
        detail: marker.displayName,
        time: "\(winner.points) pts"
      )
    }
  }

  private var seasonEntries: [ResultEntry] {
    guard let standings = store.standings else { return [] }

    return standings.standings
      .sorted { $0.rank < $1.rank }
      .map { standing in
        ResultEntry(
          rank: standing.rank,
          rider: riderName(standing.riderId),
          detail: rankMovementText(current: standing.rank, previous: standing.previousRank),
          time: "\(standing.seasonTotal) pts"
        )
      }
  }

  private func riderName(_ riderId: String) -> String {
    store.recap?.riders.first(where: { $0.id == riderId })?.displayName ?? riderId
  }

  private func archetype(for riderId: String) -> String {
    guard let snapshot = store.archetypes?.data.first(where: { $0.riderId == riderId }) else {
      return "Pending archetype"
    }
    return "\(snapshot.archetype.capitalized) - \(Int(snapshot.confidence * 100))% confidence"
  }

  private func stagePointsText(for riderId: String) -> String {
    guard let classification = store.results?.classifications.first(where: { $0.riderId == riderId }) else {
      return "0 pts"
    }
    return "\(classification.sprintPoints) sprint pts"
  }

  private func komPointsText(for riderId: String) -> String {
    guard let classification = store.results?.classifications.first(where: { $0.riderId == riderId }) else {
      return "0 KOM pts"
    }
    return "\(classification.komPoints) KOM pts"
  }

  private func timeText(for riderId: String) -> String {
    guard let classification = store.results?.classifications.first(where: { $0.riderId == riderId }) else {
      return "--"
    }
    return classification.gcTimeSeconds.duration
  }

  private func rankMovementText(current: Int, previous: Int?) -> String {
    guard let previous else {
      return "New entry"
    }

    if current < previous {
      return "Up from #\(previous)"
    }

    if current > previous {
      return "Down from #\(previous)"
    }

    return "Held #\(current)"
  }
}

#Preview {
  ResultsView(store: AppStore.makeDefault())
}
