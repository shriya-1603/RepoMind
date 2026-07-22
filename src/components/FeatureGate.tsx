import React from 'react';
import { enabledFeatures } from '../config/features';
import { ComingSoon } from './ComingSoon';

interface FeatureGateProps {
  featureKey: keyof typeof enabledFeatures;
  featureName: string;
  children: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ featureKey, featureName, children }) => {
  const isEnabled = enabledFeatures[featureKey];
  
  if (!isEnabled) {
    return <ComingSoon featureName={featureName} />;
  }
  
  return <>{children}</>;
};
