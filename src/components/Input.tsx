import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

// Matches the project input style: bg-gray-55 border border-gray-200 rounded-xl focus:ring-1 focus:ring-indigo-600
export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = "",
  id,
  ...rest
}) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[10px] font-black text-gray-450 uppercase tracking-wider block"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...rest}
        className={`w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 text-sm
          font-semibold text-gray-800 placeholder-gray-350
          focus:outline-none focus:ring-2 focus:ring-[#D528A2]/15 focus:border-[#D528A2] focus:scale-[1.01] focus:shadow-md
          transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:focus:scale-100
          ${error ? "border-rose-400 focus:ring-rose-200" : ""} ${className}`}
      />
      {error && (
        <p className="text-[10px] text-rose-500 font-semibold">{error}</p>
      )}
    </div>
  );
};
