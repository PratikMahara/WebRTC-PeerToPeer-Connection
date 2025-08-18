// src/hooks/useWebRTC.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CallState, ConnectionState, WebSocketMessage } from '@/types/webrtc';

const WS_URL = 'wss://webrtc-peertopeer-connection-1.onrender.com/signal'; // change to your server origin in prod
const CHUNK_SIZE = 64 * 1024; // 64KB - safe default across browsers

type ProgressMap = { [fileName: string]: number };

type UseWebRTC = {
  callState: CallState;
  joinRoom: (email: string, roomId: string) => Promise<void>;
  leaveRoom: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  sendFiles: (files: FileList) => void;
  fileProgress: ProgressMap;
  incomingFiles: ProgressMap;
};
function comparePoliteness(a: string, b: string) {
  // deterministic role: "polite" if your id/email sorts higher
  return a.localeCompare(b) > 0;
}

export function useWebRTC(): UseWebRTC {
  const [callState, setCallState] = useState<CallState>({
    isJoined: false,
    isPolite: false,
    makingOffer: false,
    ignoreOffer: false,
    localStream: null,
    remoteStream: null,
    isAudioMuted: false,
    isVideoOff: false,
    connectionState: {
      ice: 'new',
      connection: 'new',
      gathering: 'new',
    },
  });

  const [fileProgress, setFileProgress] = useState<ProgressMap>({});
  const [incomingFiles, setIncomingFiles] = useState<ProgressMap>({});
const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const emailRef = useRef<string>('');
  const roomRef = useRef<string>('');
  const remoteIdRef = useRef<string>('');

  // Receiving file assembly buffers keyed by fileName
 const receiveBuffersRef = useRef<{ [fileName: string]: ArrayBuffer[] }>({});
const receiveMetaRef = useRef<{ [fileName: string]: { fileSize: number; received: number } }>({});

  const updateConnState = useCallback(() => {
    const pc = pcRef.current;
    if (!pc) return;
    setCallState((s) => ({
      ...s,
      connectionState: {
        ice: pc.iceConnectionState,
        connection: pc.connectionState,
        gathering: pc.iceGatheringState,
      },
    }));
  }, []);

  const closeConnections = useCallback(() => {
    try { dcRef.current?.close(); } catch {}
    try { pcRef.current?.getSenders().forEach(s => { try { s.track?.stop(); } catch {} }); } catch {}
    try { pcRef.current?.close(); } catch {}
    try { wsRef.current?.close(); } catch {}
    dcRef.current = null;
    pcRef.current = null;
    wsRef.current = null;
  }, []);

  const createPeer = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.oniceconnectionstatechange = updateConnState;
    pc.onconnectionstatechange = updateConnState;
    pc.onicegatheringstatechange = updateConnState;

    pc.ontrack = (e) => {
      const [stream] = e.streams;
      setCallState((s) => ({ ...s, remoteStream: stream || null }));
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current && roomRef.current) {
        const payload: WebSocketMessage = {
          type: 'ice-candidate',
          roomId: roomRef.current,
          displayName: emailRef.current,
          candidate: {
            candidate: e.candidate.candidate,
            sdpMid: e.candidate.sdpMid,
            sdpMLineIndex: e.candidate.sdpMLineIndex ?? null,
            usernameFragment: (e.candidate as any).usernameFragment ?? null,
          },
        };
        wsRef.current.send(JSON.stringify(payload));
      }
    };

    // DataChannel (receiver side)
    pc.ondatachannel = (evt) => {
      const channel = evt.channel;
      wireDataChannel(channel);
    };

    pcRef.current = pc;
    return pc;
  }, [updateConnState]);

  const wireDataChannel = (channel: RTCDataChannel) => {
    dcRef.current = channel;

    channel.onopen = () => {
      // ready to send
    };

    channel.onmessage = (event) => {
      const data = event.data;

      // We send a JSON header first (meta), then raw ArrayBuffer chunks
      // Distinguish by type
      if (typeof data === 'string') {
        try {
          const meta = JSON.parse(data);
          if (meta?.__fileMeta === true) {
            const { fileName, fileSize } = meta;
            receiveBuffersRef.current[fileName] = [];
            receiveMetaRef.current[fileName] = { fileSize, received: 0 };
            setIncomingFiles((prev) => ({ ...prev, [fileName]: 0 }));
            return;
          }
        } catch {
          // ignore non-json text
        }
      }

      if (data instanceof ArrayBuffer) {
        // find the active file by looking for one whose received < fileSize
        const entries = Object.entries(receiveMetaRef.current);
        for (const [fileName, rec] of entries) {
          if (rec.received < rec.fileSize) {
            receiveBuffersRef.current[fileName].push(data);
            rec.received += data.byteLength;

            const progress = (rec.received / rec.fileSize) * 100;
            setIncomingFiles((prev) => ({ ...prev, [fileName]: progress }));

            if (rec.received >= rec.fileSize) {
              // assemble and download
              const blob = new Blob(receiveBuffersRef.current[fileName]);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              URL.revokeObjectURL(url);
              a.remove();

              // cleanup
              delete receiveBuffersRef.current[fileName];
              delete receiveMetaRef.current[fileName];

              setTimeout(() => {
                setIncomingFiles((prev) => {
                  const { [fileName]: _, ...rest } = prev;
                  return rest;
                });
              }, 1200);
            }
            break;
          }
        }
      }
    };
  };

  const makeOfferIfNeeded = useCallback(async () => {
    const pc = pcRef.current;
    const ws = wsRef.current;
    if (!pc || !ws) return;

    try {
      setCallState((s) => ({ ...s, makingOffer: true }));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const payload: WebSocketMessage = {
        type: 'offer',
        roomId: roomRef.current,
        displayName: emailRef.current,
        sdp: offer.sdp,
      };
      ws.send(JSON.stringify(payload));
    } finally {
      setCallState((s) => ({ ...s, makingOffer: false }));
    }
  }, []);

  const handleSignalMessage = useCallback(async (raw: any) => {
    const pc = pcRef.current;
    if (!pc) return;

    const msg: WebSocketMessage = raw;

    switch (msg.type) {
      case 'user-joined': {
        // Other peer joined; decide who is polite
        if (msg.displayName) remoteIdRef.current = msg.displayName;
        setCallState((s) => ({ ...s, isPolite: comparePoliteness(emailRef.current, remoteIdRef.current) }));
        // If *we* are the impolite one, proactively offer
        if (!comparePoliteness(emailRef.current, remoteIdRef.current)) {
          await makeOfferIfNeeded();
        }
        break;
      }

      case 'offer': {
        const offer = { type: 'offer' as const, sdp: msg.sdp! };

        const readyForOffer =
          !callState.makingOffer &&
          (pc.signalingState === 'stable' || callState.isPolite);

        const offerCollision = !readyForOffer;

        setCallState((s) => ({ ...s, ignoreOffer: offerCollision && !s.isPolite }));

        if (offerCollision && !callState.isPolite) {
          // Ignore the offer
          return;
        }

        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        wsRef.current?.send(
          JSON.stringify({
            type: 'answer',
            roomId: roomRef.current,
            displayName: emailRef.current,
            sdp: answer.sdp,
          } as WebSocketMessage)
        );
        break;
      }

      case 'answer': {
        const answer = { type: 'answer' as const, sdp: msg.sdp! };
        await pc.setRemoteDescription(answer);
        break;
      }

      case 'ice-candidate': {
        if (msg.candidate?.candidate) {
          try {
            await pc.addIceCandidate(msg.candidate);
          } catch (err) {
            // If we got an ice candidate while ignoring offer, it’s okay to drop
            if (!callState.ignoreOffer) {
              console.error('Error adding ice candidate', err);
            }
          }
        }
        break;
      }

      case 'user-left': {
        // remote left: keep our local, clear remote
        setCallState((s) => ({ ...s, remoteStream: null }));
        break;
      }

      default:
        break;
    }
  }, [callState.ignoreOffer, callState.isPolite, callState.makingOffer, makeOfferIfNeeded]);

  const joinRoom = useCallback(async (email: string, roomId: string) => {
    emailRef.current = email;
    

    // Create Peer
    const pc = createPeer();

    // Get media and attach
    const local = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    local.getTracks().forEach((t) => pc.addTrack(t, local));
    setCallState((s) => ({ ...s, localStream: local }));

    // Create DataChannel (sender side)
    const dataChannel = pc.createDataChannel('fileTransfer');
    wireDataChannel(dataChannel);

    // Connect signaling
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      const payload: WebSocketMessage = {
        type: 'join',
        roomId,
        displayName: email,
      };
      ws.send(JSON.stringify(payload));
      setCallState((s) => ({ ...s, isJoined: true }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        await handleSignalMessage(msg);
      } catch (e) {
        console.error('Invalid signaling message', e);
      }
    };

    ws.onclose = () => {
      // peer may remain; but we mark disconnected states through pc events anyway
    };
  }, [createPeer, handleSignalMessage]);

  const leaveRoom = useCallback(() => {
    try {
      if (wsRef.current && roomRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'leave',
          roomId: roomRef.current,
          displayName: emailRef.current,
        } as WebSocketMessage));
      }
    } catch {}
    closeConnections();
    setCallState((s) => ({
      ...s,
      isJoined: false,
      localStream: null,
      remoteStream: null,
    }));
    setFileProgress({});
    setIncomingFiles({});
  }, [closeConnections]);

  const toggleAudio = useCallback(() => {
    setCallState((s) => {
      s.localStream?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      return { ...s, isAudioMuted: !s.isAudioMuted };
    });
  }, []);

  const toggleVideo = useCallback(() => {
    setCallState((s) => {
      s.localStream?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      return { ...s, isVideoOff: !s.isVideoOff };
    });
  }, []);
