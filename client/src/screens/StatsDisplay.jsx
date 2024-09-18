import React, { useState, useEffect } from 'react';
import { useSocket } from "../context/SocketProvider";

const StatsDisplay = () => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const socket = useSocket();

  useEffect(() => {
    const fetchStats = () => {
      socket.emit('fetch:stats');
    };

    socket.on('stats:update', (newStats) => {
      setStats(newStats);
      setError(null);
    });

    socket.on('stats:error', (errorMessage) => {
      setError(errorMessage);
    });

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Fetch stats every 30 seconds

    return () => {
      clearInterval(interval);
      socket.off('stats:update');
      socket.off('stats:error');
    };
  }, [socket]);

  if (error) return <div>Error loading stats: {error}</div>;
  if (!stats) return <div>Loading stats...</div>;

  return (
    <div className="stats-display">
      <h2>Real-time Statistics</h2>
      <ul>
        <li>Total Rooms: {stats.totalRooms}</li>
        <li>Total Users: {stats.totalUsers}</li>
        <li>Successful Calls: {stats.successfulCalls}</li>
        <li>Dropped Calls: {stats.droppedCalls}</li>
        <li>Peak Concurrent Users: {stats.peakConcurrentUsers}</li>
        <li>Most Popular Room: {stats.mostPopularRoom || 'N/A'}</li>
      </ul>
    </div>
  );
};

export default StatsDisplay;