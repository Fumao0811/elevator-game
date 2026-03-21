import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '../App';
interface Props { appState: AppState; }
const Paint: React.FC<Props> = ({ appState }) => {
    const { socket, room, setRoom } = appState;
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [currentColor, setCurrentColor] = useState('#000000');
    const [isEraser, setIsEraser] = useState(false);
    const [timeLeft, setTimeLeft] = useState(30);
    const [phase, setPhase] = useState<'outline' | 'paint'>('outline');
    const [selectedOutline, setSelectedOutline] = useState<string | null>(null);
    useEffect(() => {
        if (!socket || !room) { navigate('/'); return; }
        const handleDrawingFinished = (updatedRoom: any) => { setRoom(updatedRoom); navigate('/game'); };
        socket.on('drawing_finished', handleDrawingFinished);
        return () => { socket.off('drawing_finished', handleDrawingFinished); };
    }, [socket, room, navigate, setRoom]);
    useEffect(() => {
        if (isSubmitted) return;
        if (timeLeft <= 0) { submitDrawing(); return; }
        const timerId = setTimeout(() => { setTimeLeft(prev => prev - 1); }, 1000);
        return () => clearTimeout(timerId);
    }, [timeLeft, isSubmitted]);
    const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        let clientX, clientY;
        if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
        else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
        const rect = canvas.getBoundingClientRect();
        return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
    };
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (isSubmitted || phase === 'outline') return;
        setIsDrawing(true);
        setHasDrawn(true);
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });
        if (ctx) {
            if (isEraser) { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 20; }
            else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = currentColor; ctx.lineWidth = 8; }
            ctx.beginPath(); ctx.moveTo(x, y);
        }
    };
    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || isSubmitted) return;
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) { ctx.lineTo(x, y); ctx.stroke(); }
    };
    const endDrawing = () => { setIsDrawing(false); canvasRef.current?.getContext('2d')?.closePath(); };
    const drawSpecificOutline = (ctx: CanvasRenderingContext2D, type: string) => {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#000000';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 5;
        ctx.beginPath();
        const cx = width / 2;
        const cy = height / 2;

        if (type === 'round') {
            ctx.arc(cx, cy, width * 0.4, 0, Math.PI * 2);
        } else if (type === 'oval') {
            ctx.ellipse(cx, cy, width * 0.35, height * 0.45, 0, 0, Math.PI * 2);
        } else if (type === 'alien') {
            ctx.moveTo(cx, cy - height * 0.4);
            ctx.quadraticCurveTo(cx + width * 0.4, cy - height * 0.4, cx + width * 0.4, cy + height * 0.1);
            ctx.quadraticCurveTo(cx + width * 0.2, cy + height * 0.45, cx, cy + height * 0.45);
            ctx.quadraticCurveTo(cx - width * 0.2, cy + height * 0.45, cx - width * 0.4, cy + height * 0.1);
            ctx.quadraticCurveTo(cx - width * 0.4, cy - height * 0.4, cx, cy - height * 0.4);
        } else if (type === 'ghost') {
            ctx.moveTo(cx - width * 0.35, cy + height * 0.4);
            ctx.lineTo(cx - width * 0.35, cy);
            ctx.arc(cx, cy, width * 0.35, Math.PI, 0);
            ctx.lineTo(cx + width * 0.35, cy + height * 0.4);
            ctx.lineTo(cx + width * 0.2, cy + height * 0.3);
            ctx.lineTo(cx, cy + height * 0.4);
            ctx.lineTo(cx - width * 0.2, cy + height * 0.3);
            ctx.closePath();
        }

        if (type !== 'none') {
            ctx.stroke();
        }
    };

    const handleSelectOutline = (type: string) => {
        setSelectedOutline(type);
        setPhase('paint');
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            drawSpecificOutline(ctx, type);
        }
    };

    const clearCanvas = () => {
        if (isSubmitted) return;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                if (selectedOutline) {
                    drawSpecificOutline(ctx, selectedOutline);
                } else {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
            } 
            setHasDrawn(false); 
        }
    };
    const submitDrawing = () => {
        if (isSubmitted || !socket || !room) return;
        setIsSubmitted(true);

        // ★ここでユーザーがボタンを押した瞬間に音をダミー再生させ、「音声ブロック」を解除させる必殺技
        const dummyAudio = new Audio('/scare_sound.mp3');
        dummyAudio.volume = 0; // 音は出さない
        dummyAudio.play().then(() => { dummyAudio.pause(); dummyAudio.currentTime = 0; }).catch(e => console.log('Audio Blocked:', e));
        const canvas = canvasRef.current;
        if (canvas) {
            socket.emit('submit_drawing', { roomId: room.roomId, imageBase64: canvas.toDataURL('image/png') });
        }
    };
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = 400; canvas.height = 400;
            const ctx = canvas.getContext('2d');
            if (ctx) { 
                ctx.lineCap = 'round'; 
                ctx.lineJoin = 'round'; 
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
    }, []);
    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ color: '#fff' }}>おばけを描け！</h2>
            <p style={{ color: '#aaa', margin: '5px 0' }}>扉が開いた時に相手を驚かす絵です</p>
            {!isSubmitted && <h3 style={{ color: timeLeft <= 5 ? '#ff4444' : '#fff' }}>残り時間: {timeLeft}秒</h3>}
            {phase === 'outline' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', marginTop: '20px' }}>
                    <h3 style={{ color: '#fff' }}>1. 輪郭(ベース)を選んでください</h3>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button onClick={() => handleSelectOutline('round')} style={{ padding: '15px 25px', backgroundColor: '#333', color: '#fff', border: '2px solid #555', borderRadius: '10px', fontSize: '1.2rem', cursor: 'pointer' }}>丸顔</button>
                        <button onClick={() => handleSelectOutline('oval')} style={{ padding: '15px 25px', backgroundColor: '#333', color: '#fff', border: '2px solid #555', borderRadius: '10px', fontSize: '1.2rem', cursor: 'pointer' }}>卵型</button>
                        <button onClick={() => handleSelectOutline('alien')} style={{ padding: '15px 25px', backgroundColor: '#333', color: '#fff', border: '2px solid #555', borderRadius: '10px', fontSize: '1.2rem', cursor: 'pointer' }}>宇宙人型</button>
                        <button onClick={() => handleSelectOutline('ghost')} style={{ padding: '15px 25px', backgroundColor: '#333', color: '#fff', border: '2px solid #555', borderRadius: '10px', fontSize: '1.2rem', cursor: 'pointer' }}>おばけ型</button>
                        <button onClick={() => handleSelectOutline('none')} style={{ padding: '15px 25px', backgroundColor: '#8b0000', color: '#fff', border: '2px solid #ff4a5a', borderRadius: '10px', fontSize: '1.2rem', cursor: 'pointer' }}>輪郭なし</button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <span style={{ color: '#aaa', fontSize: '0.9rem', marginRight: '5px' }}>ツール:</span>
                    {[{ color: '#000000', label: '黒' }, { color: '#ffcc99', label: '肌' }, { color: '#ffffff', label: '白' }, { color: '#ff4a5a', label: '赤' }, { color: '#4aff4a', label: '緑' }, { color: '#4a9aff', label: '青' }, { color: '#ffff4a', label: '黄' }].map((pen) => (
                        <button
                            key={pen.color} onClick={() => { setIsEraser(false); setCurrentColor(pen.color); }}
                            style={{ width: '30px', height: '30px', backgroundColor: pen.color, borderRadius: '50%', border: 'none', cursor: 'pointer', boxShadow: (!isEraser && currentColor === pen.color) ? '0 0 0 3px #aaa' : 'none', transition: 'all 0.2s' }}
                        />
                    ))}
                    <button onClick={() => setIsEraser(true)} style={{ padding: '6px 12px', backgroundColor: '#333', color: '#fff', border: isEraser ? '2px solid #fff' : '2px solid #555', borderRadius: '6px', cursor: 'pointer', marginLeft: '10px' }}>消しゴム</button>
                    <button onClick={clearCanvas} style={{ padding: '6px 12px', backgroundColor: '#8b0000', color: '#fff', border: '2px solid #ff4a5a', borderRadius: '6px', cursor: 'pointer', marginLeft: '5px' }}>やり直し</button>
                </div>
            )}
            <div style={{ position: 'relative', marginTop: '15px' }}>
                <canvas ref={canvasRef} className="paint-canvas" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={endDrawing} onMouseLeave={endDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={endDrawing} style={{ border: '2px solid #555', backgroundColor: '#ffffff', width: '100%', maxWidth: '400px', aspectRatio: '1/1', touchAction: 'none', display: phase === 'outline' ? 'none' : 'block' }} />
                {isSubmitted && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>相手の完成を待っています...</div>}
            </div>
            <div style={{ marginTop: '20px' }}><h2 style={{ color: '#fff' }}>相手を驚かせる「顔」を描いてください！</h2><p style={{ color: '#aaa', fontSize: '0.9rem' }}>※扉が開いたとき、描いた顔が首なしの体に乗って突撃します。</p></div>
            <div style={{ marginTop: '20px' }}>
                <button className="btn" onClick={submitDrawing} disabled={isSubmitted || !hasDrawn}>{isSubmitted ? '待機中' : '完成！'}</button>
            </div>
        </div>
    );
};
export default Paint;
