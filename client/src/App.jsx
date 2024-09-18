import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import "./App.css";
import LobbyScreen from "./screens/Lobby";
import RoomPage from "./screens/Room";
import StatsDisplay from "./screens/StatsDisplay";

function App() {
  const [showStats, setShowStats] = useState(false);

  const toggleStats = () => {
    setShowStats(!showStats);
  };

  return (
    <div className="App">
      {showStats && <StatsDisplay />}
      <Routes>
        <Route path="/" element={<LobbyScreen toggleStats={toggleStats} />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Routes>
    </div>
  );
}

export default App;