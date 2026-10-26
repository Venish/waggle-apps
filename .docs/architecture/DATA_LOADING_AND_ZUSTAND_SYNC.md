# Zustand 상태 관리 및 데이터 라이프사이클 표준 가이드

> **문서 상태:** 활성 (Active SSOT)  
> **적용 범위:** 와글(Waggle) `apps/web`, `apps/admin` 전역 상태(`01_store`) 및 커스텀 훅(`02_hooks`)

---

## 1. 핵심 설계 목적 (2대 원칙)

1. **DB/서버 부하 방지용 인메모리 캐시 (`isLoaded` 플래그)**  
   페이지 진입 시 서버에서 데이터를 최초 1회만 조회해 Zustand 스토어에 담아두고(`isLoaded: true`), 이후 탭 전환이나 모달 닫힘 후 홈으로 돌아와도 서버를 재조회하지 않고 스토어 값을 0ms로 즉시 렌더링합니다.
2. **0ms 낙관적 업데이트 (Optimistic UI)**  
   사용자 액션(포인트 적립, 미션 체크, 찜하기, 산책 상태 변경 등) 발생 시 Zustand 상태를 먼저 변경하여 UI를 0ms로 즉각 갱신하고, 백그라운드에서 Server Action(`03_actions`)을 비동기 처리합니다. 실패 시 이전 상태로 롤백하고 전역 `useAlert`로 안내합니다.

---

## 2. 데이터 로딩 라이프사이클 패턴

### [A] 서버 컴포넌트(RSC) 레벨 (SSR 최초 1회 페칭)
- **위치:** `apps/web/src/app/app/page.tsx` (또는 각 엔트리 페이지)
- `getCurrentUser()`: 세션 쿠키 기반 로그인 사용자 정보 조회
- 공용 마스터 데이터(`*MasterService.ts`): 교육 카탈로그, 미션 마스터 목록 등 불변 데이터 SSR 주입

### [B] 클라이언트 Zustand 레벨 (`isLoaded: false` 가드)
최초 마운트 시에만 Server Action을 1회 호출하여 스토어에 적재하고 `isLoaded = true`로 변경합니다.

```typescript
// 01_store/useWalkStore.ts 예시
interface WalkState {
  records: WalkRecord[];
  isLoaded: boolean;
  setRecords: (data: WalkRecord[]) => void;
  addOptimisticWalk: (record: WalkRecord) => void;
}
```

---

## 3. 필수 전역 UI 스토어 규격

| 스토어 파일 | 역할 | 주요 액션 |
|---|---|---|
| `01_store/useAlert.ts` | 브라우저 기본 `window.alert()`를 대체하는 단일 인스턴스 전역 알림/확인 모달 | `showAlert`, `closeAlert` |
| `01_store/useModalStore.ts` | `GlobalOverlayProvider`와 연동되는 0ms 네이티브 슬라이드/바텀시트 스택 관리 | `openModal`, `closeModal`, `clearModals` |
| `01_store/useThemeStore.ts` | 라이트/다크 모드 및 브랜드 테마 상태 제어 | `setThemeMode`, `toggleDark` |
