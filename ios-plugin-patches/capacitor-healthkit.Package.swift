// swift-tools-version: 5.9
import PackageDescription

// Copied into node_modules/capacitor-healthkit/Package.swift by
// scripts/patch-native-plugins.js (postinstall). The published package has no
// Package.swift of its own, so `npx cap sync ios` silently drops it from the
// SPM manifest — the plugin installs but never actually links into the iOS build.
// SPM does not allow mixed Swift + Objective-C source in one target, but this plugin's
// ios/Plugin folder has both (Plugin.swift + the CAP_PLUGIN registration macro in Plugin.m/.h)
// — split into two targets over the same folder with disjoint excludes.
let package = Package(
    name: "CapacitorHealthkit",
    platforms: [.iOS(.v13)],
    products: [
        .library(
            name: "CapacitorHealthkit",
            targets: ["CapacitorHealthkitObjC", "CapacitorHealthkit"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "6.0.0")
    ],
    targets: [
        .target(
            name: "CapacitorHealthkitObjC",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin",
            exclude: ["Info.plist", "Plugin.swift"],
            publicHeadersPath: "."),
        .target(
            name: "CapacitorHealthkit",
            dependencies: [
                "CapacitorHealthkitObjC",
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin",
            exclude: ["Info.plist", "Plugin.h", "Plugin.m"])
    ]
)
