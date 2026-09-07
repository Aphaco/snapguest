import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateEvent from './pages/CreateEvent';
import EditEvent from './pages/EditEvent';
import GuestCamera from './pages/GuestCamera';
import EventGallery from './pages/EventGallery';
import LiveWall from './pages/LiveWall';
import CameraTest from './pages/CameraTest';

// Protected Route Component
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        
        {/* Guest Routes - Accessible without login */}
        <Route path="/e/:eventSlug" element={<GuestCamera />} />
        <Route path="/e/:eventSlug/gallery" element={<EventGallery />} />
        <Route path="/e/:eventSlug/live" element={<LiveWall />} />
        <Route path="/camera-test" element={<CameraTest />} />
        
        {/* Protected Admin Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create" element={<CreateEvent />} />
          <Route path="/event/:eventId/edit" element={<EditEvent />} />
        </Route>
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;