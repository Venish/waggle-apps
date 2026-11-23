# Waggle 개발 계획 (03) — 네이버지도 네이티브 SDK · New Architecture PoC

> ⚠️ **[폐기됨 — 2026-07-22]** 교육앱 피벗(D14: RN 제거)으로 이 문서는 더 이상 유효하지 않습니다. 최신 모바일 아키텍처는 [아키텍처_08_모바일웹_아키텍처.md](./아키텍처_08_모바일웹_아키텍처.md), 기획은 [기획_교육앱_스펙정의.md](./기획_교육앱_스펙정의.md) 참조.

작성일: 2026-04-21
버전: v1.0
목적: **RN New Architecture(Fabric/TurboModule/JSI) + 네이버지도 네이티브 SDK 호환성 검증**
담당: iOS 1명 · Android 1명 병렬 진행 (예상 소요: 1~2일)

> **이 문서만 보고 PoC를 즉시 개발 시작할 수 있는 수준으로 작성되었습니다.**
> 모든 코드는 `apps/poc-walk/` 에 위치하는 순수 네이티브 앱(React Native 없음)입니다.

---

## 1. PoC 목적 및 검증 항목

### 1.1 배경

`packages/native-walk`의 핵심 기술 결정(Fabric Component로 네이버지도 임베드, TurboModule로 JSI 이벤트 전달)을 실제 코드로 구현하기 전에, **두 가지 알 수 없는 리스크**를 실기기에서 검증한다.

| 리스크 | 검증 방법 |
|---|---|
| 네이버지도 iOS SDK + Swift 5.9 호환성 | PoC 앱에서 지도 렌더링 + polyline 5,000포인트 |
| 네이버지도 Android SDK + Kotlin + AGP 8.x 호환성 | PoC 앱에서 동일 검증 |
| CLLocationManager 30분 백그라운드 유지 (iOS 15+) | 실기기 30분 화면 잠금 + 앱 포그라운드 복귀 후 경로 확인 |
| ForegroundService + FusedLocation 30분 유지 (Android) | 실기기 30분 + 타 앱 전환 시나리오 |
| Kalman 필터 후 거리 오차 측정 | 실제 이동 경로 vs 앱 측정값 비교 |
| 배터리 소모 | 30분 산책 전/후 배터리 퍼센트 비교 |

### 1.2 PoC 통과 기준 (Pass Criteria)

| 항목 | 기준 | 판정 |
|---|---|---|
| 지도 렌더링 | polyline 5,000포인트 60fps 이상 | 실기기 Instruments / GPU Overdraw |
| iOS 백그라운드 유지율 | 30분 화면 잠금 후 경로 유실 없음 | 시작/종료 포인트 수 비교 |
| Android 앱 kill 후 복원 | Recent Apps에서 종료 후 재진입 시 세션 복원 | 수동 테스트 |
| 거리 오차 | 실거리 대비 ±10% 이내 | 실측 vs 앱 측정값 |
| 배터리 소모 | 30분에 6% 이하 | 30분 전/후 배터리 퍼센트 |

---

## 2. 프로젝트 셋업

### 2.1 디렉터리 구조

```
apps/poc-walk/
├── ios/
│   ├── PocWalk.xcodeproj/
│   │   └── project.pbxproj
│   ├── PocWalk/
│   │   ├── AppDelegate.swift
│   │   ├── SceneDelegate.swift
│   │   ├── ViewController.swift         ← 테스트 UI 진입점
│   │   ├── Walk/
│   │   │   ├── WalkTrackingManager.swift
│   │   │   ├── LocationFilter.swift
│   │   │   ├── WalkSessionStore.swift
│   │   │   └── SensorFusion.swift
│   │   ├── Map/
│   │   │   └── WalkMapViewController.swift
│   │   ├── Resources/
│   │   │   ├── Info.plist
│   │   │   └── LaunchScreen.storyboard
│   │   └── Supporting/
│   │       └── Assets.xcassets/
│   └── Podfile
│
└── android/
    ├── app/
    │   ├── src/main/
    │   │   ├── java/app/waggle/pocwalk/
    │   │   │   ├── MainActivity.kt
    │   │   │   ├── walk/
    │   │   │   │   ├── WalkTrackingService.kt
    │   │   │   │   ├── FusedLocationSource.kt
    │   │   │   │   ├── LocationFilter.kt
    │   │   │   │   └── WalkSessionDao.kt
    │   │   │   └── map/
    │   │   │       └── MapFragment.kt
    │   │   ├── res/
    │   │   │   ├── layout/
    │   │   │   │   ├── activity_main.xml
    │   │   │   │   └── fragment_map.xml
    │   │   │   └── values/
    │   │   │       └── strings.xml
    │   │   └── AndroidManifest.xml
    │   └── build.gradle
    ├── build.gradle
    ├── settings.gradle
    └── local.properties                  ← NAVER_MAP_CLIENT_ID 설정
```

---

## 3. iOS PoC

### 3.1 Podfile

```ruby
# apps/poc-walk/ios/Podfile
platform :ios, '15.0'
use_frameworks!

target 'PocWalk' do
  pod 'NMapsMap', '~> 3.19'     # 네이버지도 iOS SDK
end
```

설치:
```bash
cd apps/poc-walk/ios
pod install
open PocWalk.xcworkspace
```

### 3.2 Info.plist 필수 항목

```xml
<!-- apps/poc-walk/ios/PocWalk/Resources/Info.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- 네이버지도 Client ID -->
    <key>NMFClientId</key>
    <string>YOUR_NAVER_MAP_CLIENT_ID</string>

    <!-- 위치 권한 -->
    <key>NSLocationWhenInUseUsageDescription</key>
    <string>산책 경로와 거리를 정확히 기록하기 위해 사용됩니다.</string>
    <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
    <string>화면이 꺼진 상태에서도 산책 경로를 기록하기 위해 사용됩니다.</string>

    <!-- 백그라운드 위치 추적 필수 -->
    <key>UIBackgroundModes</key>
    <array>
        <string>location</string>
    </array>

    <!-- 앱 이름 -->
    <key>CFBundleDisplayName</key>
    <string>PocWalk</string>
</dict>
</plist>
```

