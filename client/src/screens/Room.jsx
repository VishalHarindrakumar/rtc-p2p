import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import { useNavigate } from "react-router-dom";
import peer from "../peer-service/peer";
import { useSocket } from "../context/SocketProvider";

const RoomPage = () => {
  const socket = useSocket();
  const navigate = useNavigate();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [isQueued, setIsQueued] = useState(false);

  const handleUserJoined = useCallback(({ uid, id }) => {
    console.log(`UserID ${uid} joined room`);
    setRemoteSocketId(id);
  }, []);

  const handleUserLeft = useCallback(() => {
    setRemoteSocketId(null);
    setRemoteStream(null);
    // Don't navigate to lobby, wait for potential new connection
  }, []);

  const handleRoomQueued = useCallback(() => {
    setIsQueued(true);
  }, []);

  const startStreaming = useCallback(async ({ to }) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    setMyStream(stream);
    setRemoteSocketId(to);
    setIsQueued(false);

    const offer = await peer.getOffer();
    socket.emit("stream:init", { to, offer });
  }, [socket]);

  const handleStreamInit = useCallback(async ({ from, offer }) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    setMyStream(stream);
    setRemoteSocketId(from);
    setIsQueued(false);

    const ans = await peer.getAnswer(offer);
    socket.emit("stream:accept", { to: from, ans });

    for (const track of stream.getTracks()) {
      peer.peer.addTrack(track, stream);
    }
  }, [socket]);

  const handleStreamAccept = useCallback(async ({ from, ans }) => {
    await peer.setLocalDescription(ans);
    console.log("Streaming started!");

    for (const track of myStream.getTracks()) {
      peer.peer.addTrack(track, myStream);
    }
  }, [myStream]);

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncoming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);

  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams;
      console.log("GOT TRACKS!!");
      setRemoteStream(remoteStream[0]);
    });
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("user:left", handleUserLeft);
    socket.on("start:stream", startStreaming);
    socket.on("stream:init", handleStreamInit);
    socket.on("stream:accept", handleStreamAccept);
    socket.on("room:queued", handleRoomQueued);
    socket.on("peer:nego:needed", handleNegoNeedIncoming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("user:left", handleUserLeft);
      socket.off("start:stream", startStreaming);
      socket.off("stream:init", handleStreamInit);
      socket.off("stream:accept", handleStreamAccept);
      socket.off("room:queued", handleRoomQueued);
      socket.off("peer:nego:needed", handleNegoNeedIncoming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleUserLeft,
    startStreaming,
    handleStreamInit,
    handleStreamAccept,
    handleRoomQueued,
    handleNegoNeedIncoming,
    handleNegoNeedFinal,
  ]);

  return (
    <div>
      <h1>Room Page</h1>
      {isQueued ? (
        <h4>You are in queue. Please wait...</h4>
      ) : (
        <h4>{remoteSocketId ? "Connected" : "Waiting for someone to join..."}</h4>
      )}
      {myStream && (
        <>
          <h1>My Stream</h1>
          <ReactPlayer
            playing
            muted
            height="100px"
            width="200px"
            url={myStream}
          />
        </>
      )}
      {remoteStream && (
        <>
          <h1>Remote Stream</h1>
          <ReactPlayer
            playing
            height="100px"
            width="200px"
            url={remoteStream}
          />
        </>
      )}
    </div>
  );
};

export default RoomPage;