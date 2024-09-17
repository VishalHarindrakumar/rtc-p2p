import React, { useEffect, useCallback, useState, useRef } from "react";
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
  const remoteStreamRef = useRef(new MediaStream());
  const peerConnectionRef = useRef(null);

  const createPeerConnection = useCallback(() => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:global.stun.twilio.com:3478",
          ],
        },
      ],
    });

    peerConnection.ontrack = (event) => {
      const remoteTrack = event.track;
      remoteStreamRef.current.addTrack(remoteTrack);
      setRemoteStream(new MediaStream([remoteTrack]));
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { candidate: event.candidate, to: remoteSocketId });
      }
    };

    peerConnectionRef.current = peerConnection;
  }, [remoteSocketId, socket]);

  const handleUserJoined = useCallback(({ uid, id }) => {
    console.log(`UserID ${uid} joined room`);
    setRemoteSocketId(id);
    createPeerConnection();
  }, [createPeerConnection]);

  const handleUserLeft = useCallback(() => {
    setRemoteSocketId(null);
    setRemoteStream(null);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
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

    stream.getTracks().forEach((track) => {
      peerConnectionRef.current.addTrack(track, stream);
    });

    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);
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

    stream.getTracks().forEach((track) => {
      peerConnectionRef.current.addTrack(track, stream);
    });

    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);
    socket.emit("stream:accept", { to: from, answer });
  }, [socket]);

  const handleStreamAccept = useCallback(async ({ from, answer }) => {
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    console.log("Streaming started!");
  }, []);

  const handleIceCandidate = useCallback(({ candidate }) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("user:left", handleUserLeft);
    socket.on("start:stream", startStreaming);
    socket.on("stream:init", handleStreamInit);
    socket.on("stream:accept", handleStreamAccept);
    socket.on("room:queued", handleRoomQueued);
    socket.on("ice-candidate", handleIceCandidate);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("user:left", handleUserLeft);
      socket.off("start:stream", startStreaming);
      socket.off("stream:init", handleStreamInit);
      socket.off("stream:accept", handleStreamAccept);
      socket.off("room:queued", handleRoomQueued);
      socket.off("ice-candidate", handleIceCandidate);
    };
  }, [
    socket,
    handleUserJoined,
    handleUserLeft,
    startStreaming,
    handleStreamInit,
    handleStreamAccept,
    handleRoomQueued,
    handleIceCandidate,
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