### 3.3 `LocationFilter.swift` — Kalman + Douglas-Peucker

```swift
// apps/poc-walk/ios/PocWalk/Walk/LocationFilter.swift
import CoreLocation

// ──────────────────────────────────────────
// 1-D Kalman 필터 (위도/경도 독립 적용)
// Q: 프로세스 노이즈 (낮을수록 이전 예측 신뢰)
// R: 측정 노이즈  (낮을수록 센서 신뢰)
// ──────────────────────────────────────────
class KalmanFilter {
    private var q: Double
    private var r: Double
    private var p: Double = 1.0
    private var k: Double = 0.0
    private var x: Double = 0.0
    private var initialized = false

    init(q: Double = 3.0, r: Double = 10.0) {
        self.q = q
        self.r = r
    }

    func update(_ measurement: Double) -> Double {
        if !initialized {
            x = measurement
            initialized = true
            return x
        }
        p = p + q
        k = p / (p + r)
        x = x + k * (measurement - x)
        p = (1 - k) * p
        return x
    }
}

class LocationFilter {
    private var latFilter = KalmanFilter(q: 3.0, r: 10.0)
    private var lngFilter = KalmanFilter(q: 3.0, r: 10.0)

    /// Kalman 필터 적용 후 보정된 좌표 반환
    func kalmanFilter(location: CLLocation) -> CLLocation {
        let filteredLat = latFilter.update(location.coordinate.latitude)
        let filteredLng = lngFilter.update(location.coordinate.longitude)
        return CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: filteredLat, longitude: filteredLng),
            altitude: location.altitude,
            horizontalAccuracy: location.horizontalAccuracy,
            verticalAccuracy: location.verticalAccuracy,
            course: location.course,
            speed: location.speed,
            timestamp: location.timestamp
        )
    }

    /// Douglas-Peucker 알고리즘 — polyline 단순화
    /// epsilon: 허용 오차 (미터)
    func douglasPeucker(points: [CLLocation], epsilon: Double) -> [CLLocation] {
        guard points.count > 2 else { return points }

        var maxDist = 0.0
        var maxIdx = 0

        let start = points.first!
        let end = points.last!

        for i in 1..<(points.count - 1) {
            let dist = perpendicularDistance(point: points[i], lineStart: start, lineEnd: end)
            if dist > maxDist {
                maxDist = dist
                maxIdx = i
            }
        }

        if maxDist > epsilon {
            let left  = douglasPeucker(points: Array(points[0...maxIdx]), epsilon: epsilon)
            let right = douglasPeucker(points: Array(points[maxIdx...]), epsilon: epsilon)
            return left.dropLast() + right
        } else {
            return [start, end]
        }
    }

    private func perpendicularDistance(point: CLLocation, lineStart: CLLocation, lineEnd: CLLocation) -> Double {
        let x0 = point.coordinate.latitude
        let y0 = point.coordinate.longitude
        let x1 = lineStart.coordinate.latitude
        let y1 = lineStart.coordinate.longitude
        let x2 = lineEnd.coordinate.latitude
        let y2 = lineEnd.coordinate.longitude

        let dx = x2 - x1
        let dy = y2 - y1

        if dx == 0 && dy == 0 {
            return point.distance(from: lineStart)
        }

        let t = ((x0 - x1) * dx + (y0 - y1) * dy) / (dx * dx + dy * dy)
        let nearestX = x1 + t * dx
        let nearestY = y1 + t * dy
        let nearest = CLLocation(latitude: nearestX, longitude: nearestY)
        return point.distance(from: nearest)
    }
}
```

### 3.4 `WalkTrackingManager.swift` (PoC 버전)

