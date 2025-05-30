import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'; // Added 'xl'
  color?: string; // Tailwind color class e.g., 'text-sky-500'
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', color = 'text-sky-400', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-[6px]',
    xl: 'w-16 h-16 border-[8px]', // New 'xl' size
  };

  return (
    <div
      className={`animate-spin rounded-full ${sizeClasses[size]} ${color} border-solid border-t-transparent ${className}`}
      role="status"
      aria-label="Carregando..."
    ></div>
  );
};