import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

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
          className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...rest}
        className={`w-full bg-white/80 dark:bg-[#181820]/80 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm
          font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500
          focus:outline-none focus:ring-2 focus:ring-[#D528A2]/20 focus:border-[#D528A2] focus:scale-[1.01] focus:shadow-md
          transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:focus:scale-100
          ${error ? "border-rose-400 focus:ring-rose-200" : ""} ${className}`}
      />
      {error && (
        <p className="text-[10px] text-rose-500 font-semibold">{error}</p>
      )}
    </div>
  );
};