```swift
// apps/poc-walk/ios/PocWalk/Walk/WalkTrackingManager.swift
import CoreLocation
import Foundation

protocol WalkTrackingDelegate: AnyObject {
    func didUpdateStats(_ stats: WalkPocStats)
    func didUpdateLocation(_ location: CLLocation)
    func didFinishWalk(summary: WalkPocSummary)
}

struct WalkPocStats {
    let distanceMeters: Double
    let durationSeconds: Int
    let speedMps: Double
    let pointCount: Int
    let rawPointCount: Int    // 필터 전 원시 포인트 수 (비교용)
}

struct WalkPocSummary {
    let distanceMeters: Double
    let durationSeconds: Int
    let rawPointCount: Int
    let filteredPointCount: Int
    let dpPointCount: Int
    let batteryBefore: Float
    let batteryAfter: Float
}

class WalkTrackingManager: NSObject, CLLocationManagerDelegate {

    weak var delegate: WalkTrackingDelegate?

    private let locationManager = CLLocationManager()
    private let locationFilter = LocationFilter()

    private var rawLocations: [CLLocation] = []
    private var filteredLocations: [CLLocation] = []
    private var startTime: Date?
    private var totalDistance: Double = 0
    private var batteryBefore: Float = 0

    private var statsTimer: Timer?

    override init() {
        super.init()
        setupLocationManager()
        UIDevice.current.isBatteryMonitoringEnabled = true
    }

    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 3          // 3m 이상 이동 시만 업데이트
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.showsBackgroundLocationIndicator = true
    }

    func start() {
        rawLocations = []
        filteredLocations = []
        totalDistance = 0
        startTime = Date()
        batteryBefore = UIDevice.current.batteryLevel

        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()

        // 3초마다 통계 델리게이트 호출
        statsTimer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { [weak self] _ in
            self?.emitStats()
        }

        print("[PoC] Walk started. Battery: \(Int(batteryBefore * 100))%")
    }

    func stop() -> WalkPocSummary {
        locationManager.stopUpdatingLocation()
        statsTimer?.invalidate()

        let dpFiltered = locationFilter.douglasPeucker(points: filteredLocations, epsilon: 2.0)
        let batteryAfter = UIDevice.current.batteryLevel

        let summary = WalkPocSummary(
            distanceMeters: totalDistance,
            durationSeconds: Int(Date().timeIntervalSince(startTime ?? Date())),
            rawPointCount: rawLocations.count,
            filteredPointCount: filteredLocations.count,
            dpPointCount: dpFiltered.count,
            batteryBefore: batteryBefore,
            batteryAfter: batteryAfter
        )

        print("""
        [PoC] Walk Summary:
          - Distance:        \(String(format: "%.1f", totalDistance / 1000))km
          - Duration:        \(summary.durationSeconds)s
          - Raw points:      \(summary.rawPointCount)
          - Kalman filtered: \(summary.filteredPointCount)
          - DP simplified:   \(summary.dpPointCount)
          - Battery change:  \(Int(batteryBefore * 100))% → \(Int(batteryAfter * 100))%
          - Battery used:    \(Int((batteryBefore - batteryAfter) * 100))%
        """)

        delegate?.didFinishWalk(summary: summary)
        return summary
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for location in locations {
            // 정확도 필터: 30m 초과 버림
            guard location.horizontalAccuracy > 0,
                  location.horizontalAccuracy <= 30 else {
                print("[PoC] Skipped low-accuracy point: \(location.horizontalAccuracy)m")
                continue
            }

            rawLocations.append(location)

            // Kalman 필터 적용
            let filtered = locationFilter.kalmanFilter(location: location)
            filteredLocations.append(filtered)

            // 거리 누적
            if let prev = filteredLocations.dropLast().last {
                totalDistance += filtered.distance(from: prev)
            }

            delegate?.didUpdateLocation(filtered)
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[PoC] Location error: \(error)")
    }

    private func emitStats() {
        let stats = WalkPocStats(
            distanceMeters: totalDistance,
            durationSeconds: Int(Date().timeIntervalSince(startTime ?? Date())),
            speedMps: filteredLocations.last?.speed ?? 0,
            pointCount: filteredLocations.count,
            rawPointCount: rawLocations.count
        )
        delegate?.didUpdateStats(stats)
    }
}
```

### 3.5 `WalkMapViewController.swift` — 네이버지도 polyline 렌더링 테스트

```swift
// apps/poc-walk/ios/PocWalk/Map/WalkMapViewController.swift
import UIKit
import NMapsMap
import CoreLocation

class WalkMapViewController: UIViewController {

    private var mapView: NMFMapView!
    private var polylineOverlay: NMFPolylineOverlay?
    private var currentMarker: NMFMarker?
    private var pathCoords: [NMGLatLng] = []

    // PoC 성능 측정용
    private var polylineUpdateCount = 0
    private var totalPolylineUpdateTime: Double = 0

    override func viewDidLoad() {
        super.viewDidLoad()
        setupMapView()
    }

    private func setupMapView() {
        // 네이버지도 초기화 (NMFClientId는 Info.plist에서 자동 로드)
        mapView = NMFMapView(frame: view.bounds)
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        mapView.positionMode = .direction   // 현재 위치 추적
        view.addSubview(mapView)
    }

    /// 새 위치 포인트를 polyline에 추가
    func addPoint(_ location: CLLocation) {
        let latLng = NMGLatLng(lat: location.coordinate.latitude, lng: location.coordinate.longitude)
        pathCoords.append(latLng)

        // 성능 측정 시작
        let start = CACurrentMediaTime()
        updatePolyline()
        let elapsed = (CACurrentMediaTime() - start) * 1000

        polylineUpdateCount += 1
        totalPolylineUpdateTime += elapsed

        // 100포인트마다 평균 업데이트 시간 로깅
        if polylineUpdateCount % 100 == 0 {
            let avg = totalPolylineUpdateTime / Double(polylineUpdateCount)
            print("[PoC-Map] Points: \(pathCoords.count), Avg update: \(String(format: "%.2f", avg))ms")
        }

        // 현재 위치로 카메라 이동
        let update = NMFCameraUpdate(scrollTo: latLng, zoomTo: 16)
        update.animation = .easeIn
        update.animationDuration = 0.3
        mapView.moveCamera(update)
    }

    private func updatePolyline() {
        guard pathCoords.count >= 2 else { return }

        // 기존 오버레이 제거
        polylineOverlay?.mapView = nil

        // 새 오버레이 생성
        let overlay = NMFPolylineOverlay(pathCoords)
        overlay?.color = UIColor(red: 0.247, green: 0.729, blue: 0.502, alpha: 1.0)  // walk green
        overlay?.width = 5
        overlay?.mapView = mapView
        polylineOverlay = overlay
    }

    /// 5,000포인트 성능 테스트 (자동 생성 경로)
    func runPolylineStressTest() {
        print("[PoC-Map] Starting 5,000 point stress test...")
        pathCoords = []

        // 서울 기준 가상 경로 (0.0001도 = 약 11m)
        var lat = 37.5665
        var lng = 126.9780

        let stressStart = CACurrentMediaTime()
        for i in 0..<5000 {
            lat += Double.random(in: -0.0002...0.0002)
            lng += Double.random(in: -0.0002...0.0002)
            pathCoords.append(NMGLatLng(lat: lat, lng: lng))

            // 100포인트마다 중간 렌더링 측정
            if i % 100 == 0 {
                let renderStart = CACurrentMediaTime()
                updatePolyline()
                let renderElapsed = (CACurrentMediaTime() - renderStart) * 1000
                print("[PoC-Map] \(i+1) pts: \(String(format: "%.2f", renderElapsed))ms")
            }
        }

        // 최종 5,000포인트 렌더링
        let finalStart = CACurrentMediaTime()
        updatePolyline()
        let totalElapsed = CACurrentMediaTime() - stressStart
        let finalElapsed = (CACurrentMediaTime() - finalStart) * 1000

        print("""
        [PoC-Map] Stress Test Result:
          - Total time: \(String(format: "%.2f", totalElapsed))s
          - Final 5k render: \(String(format: "%.2f", finalElapsed))ms
          - Target: < 16.7ms (60fps)
          - Result: \(finalElapsed < 16.7 ? "✅ PASS" : "❌ FAIL")
        """)
    }
}
```

