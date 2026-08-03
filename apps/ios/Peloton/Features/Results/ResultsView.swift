import Foundation
import PelotonCore
import SwiftUI

struct ResultsView: View {
  let store: AppStore

  var body: some View {
    NavigationStack {
      List {
        if store.isLoading {
          ProgressView("Loading results")
        } else if store.results == nil && store.standings == nil {
          ContentUnavailableView("No results", systemImage: "list.number")
        } else {
          Section("Stage Classification") {
            ForEach(store.results?.classifications ?? [], id: \.riderId) { classification in
              ResultRow(
                rank: rank(for: classification),
                rider: riderName(classification.riderId),
                detail: "\(classification.todayTotal) pts - \(classification.gcTimeSeconds.duration)"
              )
            }
          }

          Section("Marker Winners") {
            ForEach(store.results?.markerResults ?? [], id: \.markerId) { marker in
              ForEach(marker.crossings.prefix(3), id: \.riderId) { crossing in
                ResultRow(
                  rank: crossing.rank,
                  rider: riderName(crossing.riderId),
                  detail: "\(marker.type.uppercased()) - \(crossing.points) pts - \(crossing.crossedAtSeconds.duration)"
                )
              }
            }
          }

          Section("Season") {
            ForEach(store.standings?.standings ?? [], id: \.riderId) { standing in
              ResultRow(
                rank: standing.rank,
                rider: riderName(standing.riderId),
                detail: "\(standing.seasonTotal) pts - \(archetype(for: standing.riderId))"
              )
            }
          }
        }
      }
      .navigationTitle("Results")
      .refreshable {
        await store.loadInitialData()
      }
    }
  }

  private func rank(for classification: StageClassification) -> Int {
    let ordered = (store.results?.classifications ?? []).sorted {
      if $0.todayTotal == $1.todayTotal {
        return $0.gcTimeSeconds < $1.gcTimeSeconds
      }
      return $0.todayTotal > $1.todayTotal
    }
    return (ordered.firstIndex(where: { $0.riderId == classification.riderId }) ?? 0) + 1
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
}

struct ResultRow: View {
  let rank: Int
  let rider: String
  let detail: String

  var body: some View {
    HStack(spacing: 12) {
      Text("\(rank)")
        .font(.headline.monospacedDigit())
        .frame(width: 28, height: 28)
        .background(.quaternary, in: Circle())
      VStack(alignment: .leading) {
        Text(rider).font(.headline)
        Text(detail).font(.subheadline).foregroundStyle(.secondary)
      }
    }
    .accessibilityElement(children: .combine)
  }
}

private extension Int {
  var duration: String {
    let hours = self / 3600
    let minutes = (self % 3600) / 60
    let seconds = self % 60
    return hours > 0
      ? String(format: "%d:%02d:%02d", hours, minutes, seconds)
      : String(format: "%d:%02d", minutes, seconds)
  }
}

#Preview {
  ResultsView(store: AppStore.makeDefault())
}
