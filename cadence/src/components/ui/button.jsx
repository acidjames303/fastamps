import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-blue-600 text-white hover:bg-blue-700',
  outline: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
};

const sizes = {
  default: 'h-10 px-4 py-2 text-sm',
  lg: 'h-12 px-6 text-base',
  sm: 'h-8 px-3 text-xs',
};

export function Button({ className, variant = 'default', size = 'default', ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
