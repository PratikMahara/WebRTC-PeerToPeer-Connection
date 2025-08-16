import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  File, 
  Download,
  X,
  Paperclip
} from 'lucide-react';

interface FileTransferProps {
  onSendFiles: (files: FileList) => void;
  fileProgress: { [fileName: string]: number };
  incomingFiles: { [fileName: string]: number };
}

export const FileTransfer = ({ 
  onSendFiles, 
  fileProgress, 
  incomingFiles 
}: FileTransferProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragOver(false);
  if (e.dataTransfer.files.length > 0) {
    onSendFiles(e.dataTransfer.files);
  }
};

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files && e.target.files.length > 0) {
    onSendFiles(e.target.files);
    e.target.value = ''; // Reset input
  }
};

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Paperclip className="w-5 h-5 text-primary" />
          File Transfer
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            Drag & drop files here or
          </p>
          <Button
            onClick={handleFileSelect}
            variant="outline"
            size="sm"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-smooth"
          >
            Select Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Outgoing Files Progress */}
        {Object.keys(fileProgress).length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Sending</h4>
            {Object.entries(fileProgress).map(([fileName, progress]) => (
              <div key={fileName} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <File className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="truncate" title={fileName}>{fileName}</span>
                  </div>
                  <span className="text-muted-foreground">{Math.round(progress)}%</span>
                </div>
                <Progress 
                  value={progress} 
                  className="h-2"
                />
              </div>
            ))}
          </div>
        )}

        {/* Incoming Files Progress */}
        {Object.keys(incomingFiles).length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Receiving</h4>
            {Object.entries(incomingFiles).map(([fileName, progress]) => (
              <div key={fileName} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Download className="w-4 h-4 text-accent flex-shrink-0" />
                    <span className="truncate" title={fileName}>{fileName}</span>
                  </div>
                  <span className="text-muted-foreground">{Math.round(progress)}%</span>
                </div>
                <Progress 
                  value={progress} 
                  className="h-2"
                />
              </div>
            ))}
          </div>
        )}

        {/* Tips */}
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Tip:</strong> You can select multiple files at once. Files are transferred securely through the peer connection.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};