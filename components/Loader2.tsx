import { Loader2 as LucideLoader2 } from 'lucide-react';
import React from 'react';

interface LoaderProps {
    className?: string;
    size?: number;
}

const Loader2: React.FC<LoaderProps> = ({ className, size = 24 }) => {
    return <LucideLoader2 className={`animate-spin ${className}`} size={size} />;
};

export default Loader2;
