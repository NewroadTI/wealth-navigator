import React from 'react';

interface DevelopmentBannerProps {
  feature: string;
  className?: string;
}

export const DevelopmentBanner: React.FC<DevelopmentBannerProps> = ({ feature, className = '' }) => (
  <div className={`bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 flex items-center gap-2 ${className}`}>
    <span className="text-amber-500 text-lg">🚧</span>
    <p className="text-amber-500 text-sm font-medium">
      {feature} — En desarrollo. Los datos mostrados son ilustrativos.
    </p>
  </div>
);
