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
  const [myScreenSharePeerConnections, setMyScreenSharePeerConnections] =
    useState([]);
  const [incomingScreenShare, setIncomingScreenShare] = useState(null);

  const [incomingScreenVideo, setIncomingScreenVideo] = useState(null);

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
        // handleCallUser(user);
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

  const handleCallUserForScreen = useCallback(
    async (id) => {
      console.log("handleCallUserForScreen", id);
      const peerService = new PeerService();
      const offer = await peerService.getOffer();
      const newConnection = { id, peer: peerService };
      myScreenSharePeerConnections.push(newConnection);

      socket.emit("user:callForScreen", { to: id, offer });
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

  const handleIncommingCallForScreen = useCallback(
    async ({ from, offer }) => {
      console.log(`handleIncommingCallForScreen`, from, offer);
      const peerService = new PeerService();
      const ans = await peerService.getAnswer(offer);
      setIncomingScreenShare({ id: from, peer: peerService });
      // setPeerConnections((prev) => [...prev, { id: from, peer: peerService }]);
      socket.emit("call:acceptedForScreen", { to: from, ans });
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
      console.log("handleCallAccepted", peerConnections, from, ans);
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

  const handleCallAcceptedForScreen = useCallback(
    async ({ from, ans }) => {
      console.log(
        "handleCallAcceptedForScreen",
        myScreenSharePeerConnections,
        from,
        ans
      );
      myScreenSharePeerConnections.forEach((peer) => {
        if (peer.id == from) {
          console.log(peer, "accepted");
          peer.peer.setLocalDescription(ans);
          console.log("Call Accepted! sendStreams");

          sendStreamsForScreen(from);
        }
      });
    },
    [myScreenSharePeerConnections, myStream]
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

  const sendStreamsForScreen = useCallback(
    (id) => {
      console.log("sendStreamsForScreen", myScreenSharePeerConnections, id);

      setMyScreenShare((prev) => {
        myScreenSharePeerConnections.forEach((peer) => {
          if (peer.id === id) {
            console.log(peer.peer, "in for", id);
            const senders = peer.peer.peer.getSenders();
            const existingSender = senders.find(
              (sender) => sender.track === prev.getTracks()[0]
            );
            if (!existingSender) {
              console.log("send");
              for (const track of prev.getTracks()) {
                peer.peer.peer.addTrack(track, prev);
              }

              handlePeerConnectionEvents(peer);
            } else {
              console.log("Sender already exists for this track.");
            }
          }
        });
        return prev;
      });
    },
    [myScreenSharePeerConnections]
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

  const handleNegoNeededForScreen = useCallback(
    async (id) => {
      console.log("handleNegoNeededForScreen", id);
      const peerToUpdate = myScreenSharePeerConnections.find(
        (peer) => peer.id == id
      );
      if (peerToUpdate) {
        console.log("peerToUpdate");
        const offer = await peerToUpdate.peer.getOffer();
        socket.emit("peer:nego:neededForScreen", { offer, to: id });
      }
    },
    [myScreenSharePeerConnections, socket]
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

  useEffect(() => {
    console.log("KK");
    myScreenSharePeerConnections.forEach((peer) => {
      console.log("ss");
      if (peer.peer.peer) {
        const id = peer.id;
        console.log(id, "peer id");
        peer.peer.peer.addEventListener("negotiationneeded", () =>
          handleNegoNeededForScreen(id)
        );
      }
    });

    return () => {
      myScreenSharePeerConnections.forEach((peer) => {
        if (peer.peer.peer) {
          const id = peer.id;
          peer.peer.peer.removeEventListener("negotiationneeded", () =>
            handleNegoNeededForScreen(id)
          );
        }
      });
    };
  }, [
    myScreenSharePeerConnections,
    setMyScreenSharePeerConnections,
    handleNegoNeededForScreen,
  ]);

  const handlePeerConnectionEvents = (peer) => {
    if (peer.peer.peer) {
      const id = peer.id;
      console.log(id, "peer id");
      peer.peer.peer.addEventListener("negotiationneeded", () =>
        handleNegoNeededForScreen(id)
      );
    }

    return () => {
      if (peer.peer.peer) {
        const id = peer.id;
        peer.peer.peer.removeEventListener("negotiationneeded", () =>
          handleNegoNeededForScreen(id)
        );
      }
    };
  };

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

  const handleNegoNeedIncommingForScreen = useCallback(
    async ({ from, offer }) => {
      console.log("handleNegoNeedIncommingForScreen");
      console.log("1aaa");

      setIncomingScreenShare(async (prev) => {
        console.log("aaaa", prev);
        const ans = await prev.peer.getAnswer(offer);
        socket.emit("peer:nego:doneForScreen", { to: from, ans });

        return prev;
      });
    },
    [incomingScreenShare, socket]
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

  const handleNegoNeedFinalForScreen = useCallback(
    async ({ ans, from }) => {
      console.log("handleNegoNeedFinalForScreen");
      const peerToUpdate = myScreenSharePeerConnections.find(
        (peer) => peer.id === from
      );
      if (peerToUpdate) {
        await peerToUpdate.peer.setLocalDescription(ans);
        // socket.emit("start:streamingForScreen", { to: from });
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

  const handleStartStreamingForScreen = useCallback(() => {
    console.log("handleStartStreamingForScreen");
    // if (myStream) {
    //   peerConnections.forEach((peer) => {
    //     sendStreams(peer.id);
    //   });
    // }
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

    usersInThisRoom.forEach((user) => {
      handleCallUserForScreen(user);
    });
  }, []);

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
    socket.on("incomming:callForScreen", handleIncommingCallForScreen);
    socket.on("call:acceptedForScreen", handleCallAcceptedForScreen);
    socket.on("peer:nego:neededForScreen", handleNegoNeedIncommingForScreen);
    socket.on("peer:nego:finalForScreen", handleNegoNeedFinalForScreen);
    socket.on("start:streaming1ForScreen", handleStartStreamingForScreen);

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
      socket.off("incomming:callForScreen", handleIncommingCallForScreen);
      socket.off("call:acceptedForScreen", handleCallAcceptedForScreen);
      socket.off("peer:nego:neededForScreen", handleNegoNeedIncommingForScreen);
      socket.off("peer:nego:finalForScreen", handleNegoNeedFinalForScreen);
      socket.off("start:streaming1ForScreen", handleStartStreamingForScreen);
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

  useEffect(() => {
    if (incomingScreenShare && incomingScreenShare.peer) {
      incomingScreenShare.peer.peer.addEventListener("track", async (ev) => {
        const remoteStream = ev.streams[0];
        if (remoteStream && remoteStream.getVideoTracks().length > 0) {
          // Check for video track
          console.log(
            "GOT VIDEO TRACK!!",
            remoteStream.id,
            incomingScreenShare.id,
            "peer id"
          );
          setIncomingScreenVideo(remoteStream);
        } else {
          console.log("Got non-video track");
        }
      });
    }
  }, [incomingScreenShare]);

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

  // useEffect(() => {
  //   const shareS = async () => {
  //     await navigator.mediaDevices.getDisplayMedia({}).then((stream) => {
  //       setMyScreenShare(stream);
  //     });
  //   }
  //   shareS();
  // },[])

  const shareMyScreen = useCallback(async () => {
    navigator.mediaDevices
      .getDisplayMedia({ video: true })
      .then((stream) => {
        setMyScreenShare(stream);
        // Emit socket message after setting myScreenShare

        socket.emit("usersInThisRoom", { room: roomId });
      })
      .catch((error) => {
        // Handle permission denied error here
        console.error("Error getting screen share:", error);
      });
  }, [socket, roomId, setMyScreenShare]);

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

        {incomingScreenVideo && (
          <>
            <ReactPlayer
              playing
              muted
              height="100px"
              width="200px"
              url={incomingScreenVideo}
            />
          </>
        )}

        {incomingScreenVideo && (
          <>
            <h1>aa</h1>
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