### 3.6 `ViewController.swift` — PoC 테스트 UI

```swift
// apps/poc-walk/ios/PocWalk/ViewController.swift
import UIKit
import CoreLocation

class ViewController: UIViewController {

    private let tracker = WalkTrackingManager()
    private var mapVC: WalkMapViewController!

    // UI
    private let startButton   = UIButton(type: .system)
    private let stopButton    = UIButton(type: .system)
    private let stressButton  = UIButton(type: .system)
    private let statsLabel    = UILabel()
    private var isTracking    = false

    override func viewDidLoad() {
        super.viewDidLoad()
        tracker.delegate = self
        setupUI()
    }

    private func setupUI() {
        view.backgroundColor = .systemBackground
        title = "Walk PoC"

        // 지도 (화면 상단 70%)
        mapVC = WalkMapViewController()
        addChild(mapVC)
        mapVC.view.frame = CGRect(x: 0, y: 0, width: view.bounds.width, height: view.bounds.height * 0.7)
        view.addSubview(mapVC.view)
        mapVC.didMove(toParent: self)

        // 통계 레이블
        statsLabel.frame = CGRect(x: 16, y: view.bounds.height * 0.7 + 8, width: view.bounds.width - 32, height: 60)
        statsLabel.numberOfLines = 3
        statsLabel.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        statsLabel.text = "준비됨"
        view.addSubview(statsLabel)

        // 버튼들
        let buttonY = view.bounds.height * 0.7 + 76
        configureButton(startButton,  title: "▶ 시작",     color: .systemGreen,  x: 16,                   y: buttonY, action: #selector(startTapped))
        configureButton(stopButton,   title: "■ 종료",     color: .systemRed,    x: view.bounds.width/2,  y: buttonY, action: #selector(stopTapped))
        configureButton(stressButton, title: "⚡ 5K 테스트", color: .systemOrange, x: 16,                   y: buttonY + 56, action: #selector(stressTapped))

        stopButton.isEnabled = false
    }

    private func configureButton(_ btn: UIButton, title: String, color: UIColor, x: CGFloat, y: CGFloat, action: Selector) {
        btn.setTitle(title, for: .normal)
        btn.backgroundColor = color
        btn.setTitleColor(.white, for: .normal)
        btn.layer.cornerRadius = 10
        btn.frame = CGRect(x: x, y: y, width: view.bounds.width / 2 - 24, height: 44)
        btn.addTarget(self, action: action, for: .touchUpInside)
        view.addSubview(btn)
    }

    @objc private func startTapped() {
        tracker.start()
        startButton.isEnabled = false
        stopButton.isEnabled = true
        isTracking = true
        print("[PoC] ▶ 시작. 화면을 잠그고 30분 후 확인하세요.")
    }

    @objc private func stopTapped() {
        let summary = tracker.stop()
        startButton.isEnabled = true
        stopButton.isEnabled = false
        isTracking = false
        showSummary(summary)
    }

    @objc private func stressTapped() {
        mapVC.runPolylineStressTest()
    }

    private func showSummary(_ summary: WalkPocSummary) {
        let batteryUsed = Int((summary.batteryBefore - summary.batteryAfter) * 100)
        let alert = UIAlertController(title: "산책 종료", message: """
        거리: \(String(format: "%.1f", summary.distanceMeters / 1000))km
        시간: \(summary.durationSeconds / 60)분
        원시 포인트: \(summary.rawPointCount)
        Kalman 필터 후: \(summary.filteredPointCount)
        DP 단순화 후: \(summary.dpPointCount)
        배터리 소모: \(batteryUsed)%
        """, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "확인", style: .default))
        present(alert, animated: true)
    }
}

extension ViewController: WalkTrackingDelegate {
    func didUpdateStats(_ stats: WalkPocStats) {
        DispatchQueue.main.async {
            self.statsLabel.text = """
            거리: \(String(format: "%.0f", stats.distanceMeters))m  |  \(stats.durationSeconds / 60)분 \(stats.durationSeconds % 60)초
            속도: \(String(format: "%.1f", stats.speedMps * 3.6))km/h
            포인트: 원시 \(stats.rawPointCount)  →  필터 \(stats.pointCount)
            """
        }
    }

    func didUpdateLocation(_ location: CLLocation) {
        DispatchQueue.main.async {
            self.mapVC.addPoint(location)
        }
    }

    func didFinishWalk(summary: WalkPocSummary) {}
}
```

---

## 4. Android PoC

### 4.1 `settings.gradle`

```kotlin
// apps/poc-walk/android/settings.gradle
pluginManagement {
    repositories {
        google(); mavenCentral(); gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        google(); mavenCentral()
        maven { url = uri("https://repository.map.naver.com/archive/maven") }  // 네이버지도
    }
}
rootProject.name = "PocWalk"
include(":app")
```

### 4.2 `app/build.gradle`

