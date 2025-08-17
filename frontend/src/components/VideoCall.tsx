import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff,
  Share,
  Users
} from 'lucide-react';
import { CallState } from '@/types/webrtc';
import { FileTransfer } from './FileTransfer';

interface VideoCallProps {
  callState: CallState;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeaveCall: () => void;
  onSendFiles: (files: FileList) => void;
  fileProgress: { [fileName: string]: number };
  incomingFiles: { [fileName: string]: number };
}

export const VideoCall = ({
  callState,
  onToggleAudio,
  onToggleVideo,
  onLeaveCall,
  onSendFiles,
  fileProgress,
  incomingFiles
}: VideoCallProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && callState.localStream) {
      (localVideoRef.current as HTMLVideoElement).srcObject = callState.localStream;
    }
  }, [callState.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && callState.remoteStream) {
      (remoteVideoRef.current as HTMLVideoElement).srcObject = callState.remoteStream;
    }
  }, [callState.remoteStream]);

  const getConnectionStatusColor = () => {
    switch (callState.connectionState.connection) {
      case 'connected':
        return 'text-accent';
      case 'connecting':
        return 'text-warning';
      case 'disconnected':
      case 'failed':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const getConnectionStatusText = () => {
    switch (callState.connectionState.connection) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'failed':
        return 'Connection Failed';
      default:
        return 'Initializing...';
    }
  };

  return (
    <div className="min-h-screen bg-video-bg p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Video Conference</h1>
              <p className={`text-sm ${getConnectionStatusColor()}`}>
                {getConnectionStatusText()}
              </p>
            </div>
          </div>
          
          <Button
            onClick={onLeaveCall}
            variant="destructive"
            className="bg-destructive hover:bg-destructive/90 transition-smooth"
          >
            <PhoneOff className="w-4 h-4 mr-2" />
            Leave Call
          </Button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Video Section */}
          <div className="lg:col-span-3 space-y-4">
            {/* Remote Video */}
            <Card className="relative overflow-hidden bg-video-bg border-border shadow-video">
              <div className="aspect-video bg-muted flex items-center justify-center">
                {callState.remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <div className="w-20 h-20 bg-muted-foreground/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">Waiting for remote participant...</p>
                  </div>
                )}
              </div>
              
              {/* Local Video Picture-in-Picture */}
              <div 
                className="
                  absolute bottom-3 right-3 
                  w-1/3 max-w-[180px] aspect-video 
                  bg-card border border-border rounded-lg overflow-hidden shadow-lg
                  sm:w-48 sm:h-36
                "
              >
                {callState.localStream ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Video className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
            </Card>

            {/* Controls */}
            <div className="flex justify-center gap-3 flex-wrap mt-3">
              <Button
                onClick={onToggleAudio}
                variant={callState.isAudioMuted ? "destructive" : "secondary"}
                size="lg"
                className="w-14 h-14 rounded-full transition-smooth"
              >
                {callState.isAudioMuted ? (
                  <MicOff className="w-6 h-6" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </Button>
              
              <Button
                onClick={onToggleVideo}
                variant={callState.isVideoOff ? "destructive" : "secondary"}
                size="lg"
                className="w-14 h-14 rounded-full transition-smooth"
              >
                {callState.isVideoOff ? (
                  <VideoOff className="w-6 h-6" />
                ) : (
                  <Video className="w-6 h-6" />
                )}
              </Button>
              
              <Button
                variant="secondary"
                size="lg"
                className="w-14 h-14 rounded-full transition-smooth"
              >
                <Share className="w-6 h-6" />
              </Button>
            </div>
          </div>

          {/* File Transfer Panel */}
          <div className="lg:col-span-1">
            <FileTransfer
              onSendFiles={onSendFiles}
              fileProgress={fileProgress}
              incomingFiles={incomingFiles}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
