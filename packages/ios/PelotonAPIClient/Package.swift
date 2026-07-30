// swift-tools-version: 6.2
import PackageDescription

let package = Package(
  name: "PelotonAPIClient",
  platforms: [.iOS(.v18), .macOS(.v15)],
  products: [
    .library(name: "PelotonAPIClient", targets: ["PelotonAPIClient"])
  ],
  dependencies: [
    .package(path: "../PelotonCore")
  ],
  targets: [
    .target(name: "PelotonAPIClient", dependencies: ["PelotonCore"]),
    .testTarget(name: "PelotonAPIClientTests", dependencies: ["PelotonAPIClient"])
  ]
)

