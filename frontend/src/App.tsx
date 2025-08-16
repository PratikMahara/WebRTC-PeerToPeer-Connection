import { useWebRTC } from '@/hooks/useWebRTC';
import { JoinScreen } from '@/components/JoinScreen';
import { VideoCall } from '@/components/VideoCall';

export default function App() {
  const {
    callState,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
    sendFiles,
    fileProgress,
    incomingFiles,
  } = useWebRTC();

  const handleJoin = async (email: string, roomId: string) => {
    await joinRoom(email, roomId);
    // no local "joined" state here, rely on callState.isJoined
  };

  const handleLeave = () => {
    leaveRoom();
  };

  if (!callState.isJoined) {
    return <JoinScreen onJoin={handleJoin} isConnecting={false} />;
  }

  return (
    <VideoCall
      callState={callState}
      onToggleAudio={toggleAudio}
      onToggleVideo={toggleVideo}
      onLeaveCall={handleLeave}
      onSendFiles={sendFiles}
      fileProgress={fileProgress}
      incomingFiles={incomingFiles}
    />
  );
}
