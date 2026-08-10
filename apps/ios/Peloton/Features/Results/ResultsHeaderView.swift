import SwiftUI

struct ResultsRaceHeader: View {
  let riderCount: Int
  let markerCount: Int
  let jerseyCount: Int
  let stageName: String

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 6) {
          Text(stageName)
            .font(.title2.weight(.bold))
          Text("Race classification")
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

struct ResultSummaryMetric: View {
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
