class PeerService {
  constructor() {
    if (!this.peer) {
      this.peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:global.stun.twilio.com:3478",
            ],
          },
        ],
        // Add video: true for video calls
        sdpSemantics: 'unified-plan',
        rtcpMuxPolicy: 'require',
        video: true,
      });
    }
  }

  async getAnswer(offer) {
    if (this.peer) {
      await this.peer.setRemoteDescription(offer);
      const ans = await this.peer.createAnswer({
        offerToReceiveAudio: 1, // Enable audio receiving
        offerToReceiveVideo: 1, // Enable video receiving
      });
      await this.peer.setLocalDescription(new RTCSessionDescription(ans));
      return ans;
    }
  }

  async setLocalDescription(ans) {
    if (this.peer) {
      await this.peer.setRemoteDescription(new RTCSessionDescription(ans));
    }
  }

  async getOffer() {
    if (this.peer) {
      const offer = await this.peer.createOffer({
        offerToReceiveAudio: 1, // Enable audio receiving
        offerToReceiveVideo: 1, // Enable video receiving
      });
      await this.peer.setLocalDescription(new RTCSessionDescription(offer));
      return offer;
    }
  }
}

export default PeerService;
