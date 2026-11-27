import * as React from "react";
import { cn } from "@repo/ui";

export type AdminInputSize = "sm" | "md";

export interface AdminInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: AdminInputSize;
  invalid?: boolean;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  containerClassName?: string;
}

const SIZE_CLASSES: Record<AdminInputSize, string> = {
  sm: "h-9 px-2.5 text-xs rounded-btn-sm",
  md: "h-10 px-3 text-sm rounded-control",
};

/**
 * ERP Atlas Precision Studio v2.6.0 Input (.atlas-focus-ring · Server Component 호환)
 */
export const AdminInput = React.forwardRef<HTMLInputElement, AdminInputProps>(
  function AdminInput(
    {
      className,
      containerClassName,
      size = "md",
      invalid = false,
      leftSlot,
      rightSlot,
      type = "text",
      ...props
    },
    ref,
  ) {
    if (leftSlot || rightSlot) {
      return (
        <div
          className={cn(
            "flex w-full items-center gap-1.5 bg-base-1 text-neutral atlas-border atlas-focus-ring",
            SIZE_CLASSES[size],
            invalid && "atlas-focus-ring-invalid",
            props.disabled && "cursor-not-allowed opacity-45",
            containerClassName,
          )}
        >
          {leftSlot ? (
            <span className="inline-flex shrink-0 items-center text-subdued">{leftSlot}</span>
          ) : null}
          <input
            ref={ref}
            type={type}
            aria-invalid={invalid || undefined}
            className={cn(
              "h-full w-full min-w-0 bg-transparent text-inherit outline-none placeholder:text-subdued disabled:cursor-not-allowed",
              className,
            )}
            {...props}
          />
          {rightSlot ? (
            <span className="inline-flex shrink-0 items-center text-subdued">{rightSlot}</span>
          ) : null}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full min-w-0 bg-base-1 text-neutral atlas-border atlas-focus-ring placeholder:text-subdued disabled:cursor-not-allowed disabled:opacity-45",
          SIZE_CLASSES[size],
          invalid && "atlas-focus-ring-invalid",
          className,
        )}
        {...props}
      />
    );
  },
);

export interface AdminTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const AdminTextarea = React.forwardRef<HTMLTextAreaElement, AdminTextareaProps>(
  function AdminTextarea({ className, invalid = false, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "min-h-20 w-full resize-y rounded-control bg-base-1 px-2.5 py-2 text-sm leading-5 text-neutral atlas-border atlas-focus-ring placeholder:text-subdued disabled:cursor-not-allowed disabled:opacity-45",
          invalid && "atlas-focus-ring-invalid",
          className,
        )}
        {...props}
      />
    );
  },
);