const joinCall = async (email: string, roomId: string) => {
  setIsConnecting(true);
  try {
    await joinRoom(email, roomId);   // <- call the actual joinRoom inside
  } finally {
    setIsConnecting(false);
  }
};

const leaveCall = () => {
  leaveRoom();
};
  const sendSingleFile = useCallback(async (file: File) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return;

    // Send metadata first
    dc.send(JSON.stringify({ __fileMeta: true, fileName: file.name, fileSize: file.size }));

    let offset = 0;
    while (offset < file.size) {
      // flow control: wait if bufferedAmount grows too large
      while (dc.bufferedAmount > 8 * 1024 * 1024) {
        await new Promise((r) => setTimeout(r, 10));
      }

      const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
      const buf = await slice.arrayBuffer();
      dc.send(buf);
      offset += buf.byteLength;

      const progress = (offset / file.size) * 100;
      setFileProgress((prev) => ({ ...prev, [file.name]: progress }));
    }

    // graceful cleanup after a moment
    setTimeout(() => {
      setFileProgress((prev) => {
        const { [file.name]: _, ...rest } = prev;
        return rest;
      });
    }, 1200);
  }, []);

  const sendFiles = useCallback((files: FileList) => {
    Array.from(files).forEach((f) => sendSingleFile(f));
  }, [sendSingleFile]);

  // keep connection state in sync
  useEffect(() => {
    const i = setInterval(updateConnState, 300);
    return () => clearInterval(i);
  }, [updateConnState]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      leaveRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    callState,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
    sendFiles,
    fileProgress,
    incomingFiles,
  };
}
