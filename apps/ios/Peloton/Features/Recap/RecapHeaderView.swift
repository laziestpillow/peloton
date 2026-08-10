import SwiftUI

struct RecapStageHeader: View {
  let stageName: String
  let stageId: String
  let progress: Double
  let speed: Double
  let routeDistanceMeters: Double
  let elapsedSeconds: Int

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 6) {
          Text(stageName)
            .font(.title2.weight(.bold))
          Text("\(stageId) - race recap timeline")
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        Spacer()

        Label("\(Int(progress * 100))%", systemImage: "play.circle.fill")
          .font(.caption.weight(.semibold))
          .padding(.horizontal, 10)
          .padding(.vertical, 6)
          .background(.blue.opacity(0.14), in: Capsule())
          .foregroundStyle(.blue)
      }

      HStack(spacing: 12) {
        RecapMetric(value: routeDistanceMeters.recapDistanceValueText, label: "km", color: .green)
        RecapMetric(value: elapsedSeconds.recapTimeText, label: "elapsed", color: .red)
        RecapMetric(value: speedLabel, label: "speed", color: .orange)
      }
    }
    .padding(16)
    .background(.background, in: RoundedRectangle(cornerRadius: 8))
  }

  private var speedLabel: String {
    speed == 1 ? "1x" : "\(speed)x"
  }
}

struct RecapMetric: View {
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
