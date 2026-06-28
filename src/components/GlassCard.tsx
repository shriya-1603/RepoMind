import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'indigo' | 'violet' | 'cyan' | 'emerald' | 'rose';
  hover?: boolean;
  glow?: boolean;
  animate?: boolean;
  delay?: number;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  variant = 'default',
  hover = false,
  glow = false,
  animate = true,
  delay = 0,
  padding = 'md',
  onClick,
}) => {
  const variantClasses = {
    default: 'glass',
    indigo:  'glass-indigo',
    violet:  'glass-violet',
    cyan:    'glass-cyan',
    emerald: 'glass-emerald',
    rose:    'glass-rose',
  };

  const glowClasses = {
    default: '',
    indigo:  'glow-indigo',
    violet:  'glow-violet',
    cyan:    'glow-cyan',
    emerald: 'glow-emerald',
    rose:    'glow-rose',
  };

  const paddingClasses = {
    none: '',
    sm:   'p-3',
    md:   'p-5',
    lg:   'p-8',
  };

  const cardClasses = clsx(
    'rounded-2xl',
    variantClasses[variant],
    glow && glowClasses[variant],
    hover && 'glass-hover cursor-pointer',
    paddingClasses[padding],
    className,
  );

  if (animate) {
    return (
      <motion.div
        className={cardClasses}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
        whileHover={hover ? { scale: 1.01 } : undefined}
        onClick={onClick}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={cardClasses} onClick={onClick}>
      {children}
    </div>
  );
};

export default GlassCard;
