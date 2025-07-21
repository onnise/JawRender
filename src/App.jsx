import React from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';

// Import your components
import PlayerViewer from './components/PlayerViewer';
// Converter is no longer imported because it's not used.
import NavBar from './components/NavBar';

/**
 * The AppLayout ensures your NavBar is on every page.
 * <Outlet> is where the child route (PlayerViewer) will be rendered.
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
 * We've un-commented this and simplified the routes.
 */
const App = () => {
  return (
    // The BrowserRouter component enables routing.
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          {/* Default page is the PlayerViewer. This is now the ONLY page. */}
          <Route index element={<PlayerViewer />} />
          
          {/* The Route for the "/converter" page has been completely removed. */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;