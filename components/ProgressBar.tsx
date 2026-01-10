import React from 'react';

interface ProgressBarProps {
    percentage: number;
    colorClass?: string;
    className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ percentage, colorClass = "bg-brand-600", className }) => {
    // Determine the color variant classes for the progress value.
    // We explicitly list these so Tailwind JIT can detect and generate them.
    let variantClass = '';

    // Normalize input to handle potential extra spaces
    const cleanColor = colorClass.trim();

    if (cleanColor.includes('bg-brand-600')) {
        variantClass = '[&::-webkit-progress-value]:bg-brand-600 [&::-moz-progress-bar]:bg-brand-600';
    } else if (cleanColor.includes('bg-red-500')) {
        variantClass = '[&::-webkit-progress-value]:bg-red-500 [&::-moz-progress-bar]:bg-red-500';
    } else if (cleanColor.includes('bg-green-500')) {
        variantClass = '[&::-webkit-progress-value]:bg-green-500 [&::-moz-progress-bar]:bg-green-500';
    } else if (cleanColor.includes('bg-yellow-400')) {
        variantClass = '[&::-webkit-progress-value]:bg-yellow-400 [&::-moz-progress-bar]:bg-yellow-400';
    } else {
        // Default / Fallback
        variantClass = '[&::-webkit-progress-value]:bg-brand-600 [&::-moz-progress-bar]:bg-brand-600';
    }

    // Clamp value between 0 and 100 for proper rendering
    const validValue = Math.min(100, Math.max(0, percentage));

    return (
        <progress
            value={validValue}
            max={100}
            className={`w-full h-full block appearance-none overflow-hidden rounded-full bg-transparent [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:transition-all [&::-webkit-progress-value]:duration-500 [&::-moz-progress-bar]:rounded-full ${variantClass} ${className || ''}`}
        />
    );
};
