// src/hooks/useWebRTC.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CallState, ConnectionState, WebSocketMessage } from '@/types/webrtc';

const WS_URL = 'wss://webrtc-peertopeer-connection-1.onrender.com/signal';
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
  isConnecting: boolean;
};

function comparePoliteness(a: string, b: string) {
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

  const receiveBuffersRef = useRef<{ [fileName: string]: ArrayBuffer[] }>({});
  const receiveMetaRef = useRef<{ [fileName: string]: { fileSize: number; received: number } }>({});

  const updateConnState = useCallback(() => {
    const pc = pcRef.current;
    if (!pc) return;
    
    const newState = {
      ice: pc.iceConnectionState,
      connection: pc.connectionState,
      gathering: pc.iceGatheringState,
    };

    console.log('Connection state update:', newState);
    setCallState((s) => ({
      ...s,
      connectionState: newState,
    }));
  }, []);

  const closeConnections = useCallback(() => {
    console.log('Closing all connections');
    try { dcRef.current?.close(); } catch (e) { console.error('Error closing data channel:', e); }
    try { 
      pcRef.current?.getSenders().forEach(s => { 
        try { s.track?.stop(); } catch (e) { console.error('Error stopping sender track:', e); } 
      }); 
    } catch (e) { console.error('Error closing senders:', e); }
    try { pcRef.current?.close(); } catch (e) { console.error('Error closing peer connection:', e); }
    try { wsRef.current?.close(); } catch (e) { console.error('Error closing websocket:', e); }
    
    dcRef.current = null;
    pcRef.current = null;
    wsRef.current = null;
  }, []);

  const createPeer = useCallback(() => {
    console.log('Creating new RTCPeerConnection');
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      updateConnState();
    };
    
    pc.onconnectionstatechange = () => {
      console.log('Peer connection state:', pc.connectionState);
      updateConnState();
    };
    
    pc.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', pc.iceGatheringState);
      updateConnState();
    };

    pc.ontrack = (e) => {
      console.log('Received remote track:', e.track.kind);
      const [stream] = e.streams;
      setCallState((s) => ({ ...s, remoteStream: stream || null }));
    };

    pc.onicecandidate = (e) => {
      console.log('ICE candidate:', e.candidate);
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN && roomRef.current) {
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

    pc.ondatachannel = (evt) => {
      console.log('Data channel received:', evt.channel.label);
      const channel = evt.channel;
      wireDataChannel(channel);
    };

    pcRef.current = pc;
    return pc;
  }, [updateConnState]);

  const wireDataChannel = (channel: RTCDataChannel) => {
    console.log('Wiring data channel:', channel.label);
    dcRef.current = channel;

    channel.onopen = () => {
      console.log('Data channel opened');
    };

    channel.onclose = () => {
      console.log('Data channel closed');
    };

    channel.onerror = (err) => {
      console.error('Data channel error:', err);
    };

    channel.onmessage = (event) => {
      console.log('Data channel message received:', typeof event.data);
      const data = event.data;

      if (typeof data === 'string') {
        try {
          const meta = JSON.parse(data);
          if (meta?.__fileMeta === true) {
            console.log('Received file metadata:', meta);
            const { fileName, fileSize } = meta;
            receiveBuffersRef.current[fileName] = [];
            receiveMetaRef.current[fileName] = { fileSize, received: 0 };
            setIncomingFiles((prev) => ({ ...prev, [fileName]: 0 }));
            return;
          }
        } catch {
          console.log('Non-file-meta text message:', data);
        }
      }

      if (data instanceof ArrayBuffer) {
        const entries = Object.entries(receiveMetaRef.current);
        for (const [fileName, rec] of entries) {
          if (rec.received < rec.fileSize) {
            receiveBuffersRef.current[fileName].push(data);
            rec.received += data.byteLength;

            const progress = (rec.received / rec.fileSize) * 100;
            setIncomingFiles((prev) => ({ ...prev, [fileName]: progress }));

            if (rec.received >= rec.fileSize) {
              console.log('File transfer complete:', fileName);
              const blob = new Blob(receiveBuffersRef.current[fileName]);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              URL.revokeObjectURL(url);
              a.remove();

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
      console.log('Making offer...');
      setCallState((s) => ({ ...s, makingOffer: true }));
      const offer = await pc.createOffer();
      console.log('Created offer:', offer);
      await pc.setLocalDescription(offer);

      const payload: WebSocketMessage = {
        type: 'offer',
        roomId: roomRef.current,
        displayName: emailRef.current,
        sdp: offer.sdp,
      };
      ws.send(JSON.stringify(payload));
    } catch (err) {
      console.error('Error creating offer:', err);
    } finally {
      setCallState((s) => ({ ...s, makingOffer: false }));
    }
  }, []);

  const handleSignalMessage = useCallback(async (raw: any) => {
    console.log('Received signaling message:', raw);
    const pc = pcRef.current;
    if (!pc) return;

    const msg: WebSocketMessage = raw;

    switch (msg.type) {
      case 'user-joined': {
        console.log('Remote user joined:', msg.displayName);
        if (msg.displayName) remoteIdRef.current = msg.displayName;
        const isPolite = comparePoliteness(emailRef.current, remoteIdRef.current);
        setCallState((s) => ({ ...s, isPolite }));
        
        if (!isPolite) {
          console.log('We are impolite, making offer');
          await makeOfferIfNeeded();
        }
        break;
      }

      case 'offer': {
        console.log('Received offer from peer');
        const offer = { type: 'offer' as const, sdp: msg.sdp! };

        const readyForOffer =
          !callState.makingOffer &&
          (pc.signalingState === 'stable' || callState.isPolite);

        const offerCollision = !readyForOffer;

        setCallState((s) => ({ ...s, ignoreOffer: offerCollision && !s.isPolite }));

        if (offerCollision && !callState.isPolite) {
          console.log('Ignoring offer due to collision');
          return;
        }

        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        console.log('Created answer:', answer);
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
        console.log('Received answer from peer');
        const answer = { type: 'answer' as const, sdp: msg.sdp! };
        await pc.setRemoteDescription(answer);
        break;
      }

      case 'ice-candidate': {
        console.log('Received ICE candidate');
        if (msg.candidate?.candidate) {
          try {
            await pc.addIceCandidate(msg.candidate);
          } catch (err) {
            if (!callState.ignoreOffer) {
              console.error('Error adding ice candidate', err);
            }
          }
        }
        break;
      }

      case 'user-left': {
        console.log('Remote user left');
        setCallState((s) => ({ ...s, remoteStream: null }));
        break;
      }

      default:
        console.log('Unknown message type:', msg.type);
        break;
    }
  }, [callState.ignoreOffer, callState.isPolite, callState.makingOffer, makeOfferIfNeeded]);

  const joinRoom = useCallback(async (email: string, roomId: string) => {
    setIsConnecting(true);
    try {
      console.log(`Joining room ${roomId} as ${email}`);
      emailRef.current = email;
      roomRef.current = roomId;

      closeConnections(); // Clean up any existing connections

      const pc = createPeer();

      console.log('Getting user media...');
      const local = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      local.getTracks().forEach((t) => pc.addTrack(t, local));
      setCallState((s) => ({ ...s, localStream: local }));

      console.log('Creating data channel...');
      const dataChannel = pc.createDataChannel('fileTransfer');
      wireDataChannel(dataChannel);

      console.log('Connecting to signaling server...');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected, joining room...');
        const payload: WebSocketMessage = {
          type: 'join',
          roomId,
          displayName: email,
        };
        ws.send(JSON.stringify(payload));
        setCallState((s) => ({ ...s, isJoined: true }));
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          await handleSignalMessage(msg);
        } catch (e) {
          console.error('Invalid signaling message', e, event.data);
        }
      };
    } catch (err) {
      console.error('Error joining room:', err);
      closeConnections();
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [closeConnections, createPeer, handleSignalMessage]);

  const leaveRoom = useCallback(() => {
    console.log('Leaving room');
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN && roomRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'leave',
          roomId: roomRef.current,
          displayName: emailRef.current,
        } as WebSocketMessage));
      }
    } catch (err) {
      console.error('Error sending leave message:', err);
    }
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
      const newMuteState = !s.isAudioMuted;
      s.localStream?.getAudioTracks().forEach((t) => (t.enabled = newMuteState));
      return { ...s, isAudioMuted: newMuteState };
    });
  }, []);

  const toggleVideo = useCallback(() => {
    setCallState((s) => {
      const newVideoState = !s.isVideoOff;
      s.localStream?.getVideoTracks().forEach((t) => (t.enabled = newVideoState));
      return { ...s, isVideoOff: newVideoState };
    });
  }, []);

  const sendSingleFile = useCallback(async (file: File) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') {
      console.error('Data channel not ready for file transfer');
      return;
    }

    console.log('Starting file transfer:', file.name);
    dc.send(JSON.stringify({ __fileMeta: true, fileName: file.name, fileSize: file.size }));

    let offset = 0;
    while (offset < file.size) {
      while (dc.bufferedAmount > 8 * 1024 * 1024) {
        console.log('Buffered amount high, waiting...');
        await new Promise((r) => setTimeout(r, 10));
      }

      const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
      const buf = await slice.arrayBuffer();
      dc.send(buf);
      offset += buf.byteLength;

      const progress = (offset / file.size) * 100;
      setFileProgress((prev) => ({ ...prev, [file.name]: progress }));
    }

    console.log('File transfer complete:', file.name);
    setTimeout(() => {
      setFileProgress((prev) => {
        const { [file.name]: _, ...rest } = prev;
        return rest;
      });
    }, 1200);
  }, []);

  const sendFiles = useCallback((files: FileList) => {
    console.log('Sending files:', files.length);
    Array.from(files).forEach((f) => sendSingleFile(f));
  }, [sendSingleFile]);

  useEffect(() => {
    const i = setInterval(updateConnState, 300);
    return () => clearInterval(i);
  }, [updateConnState]);

  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, [leaveRoom]);

  return {
    callState,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
    sendFiles,
    fileProgress,
    incomingFiles,
    isConnecting,
  };
}
