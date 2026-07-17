// swift-tools-version: 5.9
import PackageDescription

// Copied into node_modules/@capacitor-mlkit/barcode-scanning/Package.swift by
// scripts/patch-native-plugins.js (postinstall). No published version ships a
// Package.swift (not even 8.x — Google MLKit itself is CocoaPods-only), so
// `npx cap sync ios` silently dropped the plugin: the barcode scanner JS called
// a plugin that was never compiled in. Google MLKit comes from the community
// SPM repackaging d-date/google-mlkit-swiftpm.
// Pinned exact 9.0.0-1: App Store review rejects the 5.0.0 binaries
// (ITMS-91065 missing signature on GoogleToolboxForMac; the same chain drew
// ITMS-91061 missing privacy manifest). Google ships signatures + privacy
// manifests from 6.x, but the 7.0.0 tag requires the GULISASwizzler product
// that GoogleUtilities 8.1 (what firebase-ios-sdk 11.x resolves) no longer
// has, and the plain 9.0.0 zips embed beta Info.plist versions App Store
// Connect rejects — 9.0.0-1 is the maintainer's App-Store-safe tag.
// Constraints imposed by the prebuilt MLKit binaries (see that repo's README):
//  - no arm64 simulator slice → the app project sets
//    EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64 (simulator runs x86_64/Rosetta)
//  - the app target needs -ObjC and -all_load in OTHER_LDFLAGS
// Mixed Swift + ObjC sources → two targets over ios/Plugin, as in the other patches.
let package = Package(
    name: "CapacitorMlkitBarcodeScanning",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapacitorMlkitBarcodeScanning",
            targets: ["CapacitorMlkitBarcodeScanningObjC", "CapacitorMlkitBarcodeScanning"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "6.0.0"),
        .package(url: "https://github.com/d-date/google-mlkit-swiftpm.git", exact: "9.0.0-1")
    ],
    targets: [
        .target(
            name: "CapacitorMlkitBarcodeScanningObjC",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin",
            sources: ["BarcodeScannerPlugin.m"],
            publicHeadersPath: "."),
        .target(
            name: "CapacitorMlkitBarcodeScanning",
            dependencies: [
                "CapacitorMlkitBarcodeScanningObjC",
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "MLKitBarcodeScanning", package: "google-mlkit-swiftpm")
            ],
            path: "ios/Plugin",
            exclude: ["Info.plist", "BarcodeScannerPlugin.h", "BarcodeScannerPlugin.m"])
    ]
)
