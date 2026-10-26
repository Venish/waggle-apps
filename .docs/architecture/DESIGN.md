# Waggle UI/UX 엔지니어링 & 디자인 시스템 표준 (DESIGN.md)

> **문서 상태:** 활성 (Active SSOT)  
> **참고 기획서:** [`.docs/specs/design-theme-guide.md`](file:///d:/01.업무/2026/와글/05.HTML/waggle-apps/.docs/specs/design-theme-guide.md)

---

## 1. 코어 레이아웃 & 모바일 뷰포트 규격

- **430px 앱 뷰포트 컨테이너**: `max-w-[430px] w-full mx-auto min-h-[100dvh] bg-theme-app relative overflow-x-hidden shadow-2xl`
- **Concentric Border Radius (동심원 곡률)**: `Inner Radius = Outer Radius - Padding` 비례 유지
  - 대형 카드/모달: `rounded-3xl` (24px)
  - 인풋/중형 버튼/서브 카드: `rounded-2xl` (16px)
  - 소형 버튼/아이콘 박스: `rounded-xl` (12px)
- **Tabular Numbers**: 포인트, 산책 거리/시간, 타이머 등 동적 숫자에는 반드시 `tabular-nums`를 적용하여 레이아웃 흔들림(Layout Shift)을 방지합니다.

---

## 2. 엄격한 UI 가드레일 (Strict UI Guardrails)

1. **비흰색 박스 무경계 원칙 (Non-White Container Borderless Principle)**
   - 배경색이 순수 흰색(`bg-white`)이 아닌 컨테이너(`bg-gray-50`, 파스텔 틴트 박스 등)에는 테두리(`border`)를 절대 적용하지 않고 100% 무경계(Borderless)로 제작합니다.
   - 테두리는 순수 `bg-white` 카드에만 섬세한 1px 헤어라인(`border border-gray-100` / `border-theme-subtle`)으로 허용합니다.
2. **정적 Tailwind 클래스 작성**
   - `grid-cols-${n}` 같은 동적 문자열 조합을 금지하고 정적 클래스 매핑 객체를 사용합니다.
3. **마이크로 인터랙션 & 터치 타겟**
   - 모든 클릭 가능한 버튼/카드에는 `active:scale-[0.96] transition-transform`을 적용하고 최소 터치 영역 `44px × 44px`(`min-h-[44px]`)를 보장합니다. (`transition-all` 남용 지양)
4. **시맨틱 토큰 및 다크모드 대응**
   - 하드코딩 색상 단독 사용을 피하고 테마 시맨틱 토큰 또는 `dark:*` 페어링을 준수합니다.
