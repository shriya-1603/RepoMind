import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from './components/Layout';

// Lazy load pages for performance
const LandingPage   = lazy(() => import('./pages/LandingPage'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const GraphExplorer = lazy(() => import('./pages/GraphExplorer'));
const SemanticSearch= lazy(() => import('./pages/SemanticSearch'));
const ImpactAnalysis= lazy(() => import('./pages/ImpactAnalysis'));
const AIOnboarding  = lazy(() => import('./pages/AIOnboarding'));

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

// ── App ───────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="bg-void-900 min-h-screen flex items-center justify-center"><PageLoader /></div>}>
        <Routes>
          {/* Landing page - no layout shell */}
          <Route path="/" element={<LandingPage />} />

          {/* App pages - with layout */}
          <Route path="/dashboard" element={
            <Layout>
              <Suspense fallback={<PageLoader />}>
                <Dashboard />
              </Suspense>
            </Layout>
          } />
          <Route path="/graph" element={
            <Layout>
              <Suspense fallback={<PageLoader />}>
                <GraphExplorer />
              </Suspense>
            </Layout>
          } />
          <Route path="/search" element={
            <Layout>
              <Suspense fallback={<PageLoader />}>
                <SemanticSearch />
              </Suspense>
            </Layout>
          } />
          <Route path="/impact" element={
            <Layout>
              <Suspense fallback={<PageLoader />}>
                <ImpactAnalysis />
              </Suspense>
            </Layout>
          } />
          <Route path="/onboard" element={
            <Layout>
              <Suspense fallback={<PageLoader />}>
                <AIOnboarding />
              </Suspense>
            </Layout>
          } />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
