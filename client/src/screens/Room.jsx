import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import PeerService from "../service/peer";
import { useSocket } from "../context/SocketProvider";
import { useParams } from "react-router-dom";

const RoomPage = () => {
  const { roomId } = useParams();
  const socket = useSocket();
  const [peerConnections, setPeerConnections] = useState([]);
  const [myStream, setMyStream] = useState();
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [myScreenShare, setMyScreenShare] = useState(null);
  const [myScreenSharePeerConnections, setMyScreenSharePeerConnections] = useState([]);

  useEffect(() => {
    socket.emit("room:join", { room: roomId });
  }, []);

  const handleOtherUsersInThisRoom = useCallback(
    async ({ otherUsersInThisRoom }) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      console.log("otherUsersInThisRoom", otherUsersInThisRoom);
      otherUsersInThisRoom.forEach((user) => {
        handleCallUser(user);
      });
    },
    []
  );

  const handleUserJoined = useCallback((joinedUserId) => {
    console.log("joinedUserId", joinedUserId);
    // window.alert(`${joinedUserId} is joined`);
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
  const handleIncommingCallExisting = useCallback(
    async ({ from, offer }) => {
      console.log(`Incoming Call`, from, offer);
      const peerService = new PeerService();
      const ans = await peerService.getAnswer(offer);
      setPeerConnections((prev) => [
        ...prev,
        { id: `existing_${from}`, peer: peerService },
      ]);
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
    [peerConnections, myStream]
  );
  const sendStreams = useCallback(
    (id) => {
      console.log("sendStreams", peerConnections, id);

      peerConnections.forEach((peer) => {
        if (peer.id === id) {
          console.log(peer.peer, "in for");
          const senders = peer.peer.peer.getSenders();
          const existingSender = senders.find(
            (sender) => sender.track === myStream.getTracks()[0]
          );
          if (!existingSender) {
            for (const track of myStream.getTracks()) {
              peer.peer.peer.addTrack(track, myStream);
            }
          } else {
            console.log("Sender already exists for this track.");
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

  const handleUserDisconnected = useCallback(
    async ({ socketId }) => {
      console.log("disconnected", socketId);
      peerConnections.forEach((peer) => {
        console.log("ss");

        if (peer.id == socketId) {
          peer.peer.peer.close();
        }
      });
      setPeerConnections((prev) => prev.filter((peer) => peer.id !== socketId));
      setRemoteStreams((prev) =>
        prev.filter((stream) => stream.id !== socketId)
      );
    },
    [peerConnections]
  );

  const handleUsersInThisRoom = useCallback(async ({ usersInThisRoom }) => {
    console.log("usersInThisRoom", usersInThisRoom);
    const stream = await navigator.mediaDevices.getDisplayMedia({});
    setMyScreenShare(stream);
  }, []);


   const handleCallUserForScreenShare = useCallback(
     async (id) => {
       console.log("handleCallUserForScreenShare", id);
       const peerService = new PeerService();
       const offer = await peerService.getOffer();
       setMyScreenSharePeerConnections((prev) => [...prev, { id: id, peer: peerService }]);
       socket.emit("user:call", { to: id, offer });
     },
     [socket]
   );

  useEffect(() => {
    socket.on("otherUsersInThisRoom", handleOtherUsersInThisRoom);
    socket.on("userJoined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);
    socket.on("start:streaming1", handleStartStreaming);
    socket.on("incomming:call:existing", handleIncommingCallExisting);
    socket.on("user:disconnected", handleUserDisconnected);
    socket.on("usersInThisRoom", handleUsersInThisRoom);

    return () => {
      socket.off("otherUsersInThisRoom", handleOtherUsersInThisRoom);
      socket.off("userJoined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
      socket.off("start:streaming1", handleStartStreaming);
      socket.off("incomming:call:existing", handleIncommingCallExisting);
      socket.off("user:disconnected", handleUserDisconnected);
      socket.off("usersInThisRoom", handleUsersInThisRoom);
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
          console.log("GOT VIDEO TRACK!!", remoteStream.id, peer.id, "peer id");
          setRemoteStreams((prevStreams) => {
            const existingStream = prevStreams.find(
              (stream) => stream.remoteStream.id == remoteStream.id
            );
            if (!existingStream) {
              return [...prevStreams, { remoteStream, id: peer.id }];
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
    setIsVideoOn((prevState) => !prevState);
    myStream.getVideoTracks().forEach((track) => (track.enabled = !isVideoOn));
  };

  const toggleAudio = () => {
    setIsAudioOn((prevState) => !prevState);
    myStream.getAudioTracks().forEach((track) => {
      track.enabled = !isAudioOn;
    });
  };

  const shareMyScreen = useCallback(() => {
    socket.emit("usersInThisRoom", { room: roomId });
  }, [socket]);

  return (
    <div>
      <h1>Room Page</h1>
      <button onClick={toggleVideo}>
        {isVideoOn ? "Turn Off Video" : "Turn On Video"}
      </button>
      <button onClick={toggleAudio}>
        {isAudioOn ? "Turn Off Audio" : "Turn On Audio"}
      </button>
      <button onClick={shareMyScreen}>Share My Screen</button>
      <h1>My Stream</h1>
      <div style={{ display: "flex" }}>
        {myStream && (
          <>
            <ReactPlayer
              playing
              muted
              height="100px"
              width="200px"
              url={myStream}
            />
          </>
        )}

        {myScreenShare && (
          <>
            <ReactPlayer
              playing
              muted
              height="100px"
              width="200px"
              url={myScreenShare}
            />
          </>
        )}
      </div>
      {peerConnections.map((pear, index) => (
        <h5 key={index}>{pear.id}</h5>
      ))}{" "}
      <h1>Remote Stream</h1>
      <div style={{ display: "flex" }}>
        {remoteStreams.map((stream, index) => (
          <div key={index}>
            <div>{stream.id}</div>
            <div>
              <ReactPlayer
                playing
                height="100px"
                width="200px"
                url={stream.remoteStream}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoomPage;
