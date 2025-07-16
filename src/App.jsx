import React from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';

// Import your components
import PlayerViewer from './components/PlayerViewer';
import Converter from './components/Converter';
import NavBar from './components/NavBar'; // Assuming you still have this

/**
 * The AppLayout ensures your NavBar is on every page.
 * <Outlet> is where the child route (PlayerViewer or Converter) will be rendered.
 */
const AppLayout = () => {
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavBar />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <Outlet /> 
      </main>
    </div>
  );
};

/**
 * The main App component that sets up the application's routing.
 */
const App = () => {
  return (
    // The BrowserRouter component enables routing.
    // Every hook like `useNavigate` must be used within a component rendered by this.
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          {/* Default page is the PlayerViewer */}
          <Route index element={<PlayerViewer />} />
          
          {/* Page for the "/converter" URL */}
          <Route path="converter" element={<Converter />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;