```kotlin
// apps/poc-walk/android/app/build.gradle
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    id("kotlin-kapt")
}

android {
    namespace = "app.waggle.pocwalk"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.waggle.pocwalk"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        // 네이버지도 Client ID (local.properties에서 로드)
        val properties = com.android.build.gradle.internal.cxx.configure.gradleLocalProperties(rootDir, providers)
        manifestPlaceholders["naverMapClientId"] = properties.getProperty("NAVER_MAP_CLIENT_ID", "")
    }

    buildFeatures { viewBinding = true }
}

dependencies {
    // 네이버지도
    implementation("com.naver.maps:map-sdk:3.19.1")

    // Google Fused Location
    implementation("com.google.android.gms:play-services-location:21.2.0")

    // Room (오프라인 버퍼)
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")

    // Lifecycle
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")
}
```

### 4.3 `local.properties`

```
# apps/poc-walk/android/local.properties
sdk.dir=/Users/YOUR_NAME/Library/Android/sdk
NAVER_MAP_CLIENT_ID=YOUR_NAVER_MAP_CLIENT_ID
```

### 4.4 `AndroidManifest.xml`

```xml
<!-- apps/poc-walk/android/app/src/main/AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.BATTERY_STATS" />

    <application
        android:name=".PocWalkApp"
        android:allowBackup="true"
        android:label="PocWalk"
        android:theme="@style/Theme.AppCompat.Light.NoActionBar">

        <!-- 네이버지도 Client ID -->
        <meta-data
            android:name="com.naver.maps.map.CLIENT_ID"
            android:value="${naverMapClientId}" />

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- 산책 ForegroundService -->
        <service
            android:name=".walk.WalkTrackingService"
            android:foregroundServiceType="location"
            android:exported="false" />
    </application>
</manifest>
```

### 4.5 `LocationFilter.kt` — Kalman + Douglas-Peucker

```kotlin
// apps/poc-walk/android/app/src/main/java/app/waggle/pocwalk/walk/LocationFilter.kt
package app.waggle.pocwalk.walk

import android.location.Location
import kotlin.math.*

/** 1-D Kalman 필터 */
class KalmanFilter(
    private val q: Double = 3.0,   // 프로세스 노이즈
    private val r: Double = 10.0   // 측정 노이즈
) {
    private var p = 1.0
    private var x = 0.0
    private var initialized = false

    fun update(measurement: Double): Double {
        if (!initialized) { x = measurement; initialized = true; return x }
        p += q
        val k = p / (p + r)
        x += k * (measurement - x)
        p = (1 - k) * p
        return x
    }
}

class LocationFilter {
    private val latFilter = KalmanFilter()
    private val lngFilter = KalmanFilter()

    /** Kalman 필터 적용 */
    fun kalmanFilter(location: Location): Location {
        val filteredLat = latFilter.update(location.latitude)
        val filteredLng = lngFilter.update(location.longitude)
        return Location(location).apply {
            latitude = filteredLat
            longitude = filteredLng
        }
    }

    /** Douglas-Peucker 단순화 */
    fun douglasPeucker(points: List<Location>, epsilon: Double): List<Location> {
        if (points.size <= 2) return points
        var maxDist = 0.0
        var maxIdx = 0
        val start = points.first()
        val end = points.last()
        for (i in 1 until points.size - 1) {
            val dist = perpendicularDistance(points[i], start, end)
            if (dist > maxDist) { maxDist = dist; maxIdx = i }
        }
        return if (maxDist > epsilon) {
            val left  = douglasPeucker(points.subList(0, maxIdx + 1), epsilon)
            val right = douglasPeucker(points.subList(maxIdx, points.size), epsilon)
            left.dropLast() + right
        } else {
            listOf(start, end)
        }
    }

    private fun perpendicularDistance(point: Location, lineStart: Location, lineEnd: Location): Double {
        val x0 = point.latitude;     val y0 = point.longitude
        val x1 = lineStart.latitude; val y1 = lineStart.longitude
        val x2 = lineEnd.latitude;   val y2 = lineEnd.longitude
        val dx = x2 - x1;            val dy = y2 - y1
        if (dx == 0.0 && dy == 0.0) return point.distanceTo(lineStart).toDouble()
        val t = ((x0 - x1) * dx + (y0 - y1) * dy) / (dx * dx + dy * dy)
        val nearestX = x1 + t * dx;  val nearestY = y1 + t * dy
        val nearest = Location("").apply { latitude = nearestX; longitude = nearestY }
        return point.distanceTo(nearest).toDouble()
    }
}
```

### 4.6 `WalkTrackingService.kt` (PoC 버전)

