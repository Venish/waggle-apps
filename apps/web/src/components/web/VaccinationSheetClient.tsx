"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSubmitLock } from "@/02_hooks/useSubmitLock";
import {
  createVaccinationAction,
  deleteVaccinationAction,
  updateVaccinationAction,
} from "@/03_actions/web/dogDailyActions";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import {
  AppButton,
  AppChip,
  AppDatePicker,
  AppFieldGroup,
  AppInput,
  AppSelectPicker,
  AppTextarea,
} from "@/components/web/ui";

export interface VaccinationSheetRecord {
  id: number;
  dogId: number;
  vaccineId: number;
  vaccineName: string;
  administeredAt: string; // YYYY-MM-DD
  nextDueAt: string | null;
  hospital: string | null;
  memo: string | null;
}

export function VaccinationSheetClient({
  dogId,
  dogs,
  defaultDate,
  vaccineOptions,
  initialRecord,
  onSaved,
}: {
  dogId: number;
  dogs: Array<{ id: number; name: string }>;
  defaultDate: string;
  vaccineOptions: Array<{ id: number; name: string }>;
  initialRecord?: VaccinationSheetRecord | null;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const isEdit = Boolean(initialRecord);

  const [vaccineDogIds, setVaccineDogIds] = useState<number[]>([dogId]);
  const [vaccineId, setVaccineId] = useState(
    initialRecord
      ? String(initialRecord.vaccineId)
      : vaccineOptions[0]
        ? String(vaccineOptions[0].id)
        : "",
  );
  const [administeredAt, setAdministeredAt] = useState(
    initialRecord?.administeredAt ?? defaultDate,
  );
  const [nextDueAt, setNextDueAt] = useState(initialRecord?.nextDueAt ?? "");
  const [hospital, setHospital] = useState(initialRecord?.hospital ?? "");
  const [memo, setMemo] = useState(initialRecord?.memo ?? "");
  const { pending, run } = useSubmitLock();

  const vaccineSelectOptions = useMemo(
    () => vaccineOptions.map((v) => ({ value: String(v.id), label: v.name })),
    [vaccineOptions],
  );

  const allDogsSelected = dogs.length > 0 && vaccineDogIds.length === dogs.length;

  const toggleVaccineDog = (id: number) => {
    setVaccineDogIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!vaccineId) {
      openAlert({ title: "백신 종류를 선택해 주세요" });
      return;
    }
    if (!administeredAt) {
      openAlert({ title: "접종일을 선택해 주세요" });
      return;
    }
    if (nextDueAt && nextDueAt < administeredAt) {
      openAlert({
        title: "다음 접종 예정일을 확인해 주세요",
        description: "다음 접종 예정일은 접종일 이후로 선택해 주세요.",
        tone: "destructive",
      });
      return;
    }
    if (!isEdit && vaccineDogIds.length === 0) {
      openAlert({ title: "접종 대상 반려견을 최소 1마리 이상 선택해 주세요" });
      return;
    }

    void run(async () => {
      if (initialRecord) {
        const res = await updateVaccinationAction({
          id: initialRecord.id,
          vaccineId: Number(vaccineId),
          administeredAt,
          nextDueAt: nextDueAt || undefined,
          hospital: hospital || undefined,
          memo: memo || undefined,
        });
        if (!res.ok) {
          openAlert({ title: "수정 실패", description: res.error.message, tone: "destructive" });
          return;
        }
        onSaved?.();
        router.refresh();
        openAlert({ title: "예방접종 기록이 수정되었습니다" });
      } else {
        const res = await createVaccinationAction({
          dogIds: vaccineDogIds,
          vaccineId: Number(vaccineId),
          administeredAt,
          nextDueAt: nextDueAt || undefined,
          hospital: hospital || undefined,
          memo: memo || undefined,
        });
        if (!res.ok) {
          openAlert({ title: "접종 기록 실패", description: res.error.message, tone: "destructive" });
          return;
        }
        onSaved?.();
        router.refresh();
        openAlert({
          title:
            res.data.count > 1
              ? `${res.data.count}마리 예방접종 기록이 일괄 추가되었습니다`
              : "예방접종 기록이 추가되었습니다",
        });
      }
    });
  };

  const handleDelete = () => {
    if (!initialRecord || pending) return;
    openAlert({
      title: "예방접종 기록을 삭제할까요?",
      description: `${initialRecord.vaccineName} (${initialRecord.administeredAt}) 기록이 삭제됩니다.`,
      tone: "destructive",
      confirmLabel: "삭제",
      cancelLabel: "취소",
      onConfirm: async () => {
        await run(async () => {
          const res = await deleteVaccinationAction(initialRecord.id);
          if (!res.ok) {
            openAlert({
              title: "삭제 실패",
              description: res.error.message,
              tone: "destructive",
            });
            return;
          }
          onSaved?.();
          router.refresh();
          openAlert({ title: "예방접종 기록이 삭제되었습니다" });
        });
      },
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5">
      {!isEdit && dogs.length > 1 && (
        <AppFieldGroup
          label="접종 대상 반려견"
          labelMeta={
            <button
              type="button"
              onClick={() =>
                setVaccineDogIds(allDogsSelected ? [dogId] : dogs.map((d) => d.id))
              }
              className="text-xs font-semibold text-brand-strong"
            >
              {allDogsSelected ? "선택 해제" : "전체 선택"}
            </button>
          }
          description="여러 마리를 동시에 선택해 일괄 등록할 수 있습니다."
        >
          <div className="flex flex-wrap gap-1.5">
            {dogs.map((d) => (
              <AppChip
                key={d.id}
                selected={vaccineDogIds.includes(d.id)}
                onClick={() => toggleVaccineDog(d.id)}
              >
                {d.name}
              </AppChip>
            ))}
          </div>
        </AppFieldGroup>
      )}

      <AppSelectPicker
        label="백신 종류"
        modalTitle="백신 선택"
        value={vaccineId}
        onChange={setVaccineId}
        options={vaccineSelectOptions}
        searchable={vaccineSelectOptions.length > 6}
        searchPlaceholder="백신명 검색"
      />

      <div className="grid grid-cols-2 gap-4">
        <AppDatePicker
          label="접종일"
          modalTitle="접종일 선택"
          value={administeredAt}
          onChange={setAdministeredAt}
        />
        <AppDatePicker
          label="다음 접종 예정일"
          modalTitle="다음 접종 예정일"
          value={nextDueAt}
          onChange={setNextDueAt}
        />
      </div>

      <AppInput
        label="동물병원명"
        type="text"
        value={hospital}
        onChange={(e) => setHospital(e.target.value)}
        clearable
        onClear={() => setHospital("")}
        placeholder="예: 와글동물병원"
      />

      <AppTextarea
        label="메모"
        rows={3}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="접종 후 컨디션, 주의사항 등을 남겨보세요."
      />

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-border-subtle bg-surface/95 px-4 pt-3 backdrop-blur-md pb-safe-bottom">
        {isEdit ? (
          <div className="grid grid-cols-[1fr_2fr] gap-2.5">
            <AppButton
              type="button"
              variant="danger"
              size="lg"
              fullWidth
              disabled={pending}
              onClick={handleDelete}
            >
              삭제
            </AppButton>
            <AppButton type="submit" variant="primary" size="lg" fullWidth loading={pending}>
              예방접종 수정
            </AppButton>
          </div>
        ) : (
          <AppButton type="submit" variant="primary" size="lg" fullWidth loading={pending}>
            {vaccineDogIds.length > 1
              ? `${vaccineDogIds.length}마리 예방접종 일괄 추가`
              : "예방접종 기록 추가"}
          </AppButton>
        )}
      </div>
    </form>
  );
}
