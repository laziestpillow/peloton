// swift-tools-version: 6.2
import PackageDescription

let package = Package(
  name: "PelotonFixtures",
  platforms: [.iOS(.v18), .macOS(.v15)],
  products: [
    .library(name: "PelotonFixtures", targets: ["PelotonFixtures"])
  ],
  dependencies: [
    .package(path: "../PelotonCore")
  ],
  targets: [
    .target(
      name: "PelotonFixtures",
      dependencies: ["PelotonCore"],
      resources: [.process("Resources")]
    ),
    .testTarget(name: "PelotonFixturesTests", dependencies: ["PelotonFixtures", "PelotonCore"])
  ]
)
