export interface WebSocketMessage {
  type: 'join' | 'offer' | 'answer' | 'ice-candidate' | 'leave' | 'error';
  roomId: string;
  displayName?: string;
  sdp?: string;
  candidate?: RTCIceCandidate;
  data?: any;
}

export interface FileTransferData {
  fileName: string;
  fileSize: number;
  chunks: ArrayBuffer[];
  receivedSize: number;
  isComplete: boolean;
}

export interface ConnectionState {
  ice: RTCIceConnectionState;
  connection: RTCPeerConnectionState;
  gathering: RTCIceGatheringState;
}

export interface CallState {
  isJoined: boolean;
  isPolite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  connectionState: ConnectionState;
}