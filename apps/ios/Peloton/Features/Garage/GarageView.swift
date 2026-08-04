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
            HStack {
              Spacer()
              RiderAvatarView(appearance: draftAppearance)
              Spacer()
            }
            .listRowBackground(Color.clear)
          }

          Section("Identity") {
            LabeledContent("Display name", value: rider.displayName)
            LabeledContent("Environment", value: store.configuration.environment.rawValue.capitalized)
          }

          Section("Colors") {
            TextField("Jersey", text: $jerseyColor)
              .textInputAutocapitalization(.never)
              .accessibilityLabel("Jersey color")
            TextField("Accent", text: $accentColor)
              .textInputAutocapitalization(.never)
              .accessibilityLabel("Accent color")
            TextField("Helmet", text: $helmetColor)
              .textInputAutocapitalization(.never)
              .accessibilityLabel("Helmet color")
            TextField("Bike", text: $bikeColor)
              .textInputAutocapitalization(.never)
              .accessibilityLabel("Bike color")
          }

          Section("Kit Pattern") {
            Picker("Pattern", selection: $pattern) {
              ForEach(KitPattern.allCases, id: \.self) { pattern in
                Text(pattern.title).tag(pattern)
              }
            }
            .pickerStyle(.segmented)
          }

          Section {
            Button {
              Task { await store.saveAppearance(draftAppearance) }
            } label: {
              Label(store.isSavingGarage ? "Saving" : "Save Appearance", systemImage: "checkmark.circle")
            }
            .disabled(store.isSavingGarage || draftAppearance == rider.appearance)
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

  private func loadDraft() {
    guard let appearance = store.rider?.appearance else { return }
    jerseyColor = appearance.jerseyColor
    accentColor = appearance.accentColor
    helmetColor = appearance.helmetColor
    bikeColor = appearance.bikeColor
    pattern = appearance.pattern
  }

  private func normalizedHex(_ value: String) -> String {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.hasPrefix("#") ? trimmed : "#\(trimmed)"
  }
}

extension KitPattern {
  var title: String {
    switch self {
    case .solid: "Solid"
    case .stripes: "Stripes"
    case .polkaDots: "Dots"
    }
  }
}

#Preview {
  GarageView(store: AppStore.makeDefault())
}
