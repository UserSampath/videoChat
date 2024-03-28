import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";

const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);

  const handleUserJoined = useCallback(async ({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
    handleCallUser(id);
  }, []);

  const handleCallUser = useCallback(
    async (id) => {
      console.log("LLLLL");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      const offer = await peer.getOffer();
      socket.emit("user:call", { to: id, offer }); //2
      setMyStream(stream);
    },
    [socket]
  );

  const handleIncommingCall = useCallback(
    //4
    async ({ from, offer }) => {
      //call karana kenage offer eka
      setRemoteSocketId(from);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      console.log(`Incoming Call`, from, offer);
      const ans = await peer.getAnswer(offer); //accept the call
      socket.emit("call:accepted", { to: from, ans }); //5
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    for (const track of myStream.getTracks()) {
      peer.peer.addTrack(track, myStream);
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    //7
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      console.log("Call Accepted! sendStreams");
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    console.log("handleNegoNeeded");
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);

      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(
    async ({ ans, from }) => {
      console.log("handleNegoNeedFinal");
      await peer.setLocalDescription(ans);
      socket.emit("start:streaming", { to: from });
    },
    [socket]
  );

  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams;
      console.log("GOT TRACKS!!");
      setRemoteStream(remoteStream[0]);
    });
  }, []);

  const handleUserDisconnected = useCallback(async (data) => {
    console.log("disconnected", data);
    if (peer.peer) {
      peer.peer.close();
      peer.peer = null;
      setRemoteStream(null);
    }
  }, []);

  const handleStartStreaming = useCallback(() => {
    console.log("handleStartStreaming");
    if (myStream) {
      sendStreams();
    }
  }, [myStream]);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);
    socket.on("user:disconnected", handleUserDisconnected);
    socket.on("start:streaming", handleStartStreaming);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
      socket.off("user:disconnected", handleUserDisconnected);
      socket.off("start:streaming", handleStartStreaming);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);

  const toggleVideo = () => {
    // Toggle the video stream
    setIsVideoOn((prevState) => !prevState);
    myStream.getVideoTracks().forEach((track) => (track.enabled = !isVideoOn));
  };

  const toggleAudio = () => {
    setIsAudioOn((prevState) => !prevState);
    myStream.getAudioTracks().forEach((track) => {
      track.enabled = !isAudioOn;
    });
  };

  return (
    <div>
      <h1>Room Page</h1>
      <h4>{remoteSocketId ? "Connected" : "No one in room"}</h4>
      {/* {myStream && <button onClick={sendStreams}>Send Stream</button>} */}
      {/* {remoteSocketId && <button onClick={handleCallUser}>CALL</button>} */}
      <button onClick={toggleVideo}>
        {isVideoOn ? "Turn Off Video" : "Turn On Video"}
      </button>
      <button onClick={toggleAudio}>
        {isAudioOn ? "Turn Off Audio" : "Turn On Audio"}
      </button>

      {/* <button>stop streaming me</button> */}
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