```kotlin
// apps/poc-walk/android/app/src/main/java/app/waggle/pocwalk/walk/WalkTrackingService.kt
package app.waggle.pocwalk.walk

import android.app.*
import android.content.Intent
import android.content.IntentFilter
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import kotlinx.coroutines.*

data class WalkPocStats(
    val distanceMeters: Double,
    val durationSeconds: Long,
    val speedMps: Float,
    val rawPointCount: Int,
    val filteredPointCount: Int,
    val batteryPct: Int,
)

data class WalkPocSummary(
    val distanceMeters: Double,
    val durationSeconds: Long,
    val rawPointCount: Int,
    val filteredPointCount: Int,
    val dpPointCount: Int,
    val batteryBefore: Int,
    val batteryAfter: Int,
)

class WalkTrackingService : Service() {

    companion object {
        const val TAG = "PocWalk"
        const val CHANNEL_ID = "poc_walk"
        const val NOTIFICATION_ID = 1001
        var instance: WalkTrackingService? = null
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private val locationFilter = LocationFilter()
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    private var rawLocations = mutableListOf<android.location.Location>()
    private var filteredLocations = mutableListOf<android.location.Location>()
    private var totalDistance = 0.0
    private var startTime = 0L
    private var batteryBefore = 0

    var onStatsUpdate: ((WalkPocStats) -> Unit)? = null
    var onLocationUpdate: ((android.location.Location) -> Unit)? = null

    private val locationRequest = LocationRequest.Builder(
        Priority.PRIORITY_HIGH_ACCURACY, 1000L   // 1초
    ).apply {
        setMinUpdateDistanceMeters(3f)            // 3m 미만 무시
        setWaitForAccurateLocation(false)
    }.build()

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.locations.forEach { processLocation(it) }
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
        Log.d(TAG, "WalkTrackingService created")
    }

    fun start(): String {
        rawLocations.clear()
        filteredLocations.clear()
        totalDistance = 0.0
        startTime = System.currentTimeMillis()
        batteryBefore = getBatteryPct()

        // ForegroundService 시작
        startForeground(NOTIFICATION_ID, buildNotification("산책 시작"))

        // 위치 업데이트 시작
        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest, locationCallback, Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission denied", e)
        }

        // 3초마다 통계 emit
        scope.launch {
            while (isActive) {
                delay(3000L)
                withContext(Dispatchers.Main) { emitStats() }
            }
        }

        Log.d(TAG, "Walk started. Battery: $batteryBefore%")
        return "poc-session-${System.currentTimeMillis()}"
    }

    fun stop(): WalkPocSummary {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        scope.coroutineContext.cancelChildren()

        val dpFiltered = locationFilter.douglasPeucker(filteredLocations, 2.0)
        val batteryAfter = getBatteryPct()

        val summary = WalkPocSummary(
            distanceMeters = totalDistance,
            durationSeconds = (System.currentTimeMillis() - startTime) / 1000,
            rawPointCount = rawLocations.size,
            filteredPointCount = filteredLocations.size,
            dpPointCount = dpFiltered.size,
            batteryBefore = batteryBefore,
            batteryAfter = batteryAfter,
        )

        Log.d(TAG, """
            [PoC] Walk Summary:
              Distance:        ${"%.1f".format(totalDistance / 1000)}km
              Duration:        ${summary.durationSeconds}s
              Raw points:      ${summary.rawPointCount}
              Kalman filtered: ${summary.filteredPointCount}
              DP simplified:   ${summary.dpPointCount}
              Battery change:  ${batteryBefore}% → ${batteryAfter}%
              Battery used:    ${batteryBefore - batteryAfter}%
        """.trimIndent())

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        return summary
    }

    private fun processLocation(location: android.location.Location) {
        // 정확도 필터 (30m 초과 버림)
        if (location.accuracy > 30f) {
            Log.v(TAG, "Skipped: accuracy=${location.accuracy}m")
            return
        }

        rawLocations.add(location)
        val filtered = locationFilter.kalmanFilter(location)
        filteredLocations.add(filtered)

        if (filteredLocations.size > 1) {
            totalDistance += filtered.distanceTo(filteredLocations[filteredLocations.size - 2])
        }

        onLocationUpdate?.invoke(filtered)
    }

    private fun emitStats() {
        val stats = WalkPocStats(
            distanceMeters = totalDistance,
            durationSeconds = (System.currentTimeMillis() - startTime) / 1000,
            speedMps = filteredLocations.lastOrNull()?.speed ?: 0f,
            rawPointCount = rawLocations.size,
            filteredPointCount = filteredLocations.size,
            batteryPct = getBatteryPct(),
        )
        onStatsUpdate?.invoke(stats)
        updateNotification("🐾 ${"%.1f".format(totalDistance / 1000)}km | ${stats.durationSeconds / 60}분")
    }

    private fun updateNotification(text: String) {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification(text))
    }

    private fun buildNotification(text: String) = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("Waggle PoC 산책")
        .setContentText(text)
        .setSmallIcon(android.R.drawable.ic_menu_mylocation)
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build()

    private fun createNotificationChannel() {
        val channel = NotificationChannel(CHANNEL_ID, "PoC 산책 추적", NotificationManager.IMPORTANCE_LOW)
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }

    private fun getBatteryPct(): Int {
        val bm = getSystemService(BATTERY_SERVICE) as BatteryManager
        return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    }

    override fun onBind(intent: Intent?) = null
    override fun onDestroy() { super.onDestroy(); instance = null; scope.cancel() }
}
```

### 4.7 `MapFragment.kt` — 네이버지도 polyline 렌더링 테스트

