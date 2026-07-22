import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from './components/Layout';
import { FeatureGate } from './components/FeatureGate';

// Lazy load pages for performance
const LandingPage   = lazy(() => import('./pages/LandingPage'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const GraphExplorer = lazy(() => import('./pages/GraphExplorer'));
const SemanticSearch= lazy(() => import('./pages/SemanticSearch'));
const ImpactAnalysis= lazy(() => import('./pages/ImpactAnalysis'));
const AIOnboarding  = lazy(() => import('./pages/AIOnboarding'));
const CommitHistory = lazy(() => import('./pages/CommitHistory'));

// ── Page Loading Fallback ─────────────────────────────────────────────────
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center h-full min-h-[400px] gap-4">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      className="w-8 h-8 rounded-full border-2 border-transparent border-t-indigo-500 border-r-violet-500"
    />
    <div className="text-slate-500 text-sm">Loading module...</div>
  </div>
);

// ── Shared Page Transition Wrapper ────────────────────────────────────────
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    className="h-full w-full"
  >
    {children}
  </motion.div>
);

// ── Animated Routes Container ─────────────────────────────────────────────
const AnimatedRoutes: React.FC = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Landing page - no layout shell */}
        <Route path="/" element={<LandingPage />} />

        {/* App pages - with layout */}
        <Route path="/dashboard" element={
          <Layout>
            <Suspense fallback={<PageLoader />}>
              <PageTransition>
                <Dashboard />
              </PageTransition>
            </Suspense>
          </Layout>
        } />
        <Route path="/graph" element={
          <Layout>
            <Suspense fallback={<PageLoader />}>
              <PageTransition>
                <GraphExplorer />
              </PageTransition>
            </Suspense>
          </Layout>
        } />
        <Route path="/search" element={
          <Layout>
            <Suspense fallback={<PageLoader />}>
              <PageTransition>
                <FeatureGate featureKey="semanticSearch" featureName="Semantic Search">
                  <SemanticSearch />
                </FeatureGate>
              </PageTransition>
            </Suspense>
          </Layout>
        } />
        <Route path="/impact" element={
          <Layout>
            <Suspense fallback={<PageLoader />}>
              <PageTransition>
                <FeatureGate featureKey="impactAnalysis" featureName="Impact Analysis">
                  <ImpactAnalysis />
                </FeatureGate>
              </PageTransition>
            </Suspense>
          </Layout>
        } />
        <Route path="/onboard" element={
          <Layout>
            <Suspense fallback={<PageLoader />}>
              <PageTransition>
                <FeatureGate featureKey="aiOnboarding" featureName="AI Onboarding">
                  <AIOnboarding />
                </FeatureGate>
              </PageTransition>
            </Suspense>
          </Layout>
        } />
        <Route path="/commits" element={
          <Layout>
            <Suspense fallback={<PageLoader />}>
              <PageTransition>
                <FeatureGate featureKey="commitHistory" featureName="Commit History">
                  <CommitHistory />
                </FeatureGate>
              </PageTransition>
            </Suspense>
          </Layout>
        } />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

// ── App Entry Point ───────────────────────────────────────────────────────
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="bg-[#04050A] min-h-screen flex items-center justify-center"><PageLoader /></div>}>
        <AnimatedRoutes />
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
