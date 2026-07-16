import React from 'react'

interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean
  variant?: 'danger' | 'default'
}

export default function ToolbarButton({ isActive, variant = 'default', className = '', ...props }: ToolbarButtonProps) {
  const baseClasses = 'px-3 py-1 rounded text-sm font-mono transition-colors'
  
  let variantClasses = ''
  if (variant === 'danger') {
    variantClasses = 'bg-white text-red-600 border border-red-300 hover:bg-red-50 cursor-pointer'
  } else {
    // Default variant
    if (props.disabled) {
      variantClasses = 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed border'
    } else {
      variantClasses = isActive
        ? 'bg-blue-600 text-white cursor-pointer border border-blue-600'
        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 cursor-pointer'
    }
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    />
  )
}
