import React, { useEffect, useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, User, Activity, SignalLow, SignalHigh } from 'lucide-react';

function getNetworkQuality() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { status: 'OFFLINE', label: '100% Offline (Store & Forward Active)', color: 'bg-amber-600 text-white' };
  }
  const conn = typeof navigator !== 'undefined' ? (navigator.connection || navigator.mozConnection || navigator.webkitConnection) : null;
  if (conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g')) {
    return { status: '2G_LOW', label: '2G Low Bandwidth (Audio / 40KB Mode)', color: 'bg-amber-100 text-amber-900 border-amber-300' };
  }
  return { status: 'ONLINE', label: 'Broadband / 4G Connected', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export default function VideoCallModal({ ticketId, isInitiator, callerRole, patient, onClose }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);

  const [callStatus, setCallStatus] = useState('Connecting to low-bandwidth signaling channel...');
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoDisabled, setVideoDisabled] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [netQuality] = useState(getNetworkQuality());

  useEffect(() => {
    const timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let isCleanedUp = false;

    const startCall = async () => {
      try {
        const is2G = netQuality.status === '2G_LOW';

        const stream = await navigator.mediaDevices.getUserMedia({
          video: is2G ? { width: 320, height: 240, frameRate: { max: 10 } } : { width: 640, height: 480, frameRate: { max: 20 } },
          audio: true
        });

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        if (is2G) {
          stream.getVideoTracks().forEach((t) => (t.enabled = false));
          setVideoDisabled(true);
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setHasRemoteStream(true);
            setCallStatus('Connected (Active Tele-OPD)');
          }
        };

        const wsUrl = `ws://127.0.0.1:8000/ws/call/${ticketId}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        pc.onicecandidate = (event) => {
          if (event.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
          }
        };

        ws.onopen = async () => {
          setCallStatus('Connected to Tele-OPD. Waiting for peer...');
          if (isInitiator) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
          }
        };

        ws.onerror = () => {
          setCallStatus('Local Tele-OPD Simulation (Server Offline)');
        };

        ws.onmessage = async (event) => {
          if (isCleanedUp) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
              setCallStatus('Connected (Streaming)');
            } else if (msg.type === 'answer') {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              setCallStatus('Connected (Streaming)');
            } else if (msg.type === 'candidate') {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            }
          } catch {}
        };
      } catch (err) {
        setCallStatus('Simulated Teleconsult (Camera/Mic bypassed)');
      }
    };

    startCall();

    return () => {
      isCleanedUp = true;
      if (wsRef.current) wsRef.current.close();
      if (pcRef.current) pcRef.current.close();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [ticketId, isInitiator, netQuality.status]);

  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setAudioMuted(!audioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      setVideoDisabled(!videoDisabled);
    }
  };

  // NEW: Terminates call and clears backend state so banner won't reappear
  const handleTerminateCall = async () => {
    try {
      await fetch('http://localhost:8000/api/tele-opd/clear-call/1', {
        method: 'POST'
      });
    } catch (err) {
      console.error("Failed to clear call state on backend:", err);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-950 w-full max-w-4xl rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col h-[85vh]">
        
        {/* Header Bar */}
        <div className="p-4 bg-slate-900 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Live Teleconsultation — Ticket #{ticketId}
              </h3>
              <p className="text-xs text-slate-400 font-mono">{callStatus}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-slate-800 text-emerald-400 px-3 py-1 rounded-full border border-slate-700 flex items-center gap-1">
              {netQuality.status === '2G_LOW' ? <SignalLow size={12} className="text-amber-400" /> : <SignalHigh size={12} />}
              {formatTime(callDuration)}
            </span>
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700 font-bold">
              {callerRole}
            </span>
          </div>
        </div>

        {/* Video Screen Area */}
        <div className="relative flex-1 bg-slate-900 flex items-center justify-center overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${hasRemoteStream ? 'block' : 'hidden'}`}
          />

          {!hasRemoteStream && (
            <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-3">
              <div className="w-20 h-20 bg-emerald-600/20 border border-emerald-500 rounded-full flex items-center justify-center text-emerald-400">
                <User size={38} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-200">
                  {callerRole.includes('Doctor')
                    ? `Connecting to ASHA Field Worker with ${patient?.patient_name || 'Patient'}`
                    : 'Connecting to Dr. Kulkarni at Shirsuphal PHC...'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Ticket #{ticketId} • {netQuality.status === '2G_LOW' ? '2G Low Bandwidth (Voice Priority Mode)' : 'Broadband WebRTC'}
                </p>
              </div>
              {patient && (
                <div className="inline-flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-mono text-emerald-300">
                  <Activity size={13} />
                  SpO2: {patient.spo2 || 98}% • BP: {patient.systolic_bp || 120}/{patient.diastolic_bp || 80}
                </div>
              )}
            </div>
          )}

          {/* Picture-in-Picture Local Webcam */}
          <div className="absolute bottom-4 right-4 w-36 h-28 sm:w-44 sm:h-32 bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700 shadow-xl">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover scale-x-[-1] ${videoDisabled ? 'hidden' : 'block'}`}
            />
            {videoDisabled && (
              <div className="w-full h-full flex flex-col items-center justify-center text-xs text-slate-400 bg-slate-900 p-2 text-center">
                <SignalLow size={18} className="text-amber-400 mb-1" />
                Audio-Only (2G)
              </div>
            )}
            <span className="absolute bottom-1.5 left-2 text-[10px] bg-slate-900/80 text-white px-1.5 py-0.5 rounded font-mono">
              You ({callerRole})
            </span>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="p-4 bg-slate-900 flex items-center justify-center gap-4 border-t border-slate-800">
          <button
            type="button"
            onClick={toggleAudio}
            className={`p-3 rounded-full border transition ${
              audioMuted ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title={audioMuted ? 'Unmute' : 'Mute'}
          >
            {audioMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            type="button"
            onClick={toggleVideo}
            className={`p-3 rounded-full border transition ${
              videoDisabled ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title={videoDisabled ? 'Enable Video' : 'Disable Video'}
          >
            {videoDisabled ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          <button
            type="button"
            onClick={handleTerminateCall}
            className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition shadow-lg flex items-center gap-2 px-6 font-semibold text-xs"
          >
            <PhoneOff size={18} />
            End Teleconsultation
          </button>
        </div>

      </div>
    </div>
  );
}