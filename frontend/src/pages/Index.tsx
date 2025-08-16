import { useWebRTC } from '@/hooks/useWebRTC';
import { JoinScreen } from '@/components/JoinScreen';
import { VideoCall } from '@/components/VideoCall';

const Index = () => {
  const {
    callState,
    fileProgress,
    incomingFiles,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
    sendFiles
  } = useWebRTC();

  if (!callState.isJoined) {
    return (
      <JoinScreen 
        onJoin={joinRoom}
        isConnecting={false} // you can wire a state if you want a spinner
      />
    );
  }

  return (
    <VideoCall
      callState={callState}
      onToggleAudio={toggleAudio}
      onToggleVideo={toggleVideo}
      onLeaveCall={leaveRoom}
      onSendFiles={sendFiles}
      fileProgress={fileProgress}
      incomingFiles={incomingFiles}
    />
  );
};

export default Index;