```kotlin
// apps/poc-walk/android/app/src/main/java/app/waggle/pocwalk/map/MapFragment.kt
package app.waggle.pocwalk.map

import android.location.Location
import android.os.Bundle
import android.util.Log
import android.view.*
import androidx.fragment.app.Fragment
import com.naver.maps.geometry.LatLng
import com.naver.maps.map.*
import com.naver.maps.map.overlay.PolylineOverlay

class MapFragment : Fragment(), OnMapReadyCallback {

    private var naverMap: NaverMap? = null
    private var polyline: PolylineOverlay? = null
    private val coords = mutableListOf<LatLng>()

    // PoC 성능 측정
    private var updateCount = 0
    private var totalUpdateMs = 0L

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val mapView = MapView(requireContext())
        mapView.onCreate(savedInstanceState)
        mapView.getMapAsync(this)
        return mapView
    }

    override fun onMapReady(map: NaverMap) {
        naverMap = map
        map.locationTrackingMode = LocationTrackingMode.Follow
        map.uiSettings.isCompassEnabled = true
        map.uiSettings.isZoomControlEnabled = true
        Log.d("PocWalk", "Naver Map ready")
    }

    fun addPoint(location: Location) {
        val latLng = LatLng(location.latitude, location.longitude)
        coords.add(latLng)

        val start = System.currentTimeMillis()
        updatePolyline()
        val elapsed = System.currentTimeMillis() - start

        updateCount++
        totalUpdateMs += elapsed

        if (updateCount % 100 == 0) {
            val avg = totalUpdateMs.toDouble() / updateCount
            Log.d("PocWalk", "Points: ${coords.size}, Avg: ${"%.2f".format(avg)}ms/update")
        }
    }

    private fun updatePolyline() {
        val map = naverMap ?: return
        if (coords.size < 2) return

        polyline?.map = null
        polyline = PolylineOverlay().apply {
            this.coords = this@MapFragment.coords
            color = 0xFF3FBB80.toInt()   // walk green
            width = 8
            this.map = map
        }
    }

    /** 5,000포인트 스트레스 테스트 */
    fun runPolylineStressTest() {
        Log.d("PocWalk", "Starting 5,000 point stress test...")
        coords.clear()

        var lat = 37.5665
        var lng = 126.9780

        val total = System.currentTimeMillis()
        for (i in 0 until 5000) {
            lat += (-0.0002..0.0002).random()
            lng += (-0.0002..0.0002).random()
            coords.add(LatLng(lat, lng))

            if (i % 100 == 0) {
                val t = System.currentTimeMillis()
                updatePolyline()
                Log.d("PocWalk", "${i+1}pts: ${System.currentTimeMillis() - t}ms")
            }
        }

        val finalRender = System.currentTimeMillis()
        updatePolyline()
        val finalMs = System.currentTimeMillis() - finalRender
        val totalMs = System.currentTimeMillis() - total

        Log.d("PocWalk", """
            Stress Test Result:
            - Total: ${totalMs}ms
            - Final 5k render: ${finalMs}ms
            - Target: <16ms (60fps)
            - Result: ${if (finalMs < 16) "✅ PASS" else "❌ FAIL"}
        """.trimIndent())
    }

    private fun ClosedRange<Double>.random() = start + (endInclusive - start) * Math.random()
}
```

### 4.8 `MainActivity.kt` — PoC 테스트 UI

```kotlin
// apps/poc-walk/android/app/src/main/java/app/waggle/pocwalk/MainActivity.kt
package app.waggle.pocwalk

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import app.waggle.pocwalk.map.MapFragment
import app.waggle.pocwalk.walk.WalkTrackingService

class MainActivity : AppCompatActivity() {

    private lateinit var startBtn: Button
    private lateinit var stopBtn: Button
    private lateinit var stressBtn: Button
    private lateinit var statsText: TextView
    private lateinit var mapFragment: MapFragment

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        startBtn  = findViewById(R.id.btn_start)
        stopBtn   = findViewById(R.id.btn_stop)
        stressBtn = findViewById(R.id.btn_stress)
        statsText = findViewById(R.id.tv_stats)

        mapFragment = MapFragment()
        supportFragmentManager.beginTransaction()
            .replace(R.id.map_container, mapFragment)
            .commit()

        startBtn.setOnClickListener { requestPermissionsAndStart() }
        stopBtn.setOnClickListener  { stopWalk() }
        stressBtn.setOnClickListener { mapFragment.runPolylineStressTest() }

        stopBtn.isEnabled = false
    }

    private fun requestPermissionsAndStart() {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val notGranted = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (notGranted.isEmpty()) startWalk()
        else ActivityCompat.requestPermissions(this, notGranted.toTypedArray(), 100)
    }

    private fun startWalk() {
        val intent = Intent(this, WalkTrackingService::class.java)
        startForegroundService(intent)

        // Service 시작 후 콜백 등록
        android.os.Handler(mainLooper).postDelayed({
            val service = WalkTrackingService.instance ?: return@postDelayed
            service.start()
            service.onStatsUpdate = { stats ->
                runOnUiThread {
                    statsText.text = """
                        거리: ${"%.0f".format(stats.distanceMeters)}m | ${stats.durationSeconds / 60}분 ${stats.durationSeconds % 60}초
                        속도: ${"%.1f".format(stats.speedMps * 3.6)}km/h | 배터리: ${stats.batteryPct}%
                        포인트: 원시 ${stats.rawPointCount} → 필터 ${stats.filteredPointCount}
                    """.trimIndent()
                }
            }
            service.onLocationUpdate = { location ->
                runOnUiThread { mapFragment.addPoint(location) }
            }
        }, 300)

        startBtn.isEnabled = false
        stopBtn.isEnabled = true
    }

    private fun stopWalk() {
        val summary = WalkTrackingService.instance?.stop() ?: return
        startBtn.isEnabled = true
        stopBtn.isEnabled = false
        Toast.makeText(this, """
            거리: ${"%.1f".format(summary.distanceMeters / 1000)}km
            배터리 소모: ${summary.batteryBefore - summary.batteryAfter}%
            포인트 압축: ${summary.rawPointCount} → ${summary.dpPointCount}
        """.trimIndent(), Toast.LENGTH_LONG).show()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 100 && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) startWalk()
    }
}
```

---

## 5. PoC 실행 절차

### 5.1 iOS 실행

```bash
# 1. Podfile 의존성 설치
cd apps/poc-walk/ios
pod install

# 2. Xcode에서 열기
open PocWalk.xcworkspace

# 3. 실기기 연결 후 빌드 (시뮬레이터에서 GPS 테스트 불가)
# Xcode: Product → Run (실기기 타겟)
```

### 5.2 Android 실행

```bash
# 1. local.properties에 Client ID 설정
echo "NAVER_MAP_CLIENT_ID=YOUR_ID" >> apps/poc-walk/android/local.properties

# 2. Android Studio에서 열기
# File → Open → apps/poc-walk/android/

# 3. 실기기 연결 후 실행 (Run 'app')
# 에뮬레이터 GPS는 수동 설정 필요 → 실기기 권장
```

---

## 6. PoC 테스트 시나리오

### 시나리오 1: 기본 GPS 추적 (5분)

1. 앱 실행 → "▶ 시작" 버튼
2. 실외에서 걷기 (GPS 수신 가능 환경)
3. 지도에 polyline 실시간 표시 확인
4. 통계 레이블에서 거리/속도 3초 업데이트 확인
5. "■ 종료" → 요약 팝업 확인

