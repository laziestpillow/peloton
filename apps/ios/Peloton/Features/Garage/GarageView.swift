import PelotonCore
import PelotonDesignSystem
import SwiftUI

struct GarageView: View {
  let store: AppStore
  @State private var jerseyColor = "#2F80ED"
  @State private var accentColor = "#F2C94C"
  @State private var helmetColor = "#FFFFFF"
  @State private var bikeColor = "#111111"
  @State private var pattern = KitPattern.stripes

  var body: some View {
    NavigationStack {
      Form {
        if let rider = store.rider {
          Section {
            RiderGarageHeader(
              riderName: rider.displayName,
              appearance: draftAppearance
            )
            .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
            .listRowBackground(Color.clear)
          }

          Section("Identity") {
            HStack {
              Label("Race name", systemImage: "person.text.rectangle")
              Spacer()
              Text(rider.displayName)
                .foregroundStyle(.secondary)
            }
          }

          Section("Colors") {
            GarageColorPicker(title: "Jersey", value: $jerseyColor, color: color(jerseyColor))
            GarageColorPicker(title: "Accent", value: $accentColor, color: color(accentColor))
            GarageColorPicker(title: "Helmet", value: $helmetColor, color: color(helmetColor))
            GarageColorPicker(title: "Bike", value: $bikeColor, color: color(bikeColor))
          }

          Section("Kit Pattern") {
            Picker("Pattern", selection: $pattern) {
              ForEach(KitPattern.allCases, id: \.self) { pattern in
                Label(pattern.title, systemImage: pattern.systemImage).tag(pattern)
              }
            }
            .pickerStyle(.segmented)

            PatternSummary(pattern: pattern)
          }

          Section {
            Button {
              Task { await store.saveAppearance(draftAppearance) }
            } label: {
              Label(store.isSavingGarage ? "Saving" : "Save Appearance", systemImage: "checkmark.circle")
            }
            .disabled(store.isSavingGarage || !canSave(comparedTo: rider))

            Button {
              loadDraft()
            } label: {
              Label("Reset Draft", systemImage: "arrow.counterclockwise")
            }
            .disabled(!hasDraftChanges(comparedTo: rider))
          }
        } else if store.isLoading {
          ProgressView("Loading rider")
        } else {
          ContentUnavailableView("No rider", systemImage: "person.crop.circle")
        }
      }
      .navigationTitle("Garage")
      .task(id: store.rider?.id) {
        loadDraft()
      }
    }
  }

  private var draftAppearance: RiderAppearance {
    RiderAppearance(
      jerseyColor: normalizedHex(jerseyColor),
      accentColor: normalizedHex(accentColor),
      helmetColor: normalizedHex(helmetColor),
      bikeColor: normalizedHex(bikeColor),
      pattern: pattern
    )
  }

  private func canSave(comparedTo rider: RiderProfile) -> Bool {
    hasDraftChanges(comparedTo: rider)
  }

  private func hasDraftChanges(comparedTo rider: RiderProfile) -> Bool {
    draftAppearance != rider.appearance
  }

  private func loadDraft() {
    guard let rider = store.rider else { return }
    jerseyColor = rider.appearance.jerseyColor
    accentColor = rider.appearance.accentColor
    helmetColor = rider.appearance.helmetColor
    bikeColor = rider.appearance.bikeColor
    pattern = rider.appearance.pattern
  }

  private func normalizedHex(_ value: String) -> String {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.hasPrefix("#") ? trimmed : "#\(trimmed)"
  }

  private func color(_ hex: String) -> Color {
    Color(hex: normalizedHex(hex))
  }
}

private struct RiderGarageHeader: View {
  let riderName: String
  let appearance: RiderAppearance

  var body: some View {
    VStack(spacing: 16) {
      RiderAvatarView(appearance: appearance)
        .scaleEffect(1.1)
        .frame(height: 170)

      VStack(spacing: 4) {
        Text(riderName)
          .font(.title2.weight(.bold))
          .lineLimit(1)
        Text("Rider kit preview")
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
    }
    .frame(maxWidth: .infinity)
    .padding(16)
    .background(.background, in: RoundedRectangle(cornerRadius: 8))
    .accessibilityElement(children: .combine)
  }
}

private struct GarageColorPicker: View {
  let title: String
  @Binding var value: String
  let color: Color

  var body: some View {
    HStack(spacing: 12) {
      GarageSwatch(color: color)
      TextField(title, text: $value)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .accessibilityLabel("\(title) color")
    }
  }
}

private struct GarageSwatch: View {
  let color: Color

  var body: some View {
    Circle()
      .fill(color)
      .frame(width: 24, height: 24)
      .overlay(Circle().stroke(.primary.opacity(0.12), lineWidth: 1))
      .accessibilityHidden(true)
  }
}

private struct PatternSummary: View {
  let pattern: KitPattern

  var body: some View {
    Label(pattern.description, systemImage: pattern.systemImage)
      .font(.caption)
      .foregroundStyle(.secondary)
  }
}

private extension KitPattern {
  var title: String {
    switch self {
    case .solid:
      return "Solid"
    case .stripes:
      return "Stripes"
    case .polkaDots:
      return "Dots"
    }
  }

  var description: String {
    switch self {
    case .solid:
      return "Clean kit for a general classification look."
    case .stripes:
      return "High-contrast road race styling."
    case .polkaDots:
      return "Climber-inspired mountain pattern."
    }
  }

  var systemImage: String {
    switch self {
    case .solid:
      return "square.fill"
    case .stripes:
      return "line.3.horizontal"
    case .polkaDots:
      return "circle.grid.2x2.fill"
    }
  }
}

private extension Color {
  init(hex: String) {
    var value = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    if value.count == 3 {
      value = value.map { "\($0)\($0)" }.joined()
    }

    guard let integer = UInt64(value, radix: 16) else {
      self = .gray
      return
    }

    self.init(
      red: Double((integer >> 16) & 0xFF) / 255,
      green: Double((integer >> 8) & 0xFF) / 255,
      blue: Double(integer & 0xFF) / 255
    )
  }
}

#Preview {
  GarageView(store: AppStore.makeDefault())
}
