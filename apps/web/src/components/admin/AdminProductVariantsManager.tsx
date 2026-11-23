"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export interface AdminVariantDraft {
  id?: number;
  name: string;
  addPoint: number;
  stock: number;
}

interface AdminProductVariantsManagerProps {
  name: string;
  initialVariants?: AdminVariantDraft[];
}

export function AdminProductVariantsManager({
  name,
  initialVariants = [],
}: AdminProductVariantsManagerProps) {
  const [rows, setRows] = useState<AdminVariantDraft[]>(initialVariants);

  const addRow = () => {
    setRows((prev) => [...prev, { name: "", addPoint: 0, stock: 30 }]);
  };

  const updateRow = (idx: number, patch: Partial<AdminVariantDraft>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const serialized = JSON.stringify(
    rows
      .map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        name: r.name.trim(),
        addPoint: Number.isFinite(r.addPoint) ? Math.max(0, Math.floor(r.addPoint)) : 0,
        stock: Number.isFinite(r.stock) ? Math.max(0, Math.floor(r.stock)) : 0,
      }))
      .filter((r) => r.name.length > 0),
  );

  return (
    <div className="space-y-2.5">
      <input type="hidden" name={name} value={serialized} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-neutral">
            상품 옵션 ({rows.length}개)
          </p>
          <p className="text-xs text-subdued">
            옵션이 1개 이상이면 주문 시 옵션별 재고가 차감됩니다. 비워두면 단일 상품으로 판매됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex h-7 items-center gap-1 rounded-control bg-base-1 px-2.5 text-xs font-medium text-neutral atlas-border hover:bg-[var(--mix-hover-subtle)]"
        >
          <Plus className="size-3.5" />
          옵션 추가
        </button>
      </div>

      {rows.length > 0 && (
        <div className="space-y-2 rounded-control bg-base-1 p-3 atlas-border">
          <div className="hidden grid-cols-12 gap-2 text-xs text-secondary sm:grid">
            <span className="col-span-6">옵션명 *</span>
            <span className="col-span-3">추가 포인트 (+P)</span>
            <span className="col-span-2">재고</span>
            <span className="col-span-1 text-right">삭제</span>
          </div>

          {rows.map((row, idx) => (
            <div
              key={row.id ?? `new-${idx}`}
              className="grid grid-cols-12 items-center gap-2"
            >
              <input
                type="text"
                value={row.name}
                onChange={(e) => updateRow(idx, { name: e.target.value })}
                placeholder="예: 닭가슴살 100g"
                className="col-span-12 h-7 rounded-control bg-base-2 px-2.5 text-xs text-neutral atlas-border sm:col-span-6"
              />
              <input
                type="number"
                min={0}
                value={row.addPoint}
                onChange={(e) => updateRow(idx, { addPoint: Number(e.target.value || 0) })}
                placeholder="+P"
                className="col-span-5 h-7 rounded-control bg-base-2 px-2 font-mono text-xs tabular-nums text-neutral atlas-border sm:col-span-3"
              />
              <input
                type="number"
                min={0}
                value={row.stock}
                onChange={(e) => updateRow(idx, { stock: Number(e.target.value || 0) })}
                placeholder="재고"
                className="col-span-5 h-7 rounded-control bg-base-2 px-2 font-mono text-xs tabular-nums text-neutral atlas-border sm:col-span-2"
              />
              <div className="col-span-2 text-right sm:col-span-1">
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  aria-label="옵션 제거"
                  className="inline-flex size-7 items-center justify-center rounded-btn-sm text-secondary hover:bg-[var(--mix-hover-subtle)] hover:text-negative"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
