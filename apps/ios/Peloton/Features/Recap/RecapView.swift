import SwiftUI

struct RecapView: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var isPlaying = false
  @State private var time = 0.35
  @State private var speed = 1.0

  var body: some View {
    NavigationStack {
      VStack(spacing: 20) {
        GeometryReader { proxy in
          ZStack(alignment: .bottomLeading) {
            ElevationProfile()
              .stroke(.green, lineWidth: 3)
              .fill(.green.opacity(0.12))
            Rectangle()
              .fill(.yellow)
              .frame(width: 4)
              .offset(x: proxy.size.width * 0.55)
            AvatarPreview(jerseyColor: .blue, accentColor: .yellow, helmetColor: .white, bikeColor: .black, pattern: .stripes)
              .scaleEffect(0.55)
              .offset(x: proxy.size.width * time - 60, y: -44)
              .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: time)
          }
        }
        .frame(height: 240)
        .padding()
        .accessibilityLabel("Race recap elevation profile")

        VStack(spacing: 12) {
          Slider(value: $time, in: 0...1)
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

        HStack {
          JerseyLeader(label: "Green", rider: "Marta", color: .green)
          JerseyLeader(label: "Polka", rider: "Leo", color: .red)
          JerseyLeader(label: "Yellow", rider: "Marta", color: .yellow)
        }
        .padding(.horizontal)

        Spacer()
      }
      .navigationTitle("Recap")
    }
  }
}

struct ElevationProfile: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
    path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY - 30))
    path.addCurve(to: CGPoint(x: rect.width * 0.35, y: rect.maxY - 90), control1: CGPoint(x: rect.width * 0.15, y: rect.maxY - 35), control2: CGPoint(x: rect.width * 0.2, y: rect.maxY - 120))
    path.addCurve(to: CGPoint(x: rect.width * 0.7, y: rect.maxY - 55), control1: CGPoint(x: rect.width * 0.5, y: rect.maxY - 60), control2: CGPoint(x: rect.width * 0.56, y: rect.maxY - 40))
    path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - 120))
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
  RecapView()
}