**측정값 기록:**
- 걸은 실제 거리 (구글 지도로 동선 측정)
- 앱 측정 거리
- 오차율 = |실제 - 앱| / 실제 × 100%

### 시나리오 2: 백그라운드 30분 유지 테스트

1. 앱 실행 → "▶ 시작"
2. **화면 잠금 (Sleep 버튼)** → 30분 대기
3. 30분 후 화면 켜기 → 앱 확인
4. 포인트 수 및 거리가 연속적으로 기록됐는지 확인

**iOS 판정:**
- ✅ PASS: Xcode Console에서 `[PoC] Walk started` 이후 30분간 `didUpdateLocations` 로그 연속
- ❌ FAIL: 화면 잠금 후 로그 중단

**Android 판정:**
- ✅ PASS: 상태바에 "🐾 산책 중" 알림 30분 유지
- ❌ FAIL: 알림 사라짐 or 거리 값 동결

### 시나리오 3: Android 앱 Kill 후 복원

1. 앱 실행 → "▶ 시작"
2. 3분간 이동
3. Android **Recent Apps** → 앱 스와이프 종료
4. 앱 재진입 → 세션 복원 여부 확인

**판정:**
- ✅ PASS: 재진입 시 기존 거리 값 유지 (`WalkTrackingService.instance != null`)
- ❌ FAIL: 재진입 시 세션 초기화

### 시나리오 4: 5,000포인트 polyline 성능 테스트

1. 앱 실행 → "⚡ 5K 테스트" 버튼
2. Logcat/Console에서 렌더 시간 확인

**판정:**
- ✅ PASS: 5,000포인트 최종 렌더 < 16.7ms (60fps 기준)
- ⚠️ 주의: 16.7~50ms → 허용 가능하나 모니터링 필요
- ❌ FAIL: > 50ms → 별도 레이어 분리 필요

### 시나리오 5: 배터리 소모

1. 배터리 100% 충전 후 케이블 분리
2. 앱 실행 → "▶ 시작" → 30분 이동
3. 종료 후 배터리 퍼센트 확인

**판정:**
- ✅ PASS: 30분에 6% 이하 소모
- ❌ FAIL: 6% 초과

---

## 7. PoC 결과 보고 양식

아래 표를 채워서 `documents/개발내역_PoC_네이버지도_결과.md`로 저장.

```markdown
## PoC 결과 (날짜: 2026-XX-XX)

### iOS
| 항목 | 측정값 | 기준 | 판정 |
|---|---|---|---|
| 지도 초기화 시간 | Xms | - | - |
| 1,000pt polyline render | Xms | <16ms | ✅/❌ |
| 5,000pt polyline render | Xms | <16ms | ✅/❌ |
| 30분 백그라운드 유지 | 유실 포인트: X | 0 | ✅/❌ |
| 거리 오차 | X% | <10% | ✅/❌ |
| 배터리 소모 (30분) | X% | <6% | ✅/❌ |
| 테스트 기기 | iPhone XX / iOS XX.X | - | - |

### Android
| 항목 | 측정값 | 기준 | 판정 |
|---|---|---|---|
| 1,000pt polyline render | Xms | <16ms | ✅/❌ |
| 5,000pt polyline render | Xms | <16ms | ✅/❌ |
| 30분 포그라운드 서비스 유지 | X | 중단 없음 | ✅/❌ |
| 앱 kill 후 세션 복원 | X | 복원 가능 | ✅/❌ |
| 거리 오차 | X% | <10% | ✅/❌ |
| 배터리 소모 (30분) | X% | <6% | ✅/❌ |
| 테스트 기기 | Galaxy XX / Android XX | - | - |

### 종합 판정
- [ ] ✅ PASS → `packages/native-walk` 구현 시작
- [ ] ⚠️ 조건부 통과 → 명시된 항목 개선 후 진행
- [ ] ❌ FAIL → 유료 SDK fallback 검토 (`react-native-background-geolocation`)

### 발견된 이슈
(이슈 목록 기록)

### 다음 액션
(이슈 기반 다음 액션 기록)
```

---

## 8. PoC 실패 시 대안 (Fallback Plan)

| 실패 항목 | 대안 |
|---|---|
| 네이버지도 SDK 렌더 성능 부족 | Google Maps SDK로 교체 (네이버 서비스 제공 미지원 지역만 영향) |
| iOS 백그라운드 유지 불안정 | `react-native-background-geolocation` (transistorsoft) 유료 SDK 채택, 비용: $399 |
| Android ForegroundService Kill | WorkManager + 20초 주기 위치 폴링 (배터리 비효율 but 안정적) |
| Kalman 필터 오차 과다 | Q/R 파라미터 튜닝 또는 Open Street Map OSRM 경로 스냅 API 적용 |

---

## 9. 검증 완료 후 다음 단계

PoC 통과 시 즉시 아래 작업 진행:

1. `packages/native-walk/` 디렉터리 생성 및 `package.json` 초기화
2. PoC의 `WalkTrackingManager.swift`, `WalkTrackingService.kt` → `packages/native-walk/ios|android/` 로 이동
3. `packages/native-walk/src/NativeWalkTracker.ts` Codegen 스펙 작성
4. `pnpm --filter mobile-app codegen` 으로 네이티브 인터페이스 자동 생성
5. `apps/mobile-app/ios/Podfile` 에 `waggle-native-walk` pod 추가
6. `apps/mobile-app/android/settings.gradle` 에 `native-walk` 모듈 autolink 등록
7. `src/features/walk/hooks/useWalkTracker.ts` TurboModule 훅 구현
8. `src/features/walk/screens/WalkInProgressScreen.tsx` 에 `<NativeWalkMapView>` 임베드
