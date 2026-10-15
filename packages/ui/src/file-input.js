"use client";

import * as React from "react";
import { cn } from "./utils.js";

const FileInput = React.forwardRef(
  (
    {
      className,
      inputClassName,
      chooseLabel = "Choose file",
      emptyLabel = "No file selected",
      onChange,
      disabled,
      form,
      ...props
    },
    ref,
  ) => {
    const inputRef = React.useRef(null);
    const [fileNames, setFileNames] = React.useState([]);
    React.useImperativeHandle(ref, () => inputRef.current);

    React.useEffect(() => {
      const ownerForm = inputRef.current?.form;
      if (!ownerForm) return;
      let active = true;
      const onReset = (event) => {
        // A reset can be cancelled by the form; wait until its handlers finish.
        queueMicrotask(() => {
          if (active && !event.defaultPrevented) setFileNames([]);
        });
      };
      ownerForm.addEventListener("reset", onReset);
      return () => {
        active = false;
        ownerForm.removeEventListener("reset", onReset);
      };
    }, [form]);

    return (
      <div
        data-slot="file-input-field"
        data-disabled={disabled ? "" : undefined}
        className={cn(
          "relative flex min-h-10 w-full min-w-0 items-center gap-3 rounded-md border border-input bg-background p-1 text-sm text-foreground shadow-sm transition-shadow has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
          className,
        )}
      >
        <input
          data-slot="file-input"
          {...props}
          type="file"
          form={form}
          disabled={disabled}
          ref={inputRef}
          className={cn(
            "absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed",
            inputClassName,
          )}
          onChange={(event) => {
            setFileNames(Array.from(event.currentTarget.files ?? [], (file) => file.name));
            onChange?.(event);
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none shrink-0 rounded bg-secondary px-3 py-1.5 font-medium text-secondary-foreground"
        >
          {chooseLabel}
        </span>
        <span
          aria-hidden="true"
          data-slot="file-input-name"
          className="pointer-events-none min-w-0 truncate pr-2 text-muted-foreground"
          title={fileNames.length ? fileNames.join(", ") : undefined}
        >
          {fileNames.length ? fileNames.join(", ") : emptyLabel}
        </span>
      </div>
    );
  },
);
FileInput.displayName = "FileInput";

export { FileInput };
