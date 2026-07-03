// swift-tools-version: 5.9
import PackageDescription

// Copied into node_modules/@capacitor/live-updates/Package.swift by
// scripts/patch-native-plugins.js (postinstall). The published 0.3.1 package
// (latest that supports Capacitor 6 — 0.4+ requires Capacitor 7/8) has no
// Package.swift, so `npx cap sync ios` silently drops it from the SPM manifest.
// Pure-Swift plugin (registers via CAPBridgedPlugin), so a single target works.
// The IonicLiveUpdates SDK dependency mirrors the podspec's `~> 0.5.4` pin,
// served from Ionic's official SPM binary releases repo (the same repo their
// own 0.5.0 Package.swift uses).
let package = Package(
    name: "CapacitorLiveUpdates",
    platforms: [.iOS(.v13)],
    products: [
        .library(
            name: "CapacitorLiveUpdates",
            targets: ["CapacitorLiveUpdates"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "6.0.0"),
        .package(url: "https://github.com/ionic-team/ionic-live-updates-releases.git", "0.5.4"..<"0.6.0")
    ],
    targets: [
        .target(
            name: "CapacitorLiveUpdates",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "IonicLiveUpdates", package: "ionic-live-updates-releases")
            ],
            path: "ios/Plugin",
            exclude: ["Info.plist"])
    ]
)
