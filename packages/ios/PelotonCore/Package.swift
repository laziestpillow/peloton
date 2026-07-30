// swift-tools-version: 6.2
import PackageDescription

let package = Package(
  name: "PelotonCore",
  platforms: [.iOS(.v18), .macOS(.v15)],
  products: [
    .library(name: "PelotonCore", targets: ["PelotonCore"])
  ],
  targets: [
    .target(name: "PelotonCore"),
    .testTarget(name: "PelotonCoreTests", dependencies: ["PelotonCore"])
  ]
)

