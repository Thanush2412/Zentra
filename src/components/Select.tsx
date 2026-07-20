import React from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[] | string[];
  error?: string;
}

// Matches the project select style: bg-gray-55 border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-600
export const Select: React.FC<SelectProps> = ({
  label,
  options,
  error,
  className = "",
  id,
  ...rest
}) => {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
  const normalizedOptions: SelectOption[] = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={selectId}
          className="text-[10px] font-black text-gray-450 uppercase tracking-wider block"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        {...rest}
        className={`w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 text-sm
          font-bold text-gray-800 cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-[#D528A2]/15 focus:border-[#D528A2] focus:scale-[1.01] focus:shadow-md
          transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:focus:scale-100
          ${error ? "border-rose-400 focus:ring-rose-200" : ""} ${className}`}
      >
        {normalizedOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-[10px] text-rose-500 font-semibold">{error}</p>
      )}
    </div>
  );
};
