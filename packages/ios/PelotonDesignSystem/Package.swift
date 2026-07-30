// swift-tools-version: 6.2
import PackageDescription

let package = Package(
  name: "PelotonDesignSystem",
  platforms: [.iOS(.v18), .macOS(.v15)],
  products: [
    .library(name: "PelotonDesignSystem", targets: ["PelotonDesignSystem"])
  ],
  dependencies: [
    .package(path: "../PelotonCore")
  ],
  targets: [
    .target(name: "PelotonDesignSystem", dependencies: ["PelotonCore"])
  ]
)

