import type { TemplateField } from "@/lib/services";

export type AnswerMap = Record<string, unknown>;

const inputCls =
  "w-full bg-sand rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-teal min-h-[44px]";

/**
 * Renders an admin-defined standardized template. Sellers and buyers never
 * invent their own questions — the fields come straight from the category.
 */
export function ServiceTemplateForm({
  fields,
  values,
  onChange,
}: {
  fields: TemplateField[];
  values: AnswerMap;
  onChange: (key: string, value: unknown) => void;
}) {
  if (fields.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {fields.map((f) => {
        const v = values[f.field_key];
        const id = `tf-${f.id}`;
        return (
          <div key={f.id} className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-wider text-navy/50">
              {f.label}
              {f.required && <span className="text-coral"> *</span>}
              {f.sensitive && (
                <span className="ml-2 normal-case tracking-normal text-[10px] text-navy/40">
                  · private, shared only with the provider
                </span>
              )}
            </label>
            {f.help_text && <p className="text-xs text-navy/50">{f.help_text}</p>}

            {f.field_type === "textarea" ? (
              <textarea
                id={id}
                required={f.required}
                rows={3}
                value={(v as string) ?? ""}
                onChange={(e) => onChange(f.field_key, e.target.value)}
                className={inputCls}
              />
            ) : f.field_type === "boolean" ? (
              <label className="flex items-center gap-3 bg-sand rounded-xl px-4 py-3 min-h-[44px] cursor-pointer">
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(v)}
                  onChange={(e) => onChange(f.field_key, e.target.checked)}
                  className="size-5 accent-teal"
                />
                <span className="text-sm">Yes</span>
              </label>
            ) : f.field_type === "select" || f.field_type === "multiselect" ? (
              f.options.length > 0 ? (
                <select
                  id={id}
                  required={f.required}
                  multiple={f.field_type === "multiselect"}
                  value={(f.field_type === "multiselect" ? ((v as string[]) ?? []) : ((v as string) ?? "")) as never}
                  onChange={(e) =>
                    onChange(
                      f.field_key,
                      f.field_type === "multiselect"
                        ? Array.from(e.target.selectedOptions).map((o) => o.value)
                        : e.target.value,
                    )
                  }
                  className={inputCls}
                >
                  {f.field_type === "select" && <option value="">Select…</option>}
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  required={f.required}
                  value={(v as string) ?? ""}
                  onChange={(e) => onChange(f.field_key, e.target.value)}
                  className={inputCls}
                />
              )
            ) : f.field_type === "number" ? (
              <input
                id={id}
                type="number"
                inputMode="numeric"
                required={f.required}
                value={(v as string) ?? ""}
                onChange={(e) => onChange(f.field_key, e.target.value)}
                className={inputCls}
              />
            ) : f.field_type === "phone" ? (
              <input
                id={id}
                type="tel"
                inputMode="tel"
                placeholder="+1 246 …"
                required={f.required}
                value={(v as string) ?? ""}
                onChange={(e) => onChange(f.field_key, e.target.value)}
                className={inputCls}
              />
            ) : f.field_type === "date" ? (
              <input
                id={id}
                type="date"
                required={f.required}
                value={(v as string) ?? ""}
                onChange={(e) => onChange(f.field_key, e.target.value)}
                className={inputCls}
              />
            ) : f.field_type === "time" ? (
              <input
                id={id}
                type="time"
                required={f.required}
                value={(v as string) ?? ""}
                onChange={(e) => onChange(f.field_key, e.target.value)}
                className={inputCls}
              />
            ) : f.field_type === "images" ? (
              <ImageField id={id} value={(v as string[]) ?? []} onChange={(urls) => onChange(f.field_key, urls)} />
            ) : (
              <input
                id={id}
                required={f.required}
                value={(v as string) ?? ""}
                onChange={(e) => onChange(f.field_key, e.target.value)}
                className={inputCls}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ImageField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length) return;
          const { uploadImage } = await import("@/lib/uploadImage");
          const { supabase } = await import("@/integrations/supabase/client");
          const { data: auth } = await supabase.auth.getUser();
          const userId = auth.user?.id;
          if (!userId) return;
          const urls: string[] = [];
          for (const file of files.slice(0, 5)) {
            try {
              const url = await uploadImage("listings", userId, file);
              if (url) urls.push(url);
            } catch {
              /* validation errors are surfaced by uploadImage */
            }
          }
          onChange([...value, ...urls]);
        }}
        className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-4 file:py-2 file:text-white file:text-sm"
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((u) => (
            <div key={u} className="relative">
              <img src={u} alt="" className="size-16 rounded-lg object-cover ring-1 ring-hairline" />
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== u))}
                className="absolute -top-1.5 -right-1.5 size-6 rounded-full bg-navy text-white text-xs grid place-items-center"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
