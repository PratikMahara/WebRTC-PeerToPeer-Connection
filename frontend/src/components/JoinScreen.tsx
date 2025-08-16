import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Users } from 'lucide-react';

interface JoinScreenProps {
  onJoin: (email: string, roomId: string) => void;
  isConnecting: boolean;
}

export const JoinScreen = ({ onJoin, isConnecting }: JoinScreenProps) => {
  const [email, setEmail] = useState('');
  const [roomId, setRoomId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && roomId.trim()) {
      onJoin(email.trim(), roomId.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-primary opacity-5" />
      
      <Card className="w-full max-w-md bg-gradient-card shadow-card border-0 relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-primary">
            <Video className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Join Video Call
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              Enter your details to join the video conference
            </p>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-input border-border focus:ring-primary transition-smooth"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="roomId" className="text-sm font-medium">
                Room ID
              </Label>
              <Input
                id="roomId"
                type="text"
                placeholder="meeting-room-123"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="bg-input border-border focus:ring-primary transition-smooth"
                required
              />
            </div>
            
            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:shadow-primary disabled:opacity-50 transition-smooth"
              disabled={isConnecting || !email.trim() || !roomId.trim()}
            >
              {isConnecting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Connecting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Join Call
                </div>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
