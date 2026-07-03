// swift-tools-version: 5.9
import PackageDescription

// Copied into node_modules/@capacitor-mlkit/barcode-scanning/Package.swift by
// scripts/patch-native-plugins.js (postinstall). No published version ships a
// Package.swift (not even 8.x — Google MLKit itself is CocoaPods-only), so
// `npx cap sync ios` silently dropped the plugin: the barcode scanner JS called
// a plugin that was never compiled in. Google MLKit comes from the community
// SPM repackaging d-date/google-mlkit-swiftpm, pinned exact 5.0.1 = GoogleMLKit
// 5.0.0, the exact version this plugin's podspec pins.
// Constraints imposed by the prebuilt MLKit binaries (see that repo's README):
//  - no arm64 simulator slice → the app project sets
//    EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64 (simulator runs x86_64/Rosetta)
//  - the app target needs -ObjC and -all_load in OTHER_LDFLAGS
// Mixed Swift + ObjC sources → two targets over ios/Plugin, as in the other patches.
let package = Package(
    name: "CapacitorMlkitBarcodeScanning",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "CapacitorMlkitBarcodeScanning",
            targets: ["CapacitorMlkitBarcodeScanningObjC", "CapacitorMlkitBarcodeScanning"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "6.0.0"),
        .package(url: "https://github.com/d-date/google-mlkit-swiftpm.git", exact: "5.0.1")
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
