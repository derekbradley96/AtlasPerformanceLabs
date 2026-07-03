// swift-tools-version: 5.9
import PackageDescription

// Copied into node_modules/@capacitor-community/in-app-review/Package.swift by
// scripts/patch-native-plugins.js (postinstall). 6.0.0 (latest for Capacitor 6
// — 7.x/8.x need Cap 7/8) ships no Package.swift, so `npx cap sync ios`
// silently drops it from the SPM manifest — the plugin installs but never
// actually links into the iOS build.
// SPM does not allow mixed Swift + Objective-C source in one target, but this plugin's
// ios/Plugin folder has both (Swift sources + the CAP_PLUGIN registration macro in
// InAppReviewPlugin.m/.h) — split into two targets over the same folder with
// disjoint excludes.
let package = Package(
    name: "CapacitorCommunityInAppReview",
    platforms: [.iOS(.v13)],
    products: [
        .library(
            name: "CapacitorCommunityInAppReview",
            targets: ["CapacitorCommunityInAppReviewObjC", "CapacitorCommunityInAppReview"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "6.0.0")
    ],
    targets: [
        .target(
            name: "CapacitorCommunityInAppReviewObjC",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin",
            sources: ["InAppReviewPlugin.m"],
            publicHeadersPath: "."),
        .target(
            name: "CapacitorCommunityInAppReview",
            dependencies: [
                "CapacitorCommunityInAppReviewObjC",
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin",
            exclude: ["Info.plist", "InAppReviewPlugin.h", "InAppReviewPlugin.m"])
    ]
)
