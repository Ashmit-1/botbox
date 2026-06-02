import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import RootLayout from '../layouts/RootLayout';

// Lazy loaded pages
const ChatPage = React.lazy(() => import('../pages/ChatPage'));
const ModelHubPage = React.lazy(() => import('../pages/ModelHubPage'));
const SettingsPage = React.lazy(() => import('../pages/SettingsPage'));

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/chat" replace />,
      },
      {
        path: 'chat',
        element: (
          <React.Suspense fallback={null}>
            <ChatPage />
          </React.Suspense>
        ),
      },
      {
        path: 'models',
        element: (
          <React.Suspense fallback={null}>
            <ModelHubPage />
          </React.Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <React.Suspense fallback={null}>
            <SettingsPage />
          </React.Suspense>
        ),
      },
    ],
  },
]);

export default router;
