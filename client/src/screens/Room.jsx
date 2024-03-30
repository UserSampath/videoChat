import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import PeerService from "../service/peer";
import { useSocket } from "../context/SocketProvider";
import { useParams } from "react-router-dom";

const RoomPage = () => {
  const { roomId } = useParams();
  const socket = useSocket();
  const [peerConnections, setPeerConnections] = useState([]);
  const [remoteSocketIds, setRemoteSocketIds] = useState([]);
  const [myStream, setMyStream] = useState();
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);

  useEffect(() => {
    const userVideo = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
    };
    userVideo();
    socket.emit("room:join", { room: roomId });
  }, []);

  const handleOtherUsersInThisRoom = useCallback(({ otherUsersInThisRoom }) => {
    console.log("otherUsersInThisRoom", otherUsersInThisRoom);
  }, []);

  const handleUserJoined = useCallback((joinedUserId) => {
    console.log("joinedUserId", joinedUserId);
    setRemoteSocketIds((prv) => [...prv, joinedUserId]);
    handleCallUser(joinedUserId);
  }, []);

  const handleCallUser = useCallback(
    async (id) => {
      console.log("handleCallUser", id);
      const peerService = new PeerService();
      const offer = await peerService.getOffer();
      setPeerConnections((prev) => [...prev, { id: id, peer: peerService }]);
      socket.emit("user:call", { to: id, offer });
    },
    [socket]
  );
  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      console.log(`Incoming Call`, from, offer);
      const peerService = new PeerService();
      const ans = await peerService.getAnswer(offer);
      setPeerConnections((prev) => [...prev, { id: from, peer: peerService }]);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket]
  );
  const handleCallAccepted = useCallback(
    async ({ from, ans }) => {
      console.log("handleCallAccepted", from, ans);
      peerConnections.forEach((peer) => {
        if (peer.id == from) {
          console.log(peer, "accepted");
          peer.peer.setLocalDescription(ans);
          console.log("Call Accepted! sendStreams");
          sendStreams(from);
        }
      });
    },
    [peerConnections]
  );

  const sendStreams = useCallback(
    (id) => {
      console.log("sendStreams", peerConnections, id);
      peerConnections.forEach((peer) => {
        if (peer.id == id) {
          console.log(peer.peer, "in for");
          for (const track of myStream.getTracks()) {
            peer.peer.peer.addTrack(track, myStream);
          }
        }
      });
    },
    [myStream, peerConnections]
  );

  const handleNegoNeeded = useCallback(
    async (id) => {
      console.log("handleNegoNeeded", id);
      const peerToUpdate = peerConnections.find((peer) => peer.id == id);
      if (peerToUpdate) {
        console.log("peerToUpdate");
        const offer = await peerToUpdate.peer.getOffer();
        socket.emit("peer:nego:needed", { offer, to: id });
      }
    },
    [peerConnections, socket]
  );

  useEffect(() => {
    peerConnections.forEach((peer) => {
      if (peer.peer.peer) {
        const id = peer.id;
        console.log(id, "peer id");
        peer.peer.peer.addEventListener("negotiationneeded", () =>
          handleNegoNeeded(id)
        );
      }
    });

    return () => {
      peerConnections.forEach((peer) => {
        if (peer.peer.peer) {
          const id = peer.id;
          peer.peer.peer.removeEventListener("negotiationneeded", () =>
            handleNegoNeeded(id)
          );
        }
      });
    };
  }, [peerConnections, handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const peerToUpdate = peerConnections.find((peer) => peer.id === from);
      if (peerToUpdate) {
        const ans = await peerToUpdate.peer.getAnswer(offer);
        socket.emit("peer:nego:done", { to: from, ans });
      }
    },
    [peerConnections, socket]
  );

  const handleNegoNeedFinal = useCallback(
    async ({ ans, from }) => {
      console.log("handleNegoNeedFinal");
      const peerToUpdate = peerConnections.find((peer) => peer.id === from);
      if (peerToUpdate) {
        await peerToUpdate.peer.setLocalDescription(ans);
        socket.emit("start:streaming", { to: from });
      }
    },
    [peerConnections, socket]
  );

  const handleStartStreaming = useCallback(() => {
    console.log("handleStartStreaming");
    if (myStream) {
      peerConnections.forEach((peer) => {
        sendStreams(peer.id);
      });
    }
  }, [myStream, peerConnections, sendStreams]);

  useEffect(() => {
    socket.on("otherUsersInThisRoom", handleOtherUsersInThisRoom);
    socket.on("userJoined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);
    socket.on("start:streaming1", handleStartStreaming);

    return () => {
      socket.off("otherUsersInThisRoom", handleOtherUsersInThisRoom);
      socket.off("userJoined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
      socket.off("start:streaming1", handleStartStreaming);
    };
  }, [
    socket,
    handleOtherUsersInThisRoom,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
    handleStartStreaming,
  ]);

  useEffect(() => {
    peerConnections.forEach((peer) => {
      peer.peer.peer.addEventListener("track", async (ev) => {
        const remoteStream = ev.streams[0];
        if (remoteStream.getVideoTracks().length > 0) {
          // Check for video track
          console.log("GOT VIDEO TRACK!!", remoteStream.id);
        setRemoteStreams((prevStreams) => {
          const existingStream = prevStreams.find(
            (stream) => stream.id == remoteStream.id
          );
          if (!existingStream) {
            return [...prevStreams, remoteStream];
          } else {
            return prevStreams; 
          }
        });
        } else {
          console.log("Got non-video track");
        }
      });
    });
  }, [peerConnections]);

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
      {peerConnections.map((pear, index) => (
        <h5 key={index}>{pear.id}</h5>
      ))}{" "}
      <h1>Remote Stream</h1>
      <div style={{ display: "flex" }}>
        {remoteStreams.map((stream, index) => (
          <div key={index}>
            {/* Log the stream URL here to check if it's correct */}
            {console.log("Remote stream URL:", stream)}
            <ReactPlayer playing height="100px" width="200px" url={stream} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoomPage;
