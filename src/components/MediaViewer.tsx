import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  SkipBack,
  SkipForward,
  Download,
  Repeat,
} from "lucide-react";

interface MediaViewerProps {
  data: ArrayBuffer;
  fileName: string;
  mediaType: "video" | "audio";
  mimeType?: string;
}

export function MediaViewer({ data, fileName, mediaType, mimeType }: MediaViewerProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Create object URL from ArrayBuffer
  useEffect(() => {
    if (data) {
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      const mime = mimeType || getMimeType(ext, mediaType);
      const blob = new Blob([data], { type: mime });
      const url = URL.createObjectURL(blob);
      setMediaUrl(url);

      return () => URL.revokeObjectURL(url);
    }
  }, [data, fileName, mimeType, mediaType]);

  function getMimeType(ext: string, type: "video" | "audio"): string {
    const videoTypes: Record<string, string> = {
      mp4: "video/mp4",
      webm: "video/webm",
      ogg: "video/ogg",
      ogv: "video/ogg",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
    };
    const audioTypes: Record<string, string> = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      oga: "audio/ogg",
      flac: "audio/flac",
      aac: "audio/aac",
      m4a: "audio/mp4",
      webm: "audio/webm",
    };
    if (type === "video") return videoTypes[ext] || "video/mp4";
    return audioTypes[ext] || "audio/mpeg";
  }

  // Media event handlers
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const handleTimeUpdate = () => setCurrentTime(media.currentTime);
    const handleDurationChange = () => setDuration(media.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (!isLooping) setIsPlaying(false);
    };

    media.addEventListener("timeupdate", handleTimeUpdate);
    media.addEventListener("durationchange", handleDurationChange);
    media.addEventListener("play", handlePlay);
    media.addEventListener("pause", handlePause);
    media.addEventListener("ended", handleEnded);

    return () => {
      media.removeEventListener("timeupdate", handleTimeUpdate);
      media.removeEventListener("durationchange", handleDurationChange);
      media.removeEventListener("play", handlePlay);
      media.removeEventListener("pause", handlePause);
      media.removeEventListener("ended", handleEnded);
    };
  }, [mediaUrl, isLooping]);

  const togglePlay = () => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause();
      } else {
        mediaRef.current.play();
      }
    }
  };

  const toggleMute = () => {
    if (mediaRef.current) {
      mediaRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (mediaRef.current) {
      mediaRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && mediaRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const newTime = percent * duration;
      mediaRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const skip = (seconds: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = Math.max(
        0,
        Math.min(duration, currentTime + seconds)
      );
    }
  };

  const toggleLoop = () => {
    setIsLooping(!isLooping);
    if (mediaRef.current) {
      mediaRef.current.loop = !isLooping;
    }
  };

  const changePlaybackRate = () => {
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const newRate = rates[nextIndex];
    setPlaybackRate(newRate);
    if (mediaRef.current) {
      mediaRef.current.playbackRate = newRate;
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleDownload = () => {
    if (mediaUrl) {
      const a = document.createElement("a");
      a.href = mediaUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const formatTime = (time: number): string => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!mediaUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted">Loading media...</div>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex flex-col h-full bg-neutral-900 ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
    >
      {/* Media Content */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {mediaType === "video" ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={mediaUrl}
            className="max-w-full max-h-full"
            onClick={togglePlay}
            loop={isLooping}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8">
            <audio
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={mediaUrl}
              loop={isLooping}
            />
            {/* Audio visualization placeholder */}
            <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center mb-6">
              <div
                className={`w-32 h-32 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center transition-transform ${
                  isPlaying ? "animate-pulse scale-110" : ""
                }`}
              >
                {isPlaying ? (
                  <Volume2 className="w-12 h-12 text-primary-foreground" />
                ) : (
                  <Play className="w-12 h-12 text-primary-foreground ml-1" />
                )}
              </div>
            </div>
            <p className="text-app font-medium text-lg">{fileName}</p>
            <p className="text-muted text-sm mt-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black/80 backdrop-blur-sm p-4">
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="w-full h-1.5 bg-neutral-700 rounded-full cursor-pointer mb-4 group"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-primary rounded-full relative group-hover:h-2 transition-all"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          {/* Left controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => skip(-10)}
              title="Rewind 10s"
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Play"}
              className="p-3 bg-white text-black rounded-full hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>

            <button
              onClick={() => skip(10)}
              title="Forward 10s"
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            <span className="text-white/80 text-sm ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Playback speed */}
            <button
              onClick={changePlaybackRate}
              title="Playback speed"
              className="px-2 py-1 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors text-sm font-medium"
            >
              {playbackRate}x
            </button>

            {/* Loop */}
            <button
              onClick={toggleLoop}
              title={isLooping ? "Disable loop" : "Enable loop"}
              className={`p-2 rounded-lg transition-colors ${
                isLooping
                  ? "text-primary bg-white/10"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Repeat className="w-5 h-5" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                title={isMuted ? "Unmute" : "Mute"}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 accent-primary"
              />
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              title="Download"
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <Download className="w-5 h-5" />
            </button>

            {/* Fullscreen (video only) */}
            {mediaType === "video" && (
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-5 h-5" />
                ) : (
                  <Maximize2 className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MediaViewer;
